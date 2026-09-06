# Keeps the herdr pane's agent name in sync with the model and effort actually in use.
#
# Custom hook, NOT managed by herdr — herdr-agent-state.ps1 next to this file is the
# managed one and gets overwritten on integration updates; this one does not.
#
# Wired to two events:
#   UserPromptSubmit - name is right while the turn is running
#   Stop             - self-heals after /model switches and /resume, where the
#                      transcript still showed the previous model at turn start
#
# Never writes to stdout in hook mode: UserPromptSubmit stdout is injected into the
# model's context, so any stray output would pollute every single prompt.

[CmdletBinding()]
param([switch]$SelfTest)

function Get-ModelFromLine {
    param([string]$Line)
    if ($Line -notmatch '"type"\s*:\s*"assistant"') { return $null }
    if ($Line -match '"isSidechain"\s*:\s*true') { return $null }
    if ($Line -notmatch '"model"\s*:\s*"([^"]+)"') { return $null }
    $m = $Matches[1]
    if ($m -eq '<synthetic>') { return $null }
    return $m
}

function Read-ModelFromTail {
    param([string]$Path, [int]$Bytes)
    $fs = $null
    $len = 0
    $read = 0
    $buf = $null
    try {
        # ReadWrite share: Claude Code holds the transcript open for appending.
        $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open,
                                     [System.IO.FileAccess]::Read,
                                     [System.IO.FileShare]::ReadWrite)
        $len = $fs.Length
        if ($len -eq 0) { return $null }
        $want = [int][Math]::Min($Bytes, $len)
        [void]$fs.Seek($len - $want, [System.IO.SeekOrigin]::Begin)
        $buf = New-Object byte[] $want
        $read = $fs.Read($buf, 0, $want)
    } finally {
        if ($fs) { $fs.Dispose() }
    }
    if ($read -le 0) { return $null }

    $lines = [Text.Encoding]::UTF8.GetString($buf, 0, $read) -split "`n"
    # First line is cut mid-JSON unless the whole file fit in the buffer.
    if ($len -gt $read -and $lines.Count -gt 1) { $lines = $lines[1..($lines.Count - 1)] }

    for ($i = $lines.Count - 1; $i -ge 0; $i--) {
        $m = Get-ModelFromLine $lines[$i]
        if ($m) { return $m }
    }
    return $null
}

function Get-LastAssistantModel {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
    if (-not (Test-Path -LiteralPath $Path)) { return $null }

    # Tail first — transcripts run to tens of MB and this fires on every prompt.
    $model = Read-ModelFromTail -Path $Path -Bytes 524288
    if ($model) { return $model }

    # Tail held no assistant line (one very large message). Full streaming scan.
    foreach ($line in [System.IO.File]::ReadLines($Path)) {
        $m = Get-ModelFromLine $line
        if ($m) { $model = $m }
    }
    return $model
}

function New-AgentName {
    param([string]$Model, [string]$Effort, [string]$PaneId)
    $m = $Model -replace '^claude-', ''
    $m = $m -replace '-\d{8}$', ''          # claude-haiku-4-5-20251001 -> haiku-4-5
    $suffix = '-{0}-{1}' -f $Effort, ($PaneId -replace ':', '')

    # herdr caps names at 32 chars. Trim the model, never the pane suffix — that
    # suffix is what keeps the name globally unique across panes.
    $room = 32 - 'claude-'.Length - $suffix.Length
    if ($room -lt 1) { return $null }
    if ($m.Length -gt $room) { $m = ($m.Substring(0, $room) -replace '-+$', '') }

    $name = ("claude-$m$suffix").ToLower()
    $name = $name -replace '[^a-z0-9_-]', '-'
    return ($name -replace '-+$', '')
}

function Get-EffortLevel {
    try {
        $path = Join-Path $env:USERPROFILE '.claude\settings.json'
        $level = (Get-Content -LiteralPath $path -Raw -Encoding utf8 | ConvertFrom-Json).effortLevel
        if (-not [string]::IsNullOrWhiteSpace($level)) { return [string]$level }
    } catch { }
    return 'default'
}

try {
    if ($SelfTest) {
        # Newest transcript for the current directory, using Claude Code's slug rule.
        $slug = (Get-Location).Path -replace '[^A-Za-z0-9]', '-'
        $dir = Join-Path $env:USERPROFILE ".claude\projects\$slug"
        $transcript = (Get-ChildItem -LiteralPath $dir -Filter *.jsonl -ErrorAction SilentlyContinue |
                       Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName

        $effort = Get-EffortLevel
        $model = Get-LastAssistantModel -Path $transcript
        $name = if ($model) { New-AgentName -Model $model -Effort $effort -PaneId $env:HERDR_PANE_ID } else { $null }

        Write-Host "HERDR_ENV     : $env:HERDR_ENV"
        Write-Host "HERDR_PANE_ID : $env:HERDR_PANE_ID"
        Write-Host "transcript    : $transcript"
        Write-Host "model         : $model"
        Write-Host "effort        : $effort"
        if ($name) { Write-Host "name          : $name  ($($name.Length) chars)" }
        else { Write-Host "name          : (skipped - no assistant model found)" }
        exit 0
    }

    if ($env:HERDR_ENV -ne '1') { exit 0 }
    if ([string]::IsNullOrWhiteSpace($env:HERDR_PANE_ID)) { exit 0 }

    # Decode stdin as UTF-8 explicitly. [Console]::In uses the console input
    # encoding (GBK/936 here), which mangles every non-ASCII byte in the payload
    # and makes ConvertFrom-Json throw. Stop payloads carry last_assistant_message,
    # so any Chinese in the reply broke the hook every single time.
    $reader = New-Object System.IO.StreamReader(
        [Console]::OpenStandardInput(), [Text.Encoding]::UTF8)
    $raw = $reader.ReadToEnd()

    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $payload = $raw | ConvertFrom-Json

    if (-not [string]::IsNullOrWhiteSpace($payload.agent_id)) { exit 0 }   # subagent
    if ($payload.hook_event_name -notin @('UserPromptSubmit', 'Stop')) { exit 0 }

    # No assistant message yet (first turn of a fresh session): leave the existing
    # name alone rather than guess. The Stop hook fixes it once the turn lands.
    $model = Get-LastAssistantModel -Path ([string]$payload.transcript_path)
    if (-not $model) { exit 0 }

    $name = New-AgentName -Model $model -Effort (Get-EffortLevel) -PaneId $env:HERDR_PANE_ID
    if (-not $name) { exit 0 }

    $herdr = if ([string]::IsNullOrWhiteSpace($env:HERDR_BIN_PATH)) { 'herdr' } else { $env:HERDR_BIN_PATH }
    & $herdr agent rename $env:HERDR_PANE_ID $name 2>$null | Out-Null
} catch { }

exit 0

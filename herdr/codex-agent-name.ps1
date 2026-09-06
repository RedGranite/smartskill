[CmdletBinding()]
param(
    [switch]$SelfTest,
    [string]$InputJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-HookSuccess {
    [Console]::Out.WriteLine('{"continue":true,"suppressOutput":true}')
}

function Get-PayloadValue {
    param(
        [object]$Payload,
        [string[]]$Names
    )

    if ($null -eq $Payload) { return $null }
    foreach ($name in $Names) {
        $property = $Payload.PSObject.Properties[$name]
        if ($null -ne $property -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
            return [string]$property.Value
        }
    }
    return $null
}

function Get-CodexConfigValue {
    param([string]$Key)

    $codexHome = if ([string]::IsNullOrWhiteSpace($env:CODEX_HOME)) {
        Join-Path $env:USERPROFILE '.codex'
    } else {
        $env:CODEX_HOME
    }
    $configPath = Join-Path $codexHome 'config.toml'
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { return $null }

    $pattern = '^\s*' + [regex]::Escape($Key) + '\s*=\s*["''](?<value>[^"'']+)["'']\s*$'
    $match = Select-String -LiteralPath $configPath -Pattern $pattern | Select-Object -First 1
    if ($null -eq $match) { return $null }
    return $match.Matches[0].Groups['value'].Value
}

function ConvertTo-AgentSlug {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
    $slug = $Value.ToLowerInvariant()
    $slug = [regex]::Replace($slug, '[^a-z0-9_-]+', '-')
    $slug = [regex]::Replace($slug, '[-_]{2,}', '-')
    return $slug.Trim([char[]]'-_')
}

function New-CodexAgentName {
    param(
        [string]$Model,
        [string]$Effort,
        [string]$PaneId
    )

    $modelSlug = ConvertTo-AgentSlug $Model
    $modelSlug = [regex]::Replace($modelSlug, '^gpt-[0-9]+(?:-[0-9]+)+(?:-|$)', '')
    $effortSlug = ConvertTo-AgentSlug $Effort
    $paneSlug = ConvertTo-AgentSlug $PaneId
    if ([string]::IsNullOrWhiteSpace($paneSlug)) { throw 'HERDR_PANE_ID is missing or invalid.' }

    $nameParts = @('codex')
    if ($modelSlug) { $nameParts += $modelSlug }
    if ($effortSlug) { $nameParts += $effortSlug }
    $nameParts += $paneSlug
    $agentName = $nameParts -join '-'
    if ($agentName.Length -gt 32 -or $agentName -notmatch '^[a-z][a-z0-9_-]*$') {
        throw "Generated agent name is invalid: $agentName"
    }
    return $agentName
}

try {
    $rawInput = if ($PSBoundParameters.ContainsKey('InputJson')) {
        $InputJson
    } else {
        [Console]::In.ReadToEnd()
    }
    $payload = if ([string]::IsNullOrWhiteSpace($rawInput)) {
        $null
    } else {
        $rawInput.TrimStart([char]0xFEFF) | ConvertFrom-Json -Depth 32
    }

    $model = Get-PayloadValue -Payload $payload -Names @('model')
    if ([string]::IsNullOrWhiteSpace($model) -and $SelfTest) {
        $model = Get-CodexConfigValue -Key 'model'
    }
    $effort = Get-PayloadValue -Payload $payload -Names @('model_reasoning_effort', 'reasoning_effort')
    if ([string]::IsNullOrWhiteSpace($effort)) {
        $effort = Get-CodexConfigValue -Key 'model_reasoning_effort'
    }
    $paneId = $env:HERDR_PANE_ID

    if (-not $SelfTest -and (
        $env:HERDR_ENV -ne '1' -or
        [string]::IsNullOrWhiteSpace($paneId) -or
        [string]::IsNullOrWhiteSpace($model)
    )) {
        Write-HookSuccess
        exit 0
    }

    $agentName = New-CodexAgentName -Model $model -Effort $effort -PaneId $paneId
    if ($SelfTest) {
        [pscustomobject]@{
            name = $agentName
            length = $agentName.Length
            model = $model
            effort = $effort
            pane_id = $paneId
            valid = $true
            renamed = $false
        } | ConvertTo-Json -Compress
        exit 0
    }

    $paneSlug = ConvertTo-AgentSlug $paneId
    $mutex = [Threading.Mutex]::new($false, "Local\CodexHerdrAgentName_$paneSlug")
    $lockTaken = $false
    try {
        $lockTaken = $mutex.WaitOne([TimeSpan]::FromSeconds(5))
        if (-not $lockTaken) { throw "Timed out waiting for the Herdr name lock for pane $paneId." }

        $herdrCommand = if (
            -not [string]::IsNullOrWhiteSpace($env:HERDR_BIN_PATH) -and
            (Test-Path -LiteralPath $env:HERDR_BIN_PATH -PathType Leaf)
        ) {
            $env:HERDR_BIN_PATH
        } else {
            (Get-Command herdr -ErrorAction Stop).Source
        }
        $null = & $herdrCommand agent rename $paneId $agentName 2>&1
        if ($LASTEXITCODE -ne 0) { throw "herdr agent rename exited with code $LASTEXITCODE." }
    } finally {
        if ($lockTaken) { $mutex.ReleaseMutex() }
        $mutex.Dispose()
    }

    Write-HookSuccess
} catch {
    [Console]::Error.WriteLine("Codex Herdr agent-name hook failed: $($_.Exception.Message)")
    exit 1
}

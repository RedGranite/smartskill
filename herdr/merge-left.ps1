param([switch]$SelfTest, [switch]$DryRun, [switch]$NewTab)
$ErrorActionPreference = 'Stop'
# Herdr emits UTF-8 JSON; detached shortcuts may inherit code page 936.
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

function Get-PreviousTab($Tabs, [string]$TabId) {
    $ids = @($Tabs | ForEach-Object { $_.tab_id })
    $index = [Array]::IndexOf($ids, $TabId)
    if ($index -lt 0) { throw 'Current tab is missing.' }
    if ($index -gt 0) { return $ids[$index - 1] }
}

if ($SelfTest) {
    $tabs = @(@{tab_id='w1:t9'}, @{tab_id='w1:t2'}, @{tab_id='w1:t7'})
    if ((Get-PreviousTab $tabs 'w1:t2') -ne 'w1:t9') { throw 'Tab order check failed.' }
    if ($null -ne (Get-PreviousTab $tabs 'w1:t9')) { throw 'First tab check failed.' }
    $rejected = $false
    try { Get-PreviousTab $tabs 'missing' } catch { $rejected = $true }
    if (!$rejected) { throw 'Missing tab check failed.' }
    'PASS: tab order, first tab, missing tab'
    exit
}

function Invoke-Herdr {
    $response = & $env:HERDR_BIN_PATH @args
    if ($LASTEXITCODE -ne 0) { throw "Herdr command failed: $args" }
    $json = $response | ConvertFrom-Json
    if ($json.error) { throw ($json.error | ConvertTo-Json -Compress) }
    $json.result
}

foreach ($name in 'HERDR_BIN_PATH','HERDR_ACTIVE_WORKSPACE_ID','HERDR_ACTIVE_TAB_ID','HERDR_ACTIVE_PANE_ID') {
    if (![Environment]::GetEnvironmentVariable($name)) { throw "Missing $name; run from the Herdr shortcut." }
}
# ponytail: one nonblocking lock for layout changes; use per-session locks if multiple servers need concurrent moves.
$lock = [Threading.Mutex]::new($false, 'Local\HerdrMergeLeftShortcut')
if (!$lock.WaitOne(0)) { $lock.Dispose(); exit }
try {
    $tabs = (Invoke-Herdr tab list --workspace $env:HERDR_ACTIVE_WORKSPACE_ID).tabs
    $pane = (Invoke-Herdr pane get $env:HERDR_ACTIVE_PANE_ID).pane
    if ($pane.tab_id -ne $env:HERDR_ACTIVE_TAB_ID) { throw 'Pane moved since shortcut was pressed; no action taken.' }
    $sourceTab = $tabs | Where-Object tab_id -eq $pane.tab_id
    if ($NewTab) {
        $label = if ($pane.label) { $pane.label } else { $sourceTab.label }
        if ($DryRun) { "NEW TAB $($pane.pane_id): $label"; exit }
        Invoke-Herdr pane move $pane.pane_id --new-tab --label $label --focus | Out-Null
        exit
    }
    $target = Get-PreviousTab $tabs $env:HERDR_ACTIVE_TAB_ID
    if (!$target) {
        if ($DryRun) { 'NOOP: no tab to the left'; exit }
        Invoke-Herdr notification show '左侧没有标签页' --sound none | Out-Null
        exit
    }
    if ($DryRun) { "MOVE $($pane.pane_id) -> $target (right)"; exit }
    if ($sourceTab.pane_count -eq 1) {
        Invoke-Herdr pane rename $pane.pane_id $sourceTab.label | Out-Null
    }
    Invoke-Herdr pane move $pane.pane_id --tab $target --split right --focus | Out-Null
} catch {
    Invoke-Herdr notification show '合并分屏失败' --body $_.Exception.Message --sound none | Out-Null
    throw
} finally {
    $lock.ReleaseMutex()
    $lock.Dispose()
}

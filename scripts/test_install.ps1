# 运行：pwsh -NoProfile -File scripts/test_install.ps1；只写入临时目录。
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$tempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$testRoot = [IO.Path]::GetFullPath((Join-Path $tempParent ('smartskill-test-' + [guid]::NewGuid().ToString('N'))))
if ((Split-Path $testRoot -Parent).TrimEnd('\') -ne $tempParent.TrimEnd('\')) { throw 'Unsafe test directory' }
New-Item -ItemType Directory -Path $testRoot | Out-Null
Push-Location $testRoot

function Install-Sample {
    & (Join-Path $repo 'install.ps1') -Skill before-build -Agent universal -Scope project
}

try {
    Install-Sample
    $installed = Join-Path $testRoot '.agents/skills/before-build'
    Set-Content -LiteralPath (Join-Path $installed 'local-note.txt') -Value 'local customization'
    Add-Content -LiteralPath (Join-Path $installed 'SKILL.md') -Value 'local edit'
    $oldHash = (Get-FileHash -LiteralPath (Join-Path $installed 'SKILL.md')).Hash

    function Copy-Item { throw 'Injected copy failure' }
    $failed = $false
    try { Install-Sample } catch { $failed = $_.Exception.Message -match 'Injected copy failure' }
    finally { Remove-Item Function:Copy-Item }
    if (!$failed -or !(Test-Path -LiteralPath (Join-Path $installed 'local-note.txt'))) {
        throw 'Copy failure did not preserve the old installation'
    }
    if ((Get-FileHash -LiteralPath (Join-Path $installed 'SKILL.md')).Hash -ne $oldHash) { throw 'Copy failure changed old content' }

    # Remove only this test's staged copy to force the final directory move to fail.
    function Copy-Item {
        param([string]$LiteralPath, [string]$Destination, [switch]$Recurse)
        Microsoft.PowerShell.Management\Copy-Item @PSBoundParameters
        $staged = [IO.Path]::GetFullPath((Join-Path $Destination (Split-Path $LiteralPath -Leaf)))
        if (!$staged.StartsWith($testRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Unsafe staged path' }
        Remove-Item -LiteralPath $staged -Recurse -Force
    }
    $failed = $false
    try { Install-Sample } catch { $failed = $true }
    finally { Remove-Item Function:Copy-Item }
    if (!$failed -or (Get-FileHash -LiteralPath (Join-Path $installed 'SKILL.md')).Hash -ne $oldHash) {
        throw 'Activation failure did not restore the old installation'
    }

    Install-Sample
    $sourceHash = (Get-FileHash -LiteralPath (Join-Path $repo 'skills/coding/before-build/SKILL.md')).Hash
    if ((Get-FileHash -LiteralPath (Join-Path $installed 'SKILL.md')).Hash -ne $sourceHash) { throw 'Installed content differs from source' }
    if (Test-Path -LiteralPath (Join-Path $installed 'local-note.txt')) { throw 'Update left obsolete files in the active skill' }
    $backups = @(Get-ChildItem -LiteralPath (Join-Path $testRoot '.agents/smartskill-backups') -Directory)
    if ($backups.Count -ne 1) { throw 'Expected one retained backup' }
    $saved = Join-Path $backups[0].FullName 'before-build'
    if ((Get-FileHash -LiteralPath (Join-Path $saved 'SKILL.md')).Hash -ne $oldHash -or
        !(Test-Path -LiteralPath (Join-Path $saved 'local-note.txt'))) { throw 'Backup lost local edits' }
    if (@(Get-ChildItem -LiteralPath (Join-Path $testRoot '.agents') -Filter '.smartskill-install-*').Count) { throw 'Staging directory was not cleaned' }
    'PASS: initial install, failed copy, failed activation, clean update, retained local edits'
} finally {
    Pop-Location
    Remove-Item -LiteralPath $testRoot -Recurse -Force
}

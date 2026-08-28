#Requires -Version 5.1
<#
.SYNOPSIS
将 smartskill 的 skill 复制到各 CLI 的 skills 目录。
.EXAMPLE
./install.ps1 -Component coding -Agent claude,codex
./install.ps1 -Skill before-build,doc-writing -Scope project
#>
[CmdletBinding()]
param(
    [ValidateSet('coding', 'thinking', 'search', 'all')]
    [string]$Component = 'all',

    [string[]]$Skill = @(),

    [ValidateSet('claude', 'codex', 'opencode', 'pi', 'hermes', 'dsh', 'universal')]
    [string[]]$Agent = @('universal'),

    [ValidateSet('user', 'project')]
    [string]$Scope = 'user',

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# 目标目录表：唯一来源
$Targets = @{
    claude    = @{ user = '.claude/skills';          project = '.claude/skills' }
    codex     = @{ user = '.codex/skills';           project = '.agents/skills' }
    opencode  = @{ user = '.config/opencode/skills'; project = '.agents/skills' }
    pi        = @{ user = '.pi/agent/skills';        project = '.pi/skills' }
    hermes    = @{ user = '.hermes/skills';          project = '.hermes/skills' }
    dsh       = @{ user = '.dsh/skills';             project = '.dsh/skills' }
    universal = @{ user = '.agents/skills';          project = '.agents/skills' }
}

$all = Get-ChildItem (Join-Path $PSScriptRoot 'skills') -Directory |
    ForEach-Object { Get-ChildItem $_.FullName -Directory }

if ($Skill.Count -gt 0) {
    $missing = $Skill | Where-Object { $all.Name -notcontains $_ }
    if ($missing) { throw "未找到 skill: $($missing -join ', ')" }
    $selected = $all | Where-Object { $Skill -contains $_.Name }
}
elseif ($Component -eq 'all') {
    $selected = $all
}
else {
    $selected = $all | Where-Object { $_.Parent.Name -eq $Component }
}

foreach ($a in $Agent) {
    $rel = $Targets[$a][$Scope]
    $dest = if ($Scope -eq 'user') { Join-Path $HOME $rel } else { Join-Path (Get-Location) $rel }

    foreach ($s in $selected) {
        $to = Join-Path $dest $s.Name
        $note = if (Test-Path $to) { '(覆盖)' } else { '' }

        if ($DryRun) {
            Write-Host "[dry-run] $($s.Name) -> $to $note"
            continue
        }
        New-Item -ItemType Directory -Force -Path $dest | Out-Null
        if ($note) { Remove-Item -Recurse -Force $to }
        Copy-Item -Recurse $s.FullName $to
        Write-Host "$($s.Name) -> $to $note"
    }
}

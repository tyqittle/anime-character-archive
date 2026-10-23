# SPDX-License-Identifier: GPL-3.0-or-later
param([Parameter(Mandatory=$true)][string]$UpstreamRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$sourceDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'rendering'
$manifest = Get-Content (Join-Path $sourceDirectory 'upstream-overlays.json') -Raw | ConvertFrom-Json
$temporaryBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$fixture = Join-Path $temporaryBase ('archive-render-contract-' + [Guid]::NewGuid().ToString('N'))
$target = Join-Path $fixture $manifest.directory
try {
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    foreach ($entry in $manifest.replacements) {
        Copy-Item -LiteralPath (Join-Path (Join-Path $UpstreamRoot $manifest.directory) $entry.file) -Destination $target
    }
    $broken = Join-Path $target $manifest.replacements[-1].file
    [IO.File]::AppendAllText($broken, "// unexpected upstream change")
    $before = @{}
    foreach ($entry in $manifest.replacements) {
        $before[$entry.file] = (Get-FileHash -LiteralPath (Join-Path $target $entry.file)).Hash
    }
    $rejected = $false
    try { & (Join-Path $PSScriptRoot 'Apply-RenderOverlays.ps1') -UpstreamRoot $fixture }
    catch {
        if ($_.Exception.Message -notlike 'Pinned rendering input changed:*') { throw }
        $rejected = $true
    }
    if (-not $rejected) { throw 'Changed upstream was accepted' }
    foreach ($entry in $manifest.replacements) {
        if ((Get-FileHash -LiteralPath (Join-Path $target $entry.file)).Hash -ne $before[$entry.file]) {
            throw 'Failed preflight partially replaced source files'
        }
    }
    foreach ($file in $manifest.additions) {
        if (Test-Path -LiteralPath (Join-Path $target $file)) { throw 'Failed preflight installed helper' }
    }
    Copy-Item -LiteralPath (Join-Path (Join-Path $UpstreamRoot $manifest.directory) $manifest.replacements[-1].file) -Destination $broken -Force
    & (Join-Path $PSScriptRoot 'Apply-RenderOverlays.ps1') -UpstreamRoot $fixture
    foreach ($file in @($manifest.replacements.file) + @($manifest.additions)) {
        $expected = [IO.File]::ReadAllText((Join-Path $sourceDirectory $file)).Replace("`r`n","`n")
        $actual = [IO.File]::ReadAllText((Join-Path $target $file)).Replace("`r`n","`n")
        if ($actual -ne $expected) { throw "Installed source differs: $file" }
    }
    if (@(Get-Content (Join-Path $fixture 'archive-render-overlays.json') -Raw | ConvertFrom-Json).Count -ne 7) {
        throw 'Missing exact rendering source receipt'
    }
    Write-Host 'PASS render overlay contract: changed source rejected before mutation; exact installation verified'
}
finally {
    # Delete only the unique test directory created under the system temp root.
    $resolved = [IO.Path]::GetFullPath($fixture)
    $prefix = $temporaryBase.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $resolved.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($resolved) -notmatch '^archive-render-contract-[a-f0-9]{32}$') {
        throw 'Refuse cleanup outside the temporary test directory'
    }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}

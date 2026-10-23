# SPDX-License-Identifier: GPL-3.0-or-later
# Install owned C# modules only after verifying every pinned upstream input.
param([Parameter(Mandatory=$true)][string]$UpstreamRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$sourceDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'rendering'
$manifest = Get-Content (Join-Path $sourceDirectory 'upstream-overlays.json') -Raw | ConvertFrom-Json
$targetDirectory = Join-Path $UpstreamRoot $manifest.directory
function Read-Normalized([string]$path) {
    return [IO.File]::ReadAllText($path).Replace("`r`n", "`n")
}
function Get-SourceHash([string]$text) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($text)
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes))
}
$files = @($manifest.replacements.file) + @($manifest.additions)
foreach ($file in $files) {
    if ($file -notmatch '^[A-Za-z][A-Za-z0-9]+\.cs$' -or
        -not (Test-Path -LiteralPath (Join-Path $sourceDirectory $file))) {
        throw "Invalid or missing rendering overlay: $file"
    }
}
# Validate the complete set BEFORE replacing any source file.
foreach ($entry in $manifest.replacements) {
    $path = Join-Path $targetDirectory $entry.file
    if (-not (Test-Path -LiteralPath $path) -or
        (Get-SourceHash (Read-Normalized $path)) -ne $entry.sha256) {
        throw "Pinned rendering input changed: $($entry.file); expected upstream $($manifest.upstream)"
    }
}
foreach ($file in $manifest.additions) {
    if (Test-Path -LiteralPath (Join-Path $targetDirectory $file)) {
        throw "Refuse to overwrite an unexpected upstream helper: $file"
    }
}
$receipt = foreach ($file in $files) {
    $text = Read-Normalized (Join-Path $sourceDirectory $file)
    [IO.File]::WriteAllText((Join-Path $targetDirectory $file), $text,
        [Text.UTF8Encoding]::new($false))
    [pscustomobject]@{ file=$file; sha256=(Get-SourceHash $text) }
}
$receipt | ConvertTo-Json | Set-Content (Join-Path $UpstreamRoot 'archive-render-overlays.json') -Encoding utf8
Write-Host "Installed $($files.Count) typed rendering modules over pinned upstream $($manifest.upstream)"

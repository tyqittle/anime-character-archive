# Extracted from the Windows workflow. Run from the repository root.
$legacyImporter = Get-Content ./native-desktop/Open-ArchiveCharacter.ps1 -Raw
if (-not $legacyImporter.Contains('Assert-NativeSpine41') -or
    $legacyImporter.Contains('$entry.spineVersion') -or
    $legacyImporter.Contains('$entry.versionUnverified')) {
  throw 'Legacy native importer still blocks characters using catalog metadata'
}
& ./native-desktop/Patch-Upstream.ps1 -UpstreamRoot ./native-upstream
# Patch-Upstream.ps1 is pure PowerShell and throws on failure;
# LASTEXITCODE is stale after non-native scripts and must not be checked here.
$patched = Get-Content ./native-upstream/SpinePet/src/SpinePet/App.xaml.cs -Raw
$patched.Split([char]10) | Where-Object { $_ -match 'Archive|OnStartup|StartActivation' } | ForEach-Object { Write-Host $_ }
$bd2Bridge = Get-Content ./native-upstream/SpinePet/src/SpinePet/NativeBrownDust2Bridge.cs -Raw
if (-not $bd2Bridge.Contains('EnsureBrownDust2DownloadedAsync') -or
    -not $patched.Contains('RestoreArchiveCharactersAsync()') -or
    -not $patched.Contains('AcceptArchiveStartupArgs(e.Args)')) {
  throw 'Native one-click import integration did not apply'
}

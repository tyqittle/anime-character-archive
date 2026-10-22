# SPDX-License-Identifier: GPL-3.0-or-later
# Apply a minimal, auditable integration to pinned upstream My_SpinePet.
param([Parameter(Mandatory=$true)][string]$UpstreamRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$source = Join-Path $UpstreamRoot 'SpinePet/src/SpinePet/App.xaml.cs'
$projectDir = Split-Path -Parent $source
$addon = Join-Path $PSScriptRoot 'NativeArchiveBridge.cs'
if (-not (Test-Path $source) -or -not (Test-Path $addon)) { throw 'Pinned upstream or archive extension missing' }
$text = [System.IO.File]::ReadAllText($source)
$changes = @(
    @('public sealed class App : Application','public sealed partial class App : Application'),
    @('        base.OnStartup(e);', '        base.OnStartup(e);' + "`n" + '        AcceptArchiveStartupArgs(e.Args);'),
    @('        SynchronizeDiscoveredResources(resourceDiscovery);', '        _archiveDiscovery = resourceDiscovery;' + "`n" + '        SynchronizeDiscoveredResources(resourceDiscovery);'),
    @('        _ = RestoreCharactersAsync();','        _ = RestoreArchiveCharactersAsync();'),
    @('        _mainWindow.Show();', '        _mainWindow.Show();' + "`n" + '        Dispatcher.BeginInvoke(new Action(OfferArchiveProtocolRegistration));'),
    @('                            mainWindow.SwitchToConfigMode();','                            mainWindow.SwitchToConfigMode();' + "`n" + '                            _ = ShowArchiveRequestAsync();')
)
foreach ($change in $changes) {
    [string]$before = $change[0]
    [string]$after = $change[1]
    if (-not $text.Contains($before)) { throw "Upstream source changed: expected anchor missing: $before" }
    $count = [regex]::Matches($text, [regex]::Escape($before)).Count
    if ($count -ne 1) { throw "Expected exactly one match for $before, got $count" }
    if ($before -ne $after) { $text = $text.Replace($before,$after) }
}
[System.IO.File]::WriteAllText($source, $text, [System.Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath $addon -Destination (Join-Path $projectDir 'NativeArchiveBridge.cs') -Force
Write-Host 'Applied audited archive bridge to upstream SpinePet application; renderer unchanged.'

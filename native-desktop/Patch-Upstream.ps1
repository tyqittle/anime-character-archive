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
    @('        _mainWindow.Show();', '        _mainWindow.Show();' + "`n" + '        Dispatcher.BeginInvoke(new Action(OfferArchiveProtocolRegistration));' + "`n" + '        Dispatcher.BeginInvoke(new Action(StartArchiveUpdateLoop));'),
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
# Explicitly insert hooks that include a newline. PowerShell's nested @()
# array expression can coerce those concatenations; never infer success from
# merely seeing the original anchor in the source.
if (-not $text.Contains('AcceptArchiveStartupArgs(e.Args);')) {
    $old = '        base.OnStartup(e);'
    if (-not $text.Contains($old)) { throw 'Missing OnStartup hook' }
    $text = $text.Replace($old, $old + "`r`n" + '        AcceptArchiveStartupArgs(e.Args);')
}
if (-not $text.Contains('OfferArchiveProtocolRegistration')) {
    $old = '        _mainWindow.Show();'
    if (-not $text.Contains($old)) { throw 'Missing MainWindow.Show hook' }
    $text = $text.Replace($old, $old + "`r`n" + '        Dispatcher.BeginInvoke(new Action(OfferArchiveProtocolRegistration));' + "`r`n" + '        Dispatcher.BeginInvoke(new Action(StartArchiveUpdateLoop));')
}
if (-not $text.Contains('_ = ShowArchiveRequestAsync();')) {
    $old = '                            mainWindow.SwitchToConfigMode();'
    if (-not $text.Contains($old)) { throw 'Missing existing-app activation hook' }
    $text = $text.Replace($old, $old + "`r`n" + '                            _ = ShowArchiveRequestAsync();')
}
if (-not ($text.Contains('AcceptArchiveStartupArgs(e.Args);') -and
          $text.Contains('OfferArchiveProtocolRegistration') -and
          $text.Contains('_ = ShowArchiveRequestAsync();') -and
          $text.Contains('RestoreArchiveCharactersAsync()') -and
          $text.Contains('StartArchiveUpdateLoop'))) {
    throw 'Native website protocol boot hooks could not be applied'
}
# Register click-to-voice once per native app process. This is separate from
# website audio and persists for imported BD2 characters after a restart.
$voiceHook = '        AcceptArchiveStartupArgs(e.Args);'
if ([regex]::Matches($text,[regex]::Escape($voiceHook)).Count -ne 1) {
    throw 'Native Brown Dust 2 voice startup hook missing or duplicated'
}
$text = $text.Replace($voiceHook,$voiceHook + "`r`n" + '        InitializeBrownDust2Voice();')
[System.IO.File]::WriteAllText($source, $text, [System.Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath $addon -Destination (Join-Path $projectDir 'NativeArchiveBridge.cs') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'NativeArchiveAssetCache.cs') -Destination (Join-Path $projectDir 'NativeArchiveAssetCache.cs') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'NativeBrownDust2Bridge.cs') -Destination (Join-Path $projectDir 'NativeBrownDust2Bridge.cs') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'NativeBrownDust2Voice.cs') -Destination (Join-Path $projectDir 'NativeBrownDust2Voice.cs') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'NativeBrownDust2WebMDecoder.cs') -Destination (Join-Path $projectDir 'NativeBrownDust2WebMDecoder.cs') -Force
# Universal visual host is a typed module; copy source rather than generate behavior.
foreach ($module in Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'web') -Filter '*.cs') {
    Copy-Item -LiteralPath $module.FullName -Destination $projectDir -Force
}
$universalApp = [IO.File]::ReadAllText($source)
$catalogHook = '        _mainWindow.Show();'
if ([regex]::Matches($universalApp,[regex]::Escape($catalogHook)).Count -ne 1) { throw 'Missing universal catalog UI hook' }
$universalApp = $universalApp.Replace($catalogHook,'        InitializeUniversalCatalogButton();' + "`n" + $catalogHook)
$shutdownHook = '        MainWindow? mainWindow = _mainWindow;'
$shutdownStart = $universalApp.IndexOf('    private void PrepareForShutdown()')
$shutdownEnd = $universalApp.IndexOf('    private static void SignalExistingInstance()', $shutdownStart)
if ($shutdownStart -lt 0 -or $shutdownEnd -lt 0) { throw 'Missing universal shutdown boundary' }
$shutdown = $universalApp.Substring($shutdownStart,$shutdownEnd-$shutdownStart)
if ([regex]::Matches($shutdown,[regex]::Escape($shutdownHook)).Count -ne 1) {
    throw 'Missing unique universal shutdown hook'
}
$shutdown = $shutdown.Replace($shutdownHook,'        StopUniversalDesktop();' + "`n" + $shutdownHook)
$universalApp = $universalApp.Substring(0,$shutdownStart)+$shutdown+$universalApp.Substring($shutdownEnd)
$hideHook = '            hideAll: () => DispatchToUi(_characterManager.HideAll),'
if ([regex]::Matches($universalApp,[regex]::Escape($hideHook)).Count -ne 1) { throw 'Missing hide-all hook' }
$universalApp = $universalApp.Replace($hideHook,
    '            hideAll: () => DispatchToUi(() => { _characterManager.HideAll(); HideUniversalDesktop(); }),')
$showHook = '            await _characterManager.ShowAllAsync();'
if ([regex]::Matches($universalApp,[regex]::Escape($showHook)).Count -ne 1) { throw 'Missing show-all hook' }
$universalApp = $universalApp.Replace($showHook,$showHook + "`n" + '            ShowUniversalDesktop();')
[IO.File]::WriteAllText($source,$universalApp,[Text.UTF8Encoding]::new($false))
# Expose a real in-app updater control on the EXISTING selection panel.
# Directly running Update.exe is not the Velopack check-updates UI.
$windowXaml = Join-Path $UpstreamRoot 'SpinePet/src/SpinePet/Views/MainWindow.xaml'
$windowText = [System.IO.File]::ReadAllText($windowXaml).Replace("`r`n", "`n")
$originalExit = @'
                                 <Button Grid.Column="2"
                                         Width="44"
                                         Height="24"
                                         MinHeight="24"
                                         Margin="8,0,0,0"
                                         Padding="4,0"
                                         Content="Exit"
                                         Style="{StaticResource QuietButtonStyle}"
                                         VerticalAlignment="Center"
                                         x:Name="ExitButton"
                                         ToolTip="Exit SpinePet completely"
                                         AutomationProperties.Name="Exit application" />
'@
$withUpdate = @'
                                 <StackPanel Grid.Column="2"
                                             Orientation="Vertical"
                                             VerticalAlignment="Center"
                                             Margin="5,0,0,0">
                                     <Button x:Name="UniversalCatalogButton"
                                             Width="76" Height="24" Margin="0,0,0,3"
                                             Padding="4,0" Content="网页选角"
                                             Style="{StaticResource QuietButtonStyle}"
                                             AutomationProperties.Name="Choose any website animation" />
                                     <Button x:Name="ManualUpdateButton"
                                             Width="76" Height="24"
                                             Margin="0,0,0,3"
                                             Padding="4,0"
                                             Content="检查更新"
                                             Style="{StaticResource QuietButtonStyle}"
                                             AutomationProperties.Name="Check for updates" />
                                     <Button Width="76" Height="24"
                                             Padding="4,0"
                                             Content="Exit"
                                             Style="{StaticResource QuietButtonStyle}"
                                             x:Name="ExitButton"
                                             ToolTip="Exit SpinePet completely"
                                             AutomationProperties.Name="Exit application" />
                                 </StackPanel>
'@
$originalExit = $originalExit.Replace("`r`n", "`n")
$withUpdate = $withUpdate.Replace("`r`n", "`n")
if ([regex]::Matches($windowText,[regex]::Escape($originalExit)).Count -ne 1) {
    throw 'Pinned upstream main-window Update button insertion anchor mismatch'
}
$windowText = $windowText.Replace($originalExit,$withUpdate)
[System.IO.File]::WriteAllText($windowXaml,$windowText,[System.Text.UTF8Encoding]::new($false))
Write-Host 'Native archive bridge and manual in-app update control integrated.'

# Add the tested Velopack updater library to the pinned upstream app.
$program = Join-Path $projectDir 'Program.cs'
$programText = [System.IO.File]::ReadAllText($program)
$entry = '        App app = new();'
if ([regex]::Matches($programText,[regex]::Escape($entry)).Count -ne 1) { throw 'Upstream Program entrypoint missing' }
$programText = $programText.Replace($entry,'        Velopack.VelopackApp.Build().SetAutoApplyOnStartup(false).Run();' + "`r`n" + $entry)
[System.IO.File]::WriteAllText($program,$programText,[System.Text.UTF8Encoding]::new($false))

$proj = Join-Path $projectDir 'SpinePet.csproj'
$projText = [System.IO.File]::ReadAllText($proj)
$ref = '    <PackageReference Include="Vortice.D3DCompiler"'
if ([regex]::Matches($projText,[regex]::Escape($ref)).Count -ne 1) { throw 'Upstream NuGet reference anchor missing' }
$projText = $projText.Replace($ref, '    <PackageReference Include="Microsoft.Web.WebView2" Version="1.0.3650.58" />' + "`r`n" + '    <PackageReference Include="Velopack" Version="1.2.161" />' + "`r`n" + '    <PackageReference Include="Concentus" Version="2.2.2" />' + "`r`n" + $ref)
[System.IO.File]::WriteAllText($proj,$projText,[System.Text.UTF8Encoding]::new($false))

# Persistent user models must not live inside Velopack's replaceable current/ folder.
$paths = Join-Path $projectDir 'Infrastructure/AppPaths.cs'
$pathsText = [System.IO.File]::ReadAllText($paths)
$startMarker = '    internal static string ResolveResourceDirectory(string baseDirectory)'
$endMarker = '    private static IEnumerable<string> GetPortableBaseDirectories'
$start = $pathsText.IndexOf($startMarker)
$end = $pathsText.IndexOf($endMarker,$start)
if ($start -lt 0 -or $end -lt 0) { throw 'Upstream AppPaths structure changed' }
$segment = $pathsText.Substring($start, $end-$start)
$needle = '        string resolvedBaseDirectory = Path.GetFullPath(baseDirectory);'
if ([regex]::Matches($segment,[regex]::Escape($needle)).Count -ne 1) { throw 'Resource directory anchor missing' }
$replacement = @'
        // A separate, optional per-user choice made in the two-folder EXE wizard.
        // Stored in HKCU so automatic app updates never overwrite the selection.
        // Portable ZIP installs still use their own adjacent res directory.
        if (File.Exists(Path.Combine(resolvedBaseDirectory, "sq.version")))
        {
            try
            {
                using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                    @"Software\AnimeCharacterSpinePet");
                string? selected = key?.GetValue("ResourceDirectory") as string;
                if (!string.IsNullOrWhiteSpace(selected) &&
                    Path.IsPathFullyQualified(selected))
                {
                    string chosen = Path.GetFullPath(selected);
                    // Keep the user's selected drive authoritative even if it
                    // is temporarily disconnected: NEVER redirect writes to C:.
                    // Resource discovery will see the unavailable directory as
                    // empty and imports will explain any write failure.
                    try { Directory.CreateDirectory(chosen); }
                    catch (Exception ex) when (ex is IOException ||
                                               ex is UnauthorizedAccessException)
                    {
                        // Preserve the preferred folder for the next startup.
                    }
                    return chosen;
                }
            }
            catch (Exception ex) when (ex is IOException ||
                                       ex is UnauthorizedAccessException ||
                                       ex is ArgumentException ||
                                       ex is System.Security.SecurityException)
            {
                // An unavailable removable drive or denied folder must never
                // crash the entire desktop renderer during static startup.
            }
            string durable = Path.Combine(LocalDataDirectory, "ArchiveResources");
            Directory.CreateDirectory(durable);
            return durable;
        }
'@
$segment = $segment.Replace($needle,$needle + "`r`n" + $replacement.TrimEnd())
$pathsText = $pathsText.Substring(0,$start)+$segment+$pathsText.Substring($end)
[System.IO.File]::WriteAllText($paths,$pathsText,[System.Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'NativeAutoUpdate.cs') -Destination (Join-Path $projectDir 'NativeAutoUpdate.cs') -Force

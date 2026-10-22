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
[System.IO.File]::WriteAllText($source, $text, [System.Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath $addon -Destination (Join-Path $projectDir 'NativeArchiveBridge.cs') -Force
Write-Host 'Applied audited archive bridge to upstream SpinePet application; renderer unchanged.'

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
$projText = $projText.Replace($ref, '    <PackageReference Include="Velopack" Version="1.2.161" />' + "`r`n" + $ref)
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
        // The installed Velopack current/ directory is replaced on update.
        // Store asset downloads in durable per-user data, not in app/current.
        if (File.Exists(Path.Combine(resolvedBaseDirectory, "sq.version")))
        {
            string durable = Path.Combine(LocalDataDirectory, "ArchiveResources");
            Directory.CreateDirectory(durable);
            return durable;
        }
'@
$segment = $segment.Replace($needle,$needle + "`r`n" + $replacement.TrimEnd())
$pathsText = $pathsText.Substring(0,$start)+$segment+$pathsText.Substring($end)
[System.IO.File]::WriteAllText($paths,$pathsText,[System.Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'NativeAutoUpdate.cs') -Destination (Join-Path $projectDir 'NativeAutoUpdate.cs') -Force

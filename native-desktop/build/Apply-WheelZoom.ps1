# Extracted from the Windows workflow. Run from the repository root.
& ./native-desktop/Patch-WheelZoom.ps1 -UpstreamRoot ./native-upstream
& ./native-desktop/build/Test-RenderOverlayContract.ps1 -UpstreamRoot ./native-upstream
& ./native-desktop/build/Apply-RenderOverlays.ps1 -UpstreamRoot ./native-upstream
& ./native-desktop/Patch-RenderEnvelope.ps1 -UpstreamRoot ./native-upstream
& ./native-desktop/Patch-ViewportSafety.ps1 -UpstreamRoot ./native-upstream
$engine = Get-Content ./native-upstream/SpinePet/src/SpinePet/Rendering/Native/NativeCharacterRenderEngine.cs -Raw
$xaml = Get-Content ./native-upstream/SpinePet/src/SpinePet/Views/MainWindow.xaml -Raw
$updater = Get-Content ./native-upstream/SpinePet/src/SpinePet/NativeAutoUpdate.cs -Raw
$input = Get-Content ./native-upstream/SpinePet/src/SpinePet/Rendering/Native/NativeInputWindow.cs -Raw
$frame = Get-Content ./native-upstream/SpinePet/src/SpinePet/Rendering/Native/NativeFrameRenderer.cs -Raw
$surface = Get-Content ./native-upstream/SpinePet/src/SpinePet/Rendering/Native/NativeCompositionSurface.cs -Raw
$silhouette = Get-Content ./native-upstream/SpinePet/src/SpinePet/Rendering/Native/NativeSilhouetteRasterizer.cs -Raw
$bounds = Get-Content ./native-upstream/SpinePet/src/SpinePet/Rendering/Native/NativeSpineBounds.cs -Raw
$hitRegion = Get-Content ./native-upstream/SpinePet/src/SpinePet/Rendering/Native/NativeInputRegionCoordinator.cs -Raw
$voice = Get-Content ./native-upstream/SpinePet/src/SpinePet/NativeBrownDust2Voice.cs -Raw
$app = Get-Content ./native-upstream/SpinePet/src/SpinePet/App.xaml.cs -Raw
if (-not $engine.Contains('private void OnNativeMouseWheel') -or
    -not $frame.Contains('NativeSpineBounds observed = state.Geometry.Bounds') -or
    -not $surface.Contains('NativeSurfaceSizing.Contains(') -or
    -not $silhouette.Contains('float halfCell = cellSize * 0.38f / pixelScale') -or
    -not $silhouette.Contains('const int Subdivisions = 4') -or
    -not $bounds.Contains('NativeSpineSkinIncludes.Apply(data, probe);') -or
    -not $bounds.Contains('NativeSpineSkinIncludes.Apply(data, setupSkeleton);') -or
    -not $engine.Contains('var bounds = ProjectEnvelope();') -or
    -not $hitRegion.Contains('screen.Bounds,') -or
    -not $engine.Contains('NativeDesktopVoiceRelay.NotifyClicked(') -or
    -not $engine.Contains('FitNewlyLoadedCharacterToMonitor(current);') -or
    -not $xaml.Contains('x:Name="ManualUpdateButton"') -or
    -not $updater.Contains('CheckArchiveUpdatesAsync(manual: true)') -or
    -not $voice.Contains('Char" + clipCode + "_BattleReady_') -or
    -not $app.Contains('InitializeBrownDust2Voice();') -or
    -not $input.Contains('MouseWheelInput')) {
  throw 'Native mouse hit regions, auto-sizing and BD2 voice integration missing'
}

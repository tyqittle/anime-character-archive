# SPDX-License-Identifier: GPL-3.0-or-later
# Expand translucent DirectComposition surfaces when actual animation exceeds
# the sampled setup/animation envelope. Preserve real transparent pixels.
param([Parameter(Mandatory=$true)][string]$UpstreamRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$file = Join-Path $UpstreamRoot 'SpinePet/src/SpinePet/Rendering/Native/NativeFrameRenderer.cs'
if (-not (Test-Path -LiteralPath $file)) { throw 'Missing pinned upstream frame renderer' }
$text = [System.IO.File]::ReadAllText($file).Replace("`r`n", "`n")
$before = @'
                NativeFrameRenderPlan plan =
                    state.Geometry.BuildFramePlan(
                        state.Resource.Skeleton);
                float pixelScale =
'@
$after = @'
                NativeFrameRenderPlan plan =
                    state.Geometry.BuildFramePlan(
                        state.Resource.Skeleton);
                // Envelope sampling is an estimate, not a clipping policy.
                // Adapt to real animation vertices, including wide scene poses.
                NativeSpineBounds observed = state.Geometry.Bounds;
                if (!observed.IsEmpty &&
                    (state.Envelope.IsEmpty ||
                     observed.Left < state.Envelope.Left ||
                     observed.Top < state.Envelope.Top ||
                     observed.Right > state.Envelope.Right ||
                     observed.Bottom > state.Envelope.Bottom))
                {
                    float pad = Math.Max(48f,
                        Math.Max(observed.Width, observed.Height) * 0.06f);
                    state.Envelope = state.Envelope.Union(observed)
                        .Expand(pad, pad, pad);
                }
                float pixelScale =
'@
$before = $before.Replace("`r`n", "`n")
$after = $after.Replace("`r`n", "`n")
$matches = [regex]::Matches($text, [regex]::Escape($before))
if ($matches.Count -ne 1) { throw "Native render envelope patch anchor mismatch: $($matches.Count)" }
$text = $text.Replace($before, $after)
[System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))

# Critical: the native renderer merges ALL outfit/attachment skins, but
# upstream's envelope estimator creates a fresh Skeleton with ONLY the default
# skin. BD2 lower-body attachments and costume extensions can therefore be
# absent from SetupBounds and ALL sampled animation limits. The shared pivot
# then sits at the wrong point and the whole lower body goes off-screen.
# Calculate BOTH setup and animated bounds with the SAME combined skin policy
# used by NativeSpineResource.Load.
$boundsSource = Join-Path $UpstreamRoot 'SpinePet/src/SpinePet/Rendering/Native/NativeSpineBounds.cs'
$boundsCode = [System.IO.File]::ReadAllText($boundsSource).Replace("`r`n","`n")
$boundsEdits = @(
    @('        Skeleton setupSkeleton = new(data);' + "`n" +
      '        setupSkeleton.SetToSetupPose();',
      '        Skeleton setupSkeleton = new(data);' + "`n" +
      '        NativeSpineSkinIncludes.Apply(data, setupSkeleton);' + "`n" +
      '        setupSkeleton.SetToSetupPose();'),
    @('            Skeleton probe = new(data);' + "`n" +
      '            AnimationState state = new(new AnimationStateData(data));',
      '            Skeleton probe = new(data);' + "`n" +
      '            NativeSpineSkinIncludes.Apply(data, probe);' + "`n" +
      '            AnimationState state = new(new AnimationStateData(data));')
)
foreach ($edit in $boundsEdits) {
    if ([regex]::Matches($boundsCode,[regex]::Escape($edit[0])).Count -ne 1) {
        throw 'Spine combined-skin envelope parity anchor mismatch'
    }
    $boundsCode = $boundsCode.Replace($edit[0],$edit[1])
}
[System.IO.File]::WriteAllText($boundsSource,$boundsCode,[System.Text.UTF8Encoding]::new($false))

# The ORIGINAL NativeCompositionSurface.EnsureSize() checks ONLY the scale,
# ignoring any growth of the animation envelope. A full-body character may
# suddenly extend below that cached swap chain: its vertices are silently
# clipped although screen hit testing sees a different geometry.
$surface = Join-Path $UpstreamRoot 'SpinePet/src/SpinePet/Rendering/Native/NativeCompositionSurface.cs'
$surfaceText = [System.IO.File]::ReadAllText($surface).Replace("`r`n","`n")
$oldSurface = @'
        if (CanContainScale(pixelScale))
            return;

        RecreateForScale(envelope, pivotX, pivotY, pixelScale);
'@
$newSurface = @'
        if (CanContainScale(pixelScale))
        {
            // The allocated swap chain can be wider/taller than before, but
            // its pivot anchor must also contain the NEW envelope on ALL sides.
            // Use capacity-scale units, just like RecreateForScale().
            float left = Math.Max(1f,
                (pivotX - envelope.Left) * CapacityScale);
            float right = Math.Max(1f,
                (envelope.Right - pivotX) * CapacityScale);
            float top = Math.Max(1f,
                (pivotY - envelope.Top) * CapacityScale);
            float bottom = Math.Max(1f,
                (envelope.Bottom - pivotY) * CapacityScale);
            const float roundingTolerance = 2f;
            if (left <= AnchorPixelX + roundingTolerance &&
                top <= AnchorPixelY + roundingTolerance &&
                right <= PixelWidth - AnchorPixelX + roundingTolerance &&
                bottom <= PixelHeight - AnchorPixelY + roundingTolerance)
            {
                return;
            }
        }

        // A changed animated envelope needs a replacement surface even when
        // the zoom level has not changed. Otherwise legs and skirts are cut.
        RecreateForScale(envelope, pivotX, pivotY, pixelScale);
'@
$oldSurface = $oldSurface.Replace("`r`n","`n")
$newSurface = $newSurface.Replace("`r`n","`n")
if ([regex]::Matches($surfaceText,[regex]::Escape($oldSurface)).Count -ne 1) {
    throw 'Pinned upstream surface sizing patch anchor mismatch'
}
$surfaceText = $surfaceText.Replace($oldSurface,$newSurface)
[System.IO.File]::WriteAllText($surface,$surfaceText,[System.Text.UTF8Encoding]::new($false))

# An input window region is rasterized from the visible triangles. Sampling
# only the centre of each 8px cell misses skinny silhouette edges/legs, so the
# desktop receives clicks despite visible pixels. Sample centre and corners;
# the existing pixel-accurate HitTester still rejects genuinely transparent
# pixels inside these coarse input window regions.
$raster = Join-Path $UpstreamRoot 'SpinePet/src/SpinePet/Rendering/Native/NativeSilhouetteRasterizer.cs'
$rasterText = [System.IO.File]::ReadAllText($raster).Replace("`r`n","`n")
$oldRaster = @'
                    if (IsVisiblePoint(triangle, skeletonX, skeletonY))
                        scratch.Grid[gridIndex] = true;
'@
$newRaster = @'
                    float halfCell = cellSize * 0.38f / pixelScale;
                    bool hit = IsVisiblePoint(triangle, skeletonX, skeletonY) ||
                        IsVisiblePoint(triangle, skeletonX-halfCell, skeletonY-halfCell) ||
                        IsVisiblePoint(triangle, skeletonX+halfCell, skeletonY-halfCell) ||
                        IsVisiblePoint(triangle, skeletonX-halfCell, skeletonY+halfCell) ||
                        IsVisiblePoint(triangle, skeletonX+halfCell, skeletonY+halfCell);
                    // Thin lower-leg meshes can be much narrower than the
                    // 8px region cell. Five samples alone can miss a WHOLE
                    // row of opaque pixels and give the desktop the click.
                    // Run bounded 4x4 supersampling only for cells the
                    // ordinary fast path judged empty.
                    if (!hit)
                    {
                        const int Subdivisions = 4;
                        float subStep = cellSize / (float)Subdivisions / pixelScale;
                        for (int sy = 0; sy < Subdivisions && !hit; sy++)
                        for (int sx = 0; sx < Subdivisions && !hit; sx++)
                        {
                            float ox = (sx - (Subdivisions-1)*0.5f) * subStep;
                            float oy = (sy - (Subdivisions-1)*0.5f) * subStep;
                            hit = IsVisiblePoint(triangle,
                                skeletonX + ox, skeletonY + oy);
                        }
                    }
                    if (hit)
                        scratch.Grid[gridIndex] = true;
'@
$oldRaster = $oldRaster.Replace("`r`n","`n")
$newRaster = $newRaster.Replace("`r`n","`n")
if ([regex]::Matches($rasterText,[regex]::Escape($oldRaster)).Count -ne 1) {
    throw 'Pinned upstream silhouette rasterization patch anchor mismatch'
}
$rasterText = $rasterText.Replace($oldRaster,$newRaster)
[System.IO.File]::WriteAllText($raster,$rasterText,[System.Text.UTF8Encoding]::new($false))
# Feed genuine body clicks (but not drag motions or desktop clicks) to the
# independent BD2 voice module while preserving upstream click animations.
$engine = Join-Path $UpstreamRoot 'SpinePet/src/SpinePet/Rendering/Native/NativeCharacterRenderEngine.cs'
$engineText = [System.IO.File]::ReadAllText($engine).Replace("`r`n","`n")
$oldClick = @'
            NativeAnimationController.PlayClickAnimation,
'@
$newClick = @'
            state =>
            {
                NativeAnimationController.PlayClickAnimation(state);
                global::SpinePet.NativeDesktopVoiceRelay.NotifyClicked(
                    state.Config.Id);
            },
'@
if ([regex]::Matches($engineText,[regex]::Escape($oldClick)).Count -ne 1) {
    throw 'Pinned upstream click audio bridge patch anchor mismatch'
}
$engineText = $engineText.Replace($oldClick,$newClick)
[System.IO.File]::WriteAllText($engine,$engineText,[System.Text.UTF8Encoding]::new($false))
# Native hit regions were also intersected with Screen.WorkingArea,
# excluding the taskbar-height strip even for a character drawn there.
# Restrict to actual physical monitor pixels, not the taskbar's work area.
$region = Join-Path $UpstreamRoot 'SpinePet/src/SpinePet/Rendering/Native/NativeInputRegionCoordinator.cs'
$regionText = [System.IO.File]::ReadAllText($region)
$workAreaAnchor = 'screen.WorkingArea,'
if ([regex]::Matches($regionText,[regex]::Escape($workAreaAnchor)).Count -ne 1) {
    throw 'Pinned upstream input working-area clipping patch anchor mismatch'
}
$regionText = $regionText.Replace($workAreaAnchor, 'screen.Bounds,')
[System.IO.File]::WriteAllText($region,$regionText,[System.Text.UTF8Encoding]::new($false))
# Transparent input pixels use the SAME low-alpha portions visible on the
# desktop, rather than discarding delicate 4..15/255 lace/limb pixels.
$tex = Join-Path $UpstreamRoot 'SpinePet/src/SpinePet/Rendering/Native/NativeTextureSource.cs'
$texText = [System.IO.File]::ReadAllText($tex)
if ([regex]::Matches($texText,[regex]::Escape('opacity < 16f / 255f')).Count -ne 1 -or
    [regex]::Matches($texText,[regex]::Escape('pixels[pixelIndex * 4 + 3] >= 16')).Count -ne 1) {
    throw 'Pinned upstream alpha hit-mask threshold anchor mismatch'
}
$texText = $texText.Replace('opacity < 16f / 255f','opacity < 4f / 255f')
$texText = $texText.Replace('pixels[pixelIndex * 4 + 3] >= 16','pixels[pixelIndex * 4 + 3] >= 4')
[System.IO.File]::WriteAllText($tex,$texText,[System.Text.UTF8Encoding]::new($false))
Write-Host 'Native combined-skin bounds, full monitor and oversampled translucent hit silhouettes corrected.'

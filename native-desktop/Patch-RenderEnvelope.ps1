# SPDX-License-Identifier: GPL-3.0-or-later
# Expand translucent DirectComposition surfaces when actual animation exceeds
# the sampled setup/animation envelope. Preserve real transparent pixels.
param([Parameter(Mandatory=$true)][string]$UpstreamRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Rendering, surface sizing and input regions are maintained as typed overlays.
# See build/Apply-RenderOverlays.ps1; only remaining upstream hooks live here.

# Critical: the native renderer merges ALL outfit/attachment skins, but
# upstream's envelope estimator creates a fresh Skeleton with ONLY the default
# skin. BD2 lower-body attachments and costume extensions can therefore be
# absent from SetupBounds and ALL sampled animation limits. The shared pivot
# then sits at the wrong point and the whole lower body goes off-screen.
# Calculate BOTH setup and animated bounds with the SAME combined skin policy
# used by NativeSpineResource.Load.
$boundsSource = Join-Path $UpstreamRoot 'SpinePet/src/SpinePet/Rendering/Native/NativeSpineBounds.cs'
$boundsCode = [System.IO.File]::ReadAllText($boundsSource).Replace("`r`n","`n")
# Avoid nested @() here: PowerShell enumerates nested arrays during pipeline
# construction and loses the two-string before/after pair.
$setupBefore = '        Skeleton setupSkeleton = new(data);' + "`n" +
    '        setupSkeleton.SetToSetupPose();'
$setupAfter = '        Skeleton setupSkeleton = new(data);' + "`n" +
    '        NativeSpineSkinIncludes.Apply(data, setupSkeleton);' + "`n" +
    '        setupSkeleton.SetToSetupPose();'
$probeBefore = '            Skeleton probe = new(data);' + "`n" +
    '            AnimationState state = new(new AnimationStateData(data));'
$probeAfter = '            Skeleton probe = new(data);' + "`n" +
    '            NativeSpineSkinIncludes.Apply(data, probe);' + "`n" +
    '            AnimationState state = new(new AnimationStateData(data));'
if ([regex]::Matches($boundsCode, [regex]::Escape($setupBefore)).Count -ne 1) {
    throw 'Combined-skin setup skeleton patch anchor mismatch'
}
$boundsCode = $boundsCode.Replace($setupBefore, $setupAfter)
if ([regex]::Matches($boundsCode, [regex]::Escape($probeBefore)).Count -ne 1) {
    throw 'Combined-skin animation probe patch anchor mismatch'
}
$boundsCode = $boundsCode.Replace($probeBefore, $probeAfter)
[System.IO.File]::WriteAllText($boundsSource,$boundsCode,[System.Text.UTF8Encoding]::new($false))

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

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
Write-Host 'Native rendering surface now follows actual animated geometry.'

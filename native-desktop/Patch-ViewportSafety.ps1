# SPDX-License-Identifier: GPL-3.0-or-later
# A static translucent surface cannot show a character whose lower body was
# positioned outside the real Windows monitor. Fit on FIRST load only, using
# its actual rendered geometry. Dragging remains unrestricted afterward.
param([Parameter(Mandatory=$true)][string]$UpstreamRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$engine = Join-Path $UpstreamRoot 'SpinePet/src/SpinePet/Rendering/Native/NativeCharacterRenderEngine.cs'
$c = [System.IO.File]::ReadAllText($engine).Replace("`r`n", "`n")
$needle = @'
                _frameRenderer.UpdateSurfacePosition(current);
                _frameRenderer.MarkCompositionDirty();
                RenderFrame(0);
                UpdateFrameTimerState();

                if (string.IsNullOrWhiteSpace(
'@
$replacement = @'
                _frameRenderer.UpdateSurfacePosition(current);
                _frameRenderer.MarkCompositionDirty();
                RenderFrame(0);
                // Imported characters default to the bottom edge of the
                // working area (just 24 pixels above the taskbar). Their
                // animated legs/tails can extend BELOW this anchor. Unlike
                // expanding a swapchain, monitor clipping is not fixable by
                // resizing: fit on first load using REAL rendered bounds.
                FitNewlyLoadedCharacterToMonitor(current);
                UpdateFrameTimerState();

                if (string.IsNullOrWhiteSpace(
'@
if ([regex]::Matches($c,[regex]::Escape($needle)).Count -ne 1) {
  throw 'Pinned upstream initial-load viewport hook anchor mismatch'
}
$c = $c.Replace($needle,$replacement)
$methodAnchor = '    private async Task LoadCharacterAsync('
$method = @'
    // This runs once per model load, NOT on every animated frame. Users can
    // still drag off-screen or manually zoom afterward if they want to.
    private void FitNewlyLoadedCharacterToMonitor(NativeCharacterState state)
    {
        NativeCompositionWindow? window = _session.Window;
        if (window == null || state.ScreenBounds.IsEmpty)
            return;

        var bounds = state.ScreenBounds;
        var middle = new System.Drawing.Point(
            (int)Math.Round((bounds.Left + bounds.Right) * 0.5),
            (int)Math.Round((bounds.Top + bounds.Bottom) * 0.5));
        System.Drawing.Rectangle desktop =
            System.Windows.Forms.Screen.FromPoint(middle).WorkingArea;
        const float margin = 18f;
        float usableWidth = Math.Max(1f, desktop.Width - 2f * margin);
        float usableHeight = Math.Max(1f, desktop.Height - 2f * margin);

        float fit = Math.Min(1f, Math.Min(
            usableWidth / Math.Max(1f, bounds.Width),
            usableHeight / Math.Max(1f, bounds.Height)));
        if (fit < 0.999f)
        {
            double newScale = Math.Clamp(
                state.CurrentScale * fit, MinimumScale, state.MaxScale);
            if (newScale < state.CurrentScale)
            {
                state.CurrentScale = newScale;
                state.Config.Scale = newScale;
                // Keep the scale UI's independent components in agreement.
                state.Config.ScaleBasePercent = 100;
                state.Config.ScaleMultiplier =
                    newScale / SpinePet.Models.CharacterConfig.DefaultScale;
                RenderFrame(0);
                bounds = state.ScreenBounds;
            }
        }

        float dx;
        float dy;
        if (bounds.Width >= usableWidth)
            dx = desktop.Left + desktop.Width / 2f -
                 (bounds.Left + bounds.Right) / 2f;
        else if (bounds.Left < desktop.Left + margin)
            dx = desktop.Left + margin - bounds.Left;
        else if (bounds.Right > desktop.Right - margin)
            dx = desktop.Right - margin - bounds.Right;
        else
            dx = 0;

        if (bounds.Height >= usableHeight)
            dy = desktop.Top + desktop.Height / 2f -
                 (bounds.Top + bounds.Bottom) / 2f;
        else if (bounds.Top < desktop.Top + margin)
            dy = desktop.Top + margin - bounds.Top;
        else if (bounds.Bottom > desktop.Bottom - margin)
            dy = desktop.Bottom - margin - bounds.Bottom;
        else
            dy = 0;

        if (Math.Abs(dx) > 0.5f || Math.Abs(dy) > 0.5f)
        {
            state.Config.PositionX += dx / window.DpiScale;
            state.Config.PositionY += dy / window.DpiScale;
            RenderFrame(0);
        }
        if (fit < 0.999f || Math.Abs(dx) > 0.5f || Math.Abs(dy) > 0.5f)
        {
            AppLogger.Write(nameof(NativeCharacterRenderHost),
                $"first-load-monitor-fit id={state.Config.Id} " +
                $"scale={state.CurrentScale:F3} dx={dx:F0} dy={dy:F0}");
        }
    }

'@
if ([regex]::Matches($c,[regex]::Escape($methodAnchor)).Count -ne 1) {
 throw 'Pinned upstream viewport-fit method anchor mismatch'
}
$c = $c.Replace($methodAnchor,$method + $methodAnchor)
[System.IO.File]::WriteAllText($engine,$c,[System.Text.UTF8Encoding]::new($false))
Write-Host 'Native imported characters now fit the actual monitor on first load.'

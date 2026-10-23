// SPDX-License-Identifier: GPL-3.0-or-later
namespace SpinePet.Rendering.Native;

internal static class NativeSurfaceSizing
{
    // Check the actual drawing scale. Checking at reserved capacity scale
    // consumes growth headroom before it is used and needlessly rebuilds surfaces.
    public static bool Contains(NativeSpineBounds envelope, float pivotX, float pivotY,
        float pixelScale, int width, int height, float anchorX, float anchorY)
    {
        if (envelope.IsEmpty || !float.IsFinite(pixelScale) || pixelScale <= 0 ||
            width <= 0 || height <= 0)
            return false;
        float left = Math.Max(1f, (pivotX-envelope.Left)*pixelScale);
        float right = Math.Max(1f, (envelope.Right-pivotX)*pixelScale);
        float top = Math.Max(1f, (pivotY-envelope.Top)*pixelScale);
        float bottom = Math.Max(1f, (envelope.Bottom-pivotY)*pixelScale);
        return left <= anchorX && right <= width-anchorX &&
            top <= anchorY && bottom <= height-anchorY;
    }
}

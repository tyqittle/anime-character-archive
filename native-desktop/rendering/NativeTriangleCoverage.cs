// SPDX-License-Identifier: GPL-3.0-or-later
using System.Numerics;

namespace SpinePet.Rendering.Native;

// Triangle coefficients are prepared once per silhouette refresh, not per sample.
internal readonly struct NativeTriangleCoverage
{
    private const float Tolerance = -0.0001f;
    private readonly Vector2 _origin;
    private readonly float _firstX, _firstY, _secondX, _secondY;
    private readonly float _minX, _minY, _maxX, _maxY;
    public bool IsValid { get; }

    public NativeTriangleCoverage(Vector2 a, Vector2 b, Vector2 c)
    {
        _origin = c;
        _minX = Math.Min(a.X, Math.Min(b.X, c.X));
        _maxX = Math.Max(a.X, Math.Max(b.X, c.X));
        _minY = Math.Min(a.Y, Math.Min(b.Y, c.Y));
        _maxY = Math.Max(a.Y, Math.Max(b.Y, c.Y));
        float denominator = (b.Y-c.Y)*(a.X-c.X) + (c.X-b.X)*(a.Y-c.Y);
        IsValid = float.IsFinite(denominator) && Math.Abs(denominator) >= 0.00001f;
        float inverse = IsValid ? 1f / denominator : 0f;
        _firstX = (b.Y-c.Y)*inverse;
        _firstY = (c.X-b.X)*inverse;
        _secondX = (c.Y-a.Y)*inverse;
        _secondY = (a.X-c.X)*inverse;
    }

    public bool TryGetWeights(float x, float y, out float a, out float b, out float c)
    {
        float dx = x-_origin.X, dy = y-_origin.Y;
        a = _firstX*dx + _firstY*dy;
        b = _secondX*dx + _secondY*dy;
        c = 1f-a-b;
        return IsValid && x >= _minX && x <= _maxX &&
            y >= _minY && y <= _maxY &&
            a >= Tolerance && b >= Tolerance && c >= Tolerance;
    }

    // Conservative half-plane rejection: keep every cell that could contain
    // any visible triangle point, including subpixel limbs and clipped edges.
    public bool MayIntersectSquare(float x, float y, float halfSize)
    {
        if (!IsValid || halfSize < 0 || !float.IsFinite(halfSize))
            return false;
        float dx = x-_origin.X, dy = y-_origin.Y;
        float a = _firstX*dx + _firstY*dy;
        float b = _secondX*dx + _secondY*dy;
        float ar = (Math.Abs(_firstX)+Math.Abs(_firstY))*halfSize;
        float br = (Math.Abs(_secondX)+Math.Abs(_secondY))*halfSize;
        float cr = (Math.Abs(_firstX+_secondX)+Math.Abs(_firstY+_secondY))*halfSize;
        return a+ar >= Tolerance && b+br >= Tolerance && 1f-a-b+cr >= Tolerance;
    }
}

// SPDX-License-Identifier: GPL-3.0-or-later
// Based on KAIDO-YONAGI/My_SpinePet @ 6690e986b4da31dc89337794bcef1b45e6531303.
// Owned source overlay; see upstream-overlays.json and docs/DESKTOP_OPTIMIZATION.md.
using System.Diagnostics;
using System.Drawing;

namespace SpinePet.Rendering.Native;

internal static class NativeSilhouetteRasterizer
{
    internal const int CellSize = 8;
    internal const int FallbackMargin = 12;
    internal const int MaxRunsPerCharacter = 400;
    private const int MaxCells = 16384;
    private const int MaxCellSize = 128;
    private const float AnchorEpsilonPixels = 2f;
    private static readonly TimeSpan RefreshInterval =
        TimeSpan.FromMilliseconds(100);

    [ThreadStatic]
    private static SilhouetteScratch? _scratchCache;

    internal static bool NeedsRefresh(
        NativeCharacterState state,
        float anchorX,
        float anchorY,
        float pixelScale,
        long nowTimestamp)
    {
        if (!state.HasCachedSilhouette)
            return true;

        if (Math.Abs(anchorX - state.CachedAnchorX) >=
                AnchorEpsilonPixels ||
            Math.Abs(anchorY - state.CachedAnchorY) >=
                AnchorEpsilonPixels)
        {
            return true;
        }

        if (pixelScale != state.CachedPixelScale)
            return true;

        return Stopwatch.GetElapsedTime(
            state.CachedSilhouetteTimestamp,
            nowTimestamp) >= RefreshInterval;
    }

    internal static void CopyToCache(
        NativeCharacterState state,
        IReadOnlyList<Rectangle> runs)
    {
        state.CachedSilhouetteRuns.Clear();
        foreach (Rectangle run in runs)
            state.CachedSilhouetteRuns.Add(run);
    }

    internal static IReadOnlyList<Rectangle> Rasterize(
        IReadOnlyList<NativeSpineDrawBatch> batches,
        RectangleF screenBounds,
        float anchorX,
        float anchorY,
        float pivotX,
        float pivotY,
        float pixelScale,
        int windowLeft,
        int windowTop)
    {
        if (batches.Count == 0 ||
            screenBounds.IsEmpty ||
            pixelScale <= 0)
        {
            return Array.Empty<Rectangle>();
        }

        Rectangle clientBounds = Rectangle.FromLTRB(
            (int)Math.Floor(screenBounds.Left) - windowLeft,
            (int)Math.Floor(screenBounds.Top) - windowTop,
            (int)Math.Ceiling(screenBounds.Right) - windowLeft,
            (int)Math.Ceiling(screenBounds.Bottom) - windowTop);
        if (clientBounds.Width <= 0 || clientBounds.Height <= 0)
            return Array.Empty<Rectangle>();

        int cellSize = CellSize;
        int firstColumn;
        int lastColumn;
        int firstRow;
        int lastRow;
        while (true)
        {
            firstColumn = (int)Math.Floor(
                clientBounds.Left / (double)cellSize);
            lastColumn = (int)Math.Ceiling(
                clientBounds.Right / (double)cellSize) - 1;
            firstRow = (int)Math.Floor(
                clientBounds.Top / (double)cellSize);
            lastRow = (int)Math.Ceiling(
                clientBounds.Bottom / (double)cellSize) - 1;
            int columnCount = lastColumn - firstColumn + 1;
            int rowCount = lastRow - firstRow + 1;
            if (columnCount <= 0 || rowCount <= 0)
                return Array.Empty<Rectangle>();
            if ((long)columnCount * rowCount <= MaxCells ||
                cellSize >= MaxCellSize)
            {
                break;
            }

            cellSize *= 2;
        }

        if ((long)(lastColumn - firstColumn + 1) *
                (lastRow - firstRow + 1) > MaxCells)
        {
            return CreateFallbackRegion(clientBounds);
        }

        SilhouetteScratch scratch = _scratchCache ??= new();
        scratch.Triangles.Clear();
        BuildTriangles(batches, scratch.Triangles);
        if (scratch.Triangles.Count == 0)
            return Array.Empty<Rectangle>();

        int columnTotal = lastColumn - firstColumn + 1;
        int rowTotal = lastRow - firstRow + 1;
        scratch.EnsureGridCapacity(columnTotal * rowTotal);
        Array.Clear(scratch.Grid, 0, columnTotal * rowTotal);

        foreach (SilhouetteTriangle triangle in scratch.Triangles)
        {
            float minClientX =
                anchorX + (triangle.MinX - pivotX) * pixelScale -
                windowLeft;
            float maxClientX =
                anchorX + (triangle.MaxX - pivotX) * pixelScale -
                windowLeft;
            float minClientY =
                anchorY + (triangle.MinY - pivotY) * pixelScale -
                windowTop;
            float maxClientY =
                anchorY + (triangle.MaxY - pivotY) * pixelScale -
                windowTop;
            int triangleFirstColumn = Math.Clamp(
                (int)Math.Floor(minClientX / cellSize),
                firstColumn,
                lastColumn);
            int triangleLastColumn = Math.Clamp(
                (int)Math.Floor(maxClientX / cellSize),
                firstColumn,
                lastColumn);
            int triangleFirstRow = Math.Clamp(
                (int)Math.Floor(minClientY / cellSize),
                firstRow,
                lastRow);
            int triangleLastRow = Math.Clamp(
                (int)Math.Floor(maxClientY / cellSize),
                firstRow,
                lastRow);
            for (int row = triangleFirstRow;
                 row <= triangleLastRow;
                 row++)
            {
                float skeletonY = pivotY +
                    (windowTop +
                         row * cellSize +
                         cellSize / 2f -
                         anchorY) /
                    pixelScale;
                int gridRow = row - firstRow;
                for (int column = triangleFirstColumn;
                     column <= triangleLastColumn;
                     column++)
                {
                    int gridIndex =
                        gridRow * columnTotal + column - firstColumn;
                    if (scratch.Grid[gridIndex])
                        continue;

                    float skeletonX = pivotX +
                        (windowLeft +
                             column * cellSize +
                             cellSize / 2f -
                             anchorX) /
                        pixelScale;
                    if (!triangle.Coverage.MayIntersectSquare(
                            skeletonX, skeletonY, cellSize * 0.5f / pixelScale))
                        continue;
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
                    if (!hit)
                    {
                        float cellLeft = pivotX +
                            (windowLeft + column * cellSize - anchorX) / pixelScale;
                        float cellTop = pivotY +
                            (windowTop + row * cellSize - anchorY) / pixelScale;
                        hit = HasVisibleTriangleCellIntersection(
                            triangle, cellLeft, cellTop,
                            cellLeft + cellSize / pixelScale,
                            cellTop + cellSize / pixelScale);
                    }
                    if (hit)
                        scratch.Grid[gridIndex] = true;
                }
            }
        }

        scratch.Runs.Clear();
        List<(int Start, int End)>? mergeSpans = null;
        List<(int Start, int End)> currentSpans = scratch.CurrentSpans;
        int mergeStartRow = firstRow;
        for (int row = firstRow; row <= lastRow; row++)
        {
            currentSpans.Clear();
            int gridRow = row - firstRow;
            int runStart = int.MinValue;
            for (int column = firstColumn;
                 column <= lastColumn + 1;
                 column++)
            {
                bool visible = column <= lastColumn &&
                    scratch.Grid[
                        gridRow * columnTotal + column - firstColumn];
                if (visible)
                {
                    if (runStart == int.MinValue)
                        runStart = column;
                }
                else if (runStart != int.MinValue)
                {
                    currentSpans.Add((runStart, column));
                    runStart = int.MinValue;
                }
            }

            if (SpansEqual(mergeSpans, currentSpans))
                continue;

            FlushRuns(
                scratch.Runs,
                mergeSpans,
                mergeStartRow,
                row,
                cellSize);
            mergeSpans = currentSpans.Count == 0
                ? null
                : CopySpans(scratch, currentSpans);
            mergeStartRow = row;
            if (scratch.Runs.Count > MaxRunsPerCharacter)
                return CreateFallbackRegion(clientBounds);
        }

        FlushRuns(
            scratch.Runs,
            mergeSpans,
            mergeStartRow,
            lastRow + 1,
            cellSize);
        if (scratch.Runs.Count > MaxRunsPerCharacter)
            return CreateFallbackRegion(clientBounds);

        return scratch.Runs;
    }

    // Conservative, alpha-aware silhouette coverage for subpixel limbs.
    private static bool HasVisibleTriangleCellIntersection(
        in SilhouetteTriangle triangle,
        float left, float top, float right, float bottom)
    {
        // Only the sub-cell / narrow-mesh case needs this expensive
        // polygon fallback. Broad triangles were already sampled on the
        // regular grid, so keep large animated scenes responsive.
        float narrowLimit = (right - left) * 1.5f;
        if (triangle.MaxX - triangle.MinX > narrowLimit &&
            triangle.MaxY - triangle.MinY > narrowLimit)
            return false;
        Span<System.Numerics.Vector2> a =
            stackalloc System.Numerics.Vector2[12];
        Span<System.Numerics.Vector2> b =
            stackalloc System.Numerics.Vector2[12];
        a[0] = triangle.First.Position;
        a[1] = triangle.Second.Position;
        a[2] = triangle.Third.Position;
        int count = 3;
        for (int edge = 0; edge < 4 && count > 0; edge++)
        {
            float boundary = edge switch
            {
                0 => left,
                1 => right,
                2 => top,
                _ => bottom
            };
            bool keepGreater = edge is 0 or 2;
            bool useX = edge < 2;
            int nextCount = 0;
            System.Numerics.Vector2 previous = a[count - 1];
            float previousValue = useX ? previous.X : previous.Y;
            bool previousInside = keepGreater
                ? previousValue >= boundary : previousValue <= boundary;
            for (int k = 0; k < count; k++)
            {
                System.Numerics.Vector2 current = a[k];
                float currentValue = useX ? current.X : current.Y;
                bool currentInside = keepGreater
                    ? currentValue >= boundary : currentValue <= boundary;
                if (previousInside != currentInside)
                {
                    float denominator = currentValue - previousValue;
                    float t = Math.Abs(denominator) < 1e-12f
                        ? 0f : Math.Clamp(
                            (boundary - previousValue) / denominator, 0f, 1f);
                    b[nextCount++] = System.Numerics.Vector2.Lerp(
                        previous, current, t);
                }
                if (currentInside)
                    b[nextCount++] = current;
                previous = current;
                previousValue = currentValue;
                previousInside = currentInside;
            }
            Span<System.Numerics.Vector2> temp = a;
            a = b;
            b = temp;
            count = nextCount;
        }
        if (count == 0)
            return false;
        System.Numerics.Vector2 centroid = default;
        for (int k = 0; k < count; k++)
        {
            centroid += a[k];
            if (IsVisiblePoint(triangle, a[k].X, a[k].Y))
                return true;
            System.Numerics.Vector2 midpoint =
                (a[k] + a[(k + 1) % count]) * 0.5f;
            if (IsVisiblePoint(triangle, midpoint.X, midpoint.Y))
                return true;
        }
        centroid /= count;
        return IsVisiblePoint(triangle, centroid.X, centroid.Y);
    }

    private static List<(int Start, int End)> CopySpans(
        SilhouetteScratch scratch,
        List<(int Start, int End)> source)
    {
        scratch.CopyBuffer.Clear();
        scratch.CopyBuffer.AddRange(source);
        return scratch.CopyBuffer;
    }

    private static void FlushRuns(
        List<Rectangle> runs,
        List<(int Start, int End)>? spans,
        int startRow,
        int endRowExclusive,
        int cellSize)
    {
        if (spans == null)
            return;

        foreach ((int start, int end) in spans)
        {
            runs.Add(Rectangle.FromLTRB(
                start * cellSize,
                startRow * cellSize,
                end * cellSize,
                endRowExclusive * cellSize));
        }
    }

    private static bool SpansEqual(
        List<(int Start, int End)>? left,
        List<(int Start, int End)> right)
    {
        if (left == null || left.Count != right.Count)
            return false;

        for (int index = 0; index < left.Count; index++)
        {
            if (left[index] != right[index])
                return false;
        }

        return true;
    }

    private static void BuildTriangles(
        IReadOnlyList<NativeSpineDrawBatch> batches,
        List<SilhouetteTriangle> triangles)
    {
        foreach (NativeSpineDrawBatch batch in batches)
        {
            for (int triangle = batch.IndexCount - 3;
                 triangle >= 0;
                 triangle -= 3)
            {
                NativeSpineVertex first =
                    batch.Vertices[batch.Indices[triangle]];
                NativeSpineVertex second =
                    batch.Vertices[batch.Indices[triangle + 1]];
                NativeSpineVertex third =
                    batch.Vertices[batch.Indices[triangle + 2]];
                var candidate = new SilhouetteTriangle(first, second, third, batch.Texture);
                if (candidate.Coverage.IsValid)
                    triangles.Add(candidate);
            }
        }
    }

    private static bool IsVisiblePoint(
        in SilhouetteTriangle triangle,
        float x,
        float y)
    {
        if (x < triangle.MinX ||
            x > triangle.MaxX ||
            y < triangle.MinY ||
            y > triangle.MaxY)
        {
            return false;
        }

        if (!triangle.Coverage.TryGetWeights(
                x, y, out float firstWeight, out float secondWeight,
                out float thirdWeight))
        {
            return false;
        }

        float u =
            triangle.First.TextureCoordinate.X * firstWeight +
            triangle.Second.TextureCoordinate.X * secondWeight +
            triangle.Third.TextureCoordinate.X * thirdWeight;
        float v =
            triangle.First.TextureCoordinate.Y * firstWeight +
            triangle.Second.TextureCoordinate.Y * secondWeight +
            triangle.Third.TextureCoordinate.Y * thirdWeight;
        return triangle.Texture.IsVisiblePixel(u, v, 1f);
    }

    private static IReadOnlyList<Rectangle> CreateFallbackRegion(
        Rectangle clientBounds)
    {
        int left = (int)Math.Floor(
            (clientBounds.Left - FallbackMargin) / (double)CellSize) *
            CellSize;
        int top = (int)Math.Floor(
            (clientBounds.Top - FallbackMargin) / (double)CellSize) *
            CellSize;
        int right = (int)Math.Ceiling(
            (clientBounds.Right + FallbackMargin) / (double)CellSize) *
            CellSize;
        int bottom = (int)Math.Ceiling(
            (clientBounds.Bottom + FallbackMargin) / (double)CellSize) *
            CellSize;
        return [Rectangle.FromLTRB(left, top, right, bottom)];
    }

    private sealed class SilhouetteScratch
    {
        public List<SilhouetteTriangle> Triangles { get; } = [];
        public bool[] Grid { get; private set; } = [];
        public List<Rectangle> Runs { get; } = [];
        public List<(int Start, int End)> CurrentSpans { get; } = [];
        public List<(int Start, int End)> CopyBuffer { get; } = [];

        public void EnsureGridCapacity(int required)
        {
            if (Grid.Length >= required)
                return;

            int capacity = Grid.Length;
            while (capacity < required)
                capacity = Math.Max(required, capacity * 2);
            Grid = new bool[capacity];
        }
    }

    private readonly struct SilhouetteTriangle(
        NativeSpineVertex first,
        NativeSpineVertex second,
        NativeSpineVertex third,
        NativeTextureSource texture)
    {
        public readonly NativeSpineVertex First = first;
        public readonly NativeSpineVertex Second = second;
        public readonly NativeSpineVertex Third = third;
        public readonly NativeTextureSource Texture = texture;
        public readonly NativeTriangleCoverage Coverage =
            new(first.Position, second.Position, third.Position);
        public readonly float MinX = Math.Min(
            Math.Min(first.Position.X, second.Position.X),
            third.Position.X);
        public readonly float MinY = Math.Min(
            Math.Min(first.Position.Y, second.Position.Y),
            third.Position.Y);
        public readonly float MaxX = Math.Max(
            Math.Max(first.Position.X, second.Position.X),
            third.Position.X);
        public readonly float MaxY = Math.Max(
            Math.Max(first.Position.Y, second.Position.Y),
            third.Position.Y);
    }
}

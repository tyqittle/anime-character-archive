// SPDX-License-Identifier: GPL-3.0-or-later
// Based on KAIDO-YONAGI/My_SpinePet @ 6690e986b4da31dc89337794bcef1b45e6531303.
// Owned source overlay; see upstream-overlays.json and docs/DESKTOP_OPTIMIZATION.md.
using System.Diagnostics;
using System.Drawing;
using SpinePet.Infrastructure;

namespace SpinePet.Rendering.Native;

internal sealed class NativeFrameRenderer
{
    private const double PerformanceWindowSeconds = 2;

    private readonly NativeCharacterScene _scene;
    private readonly NativeRenderSession _session;
    private readonly NativeInputRegionCoordinator _inputRegions;
    private readonly List<PendingFrame> _pendingFrames = [];
    private readonly bool _performanceTelemetryEnabled = string.Equals(
        Environment.GetEnvironmentVariable("SPINEPET_PERF_LOG"),
        "1",
        StringComparison.Ordinal);
    private bool _renderingFrame;
    private bool _compositionDirty;
    private long _performanceWindowStartTimestamp;
    private long _performanceFrameTicks;
    private long _performanceMaximumFrameTicks;
    private long _performanceAllocatedBytes;
    private int _performanceFrameCount;
    private long _diagnosticStartedTimestamp;
    private FrameMetrics _windowMetrics;
    private readonly bool _performanceTelemetryDisabled = string.Equals(
        Environment.GetEnvironmentVariable("SPINEPET_PERF_LOG"), "0",
        StringComparison.Ordinal);

    public NativeFrameRenderer(
        NativeCharacterScene scene,
        NativeRenderSession session,
        NativeInputRegionCoordinator inputRegions)
    {
        _scene = scene;
        _session = session;
        _inputRegions = inputRegions;
    }

    public void MarkCompositionDirty() => _compositionDirty = true;

    public void UpdateSurfacePosition(NativeCharacterState state)
    {
        NativeCompositionWindow? window = _session.Window;
        if (window == null || state.Surface == null)
            return;

        state.Surface.SetAnchorPosition(
            NativeInputRegionCoordinator.ToClientPixelX(
                window,
                state.Config.PositionX),
            NativeInputRegionCoordinator.ToClientPixelY(
                window,
                state.Config.PositionY));
    }

    public void ShrinkSurface(NativeCharacterState state)
    {
        NativeCompositionWindow? window = _session.Window;
        if (window == null || state.Surface == null)
            return;

        state.Surface.ShrinkToScale(
            state.Envelope,
            state.PivotX,
            state.PivotY,
            (float)state.CurrentScale * window.DpiScale);
    }

    public void RenderFrame(
        double elapsedSeconds,
        bool pointerDragging,
        Action flushPendingPointerMove,
        int targetFrameRate)
    {
        NativeGraphicsDevice? graphics = _session.Graphics;
        NativeCompositionWindow? window = _session.Window;
        if (_renderingFrame || graphics == null || window == null)
            return;

        long frameStartedTimestamp = Stopwatch.GetTimestamp();
        if (_diagnosticStartedTimestamp == 0)
            _diagnosticStartedTimestamp = frameStartedTimestamp;
        bool measure = !_performanceTelemetryDisabled &&
            (_performanceTelemetryEnabled || Stopwatch.GetElapsedTime(
                _diagnosticStartedTimestamp, frameStartedTimestamp).TotalSeconds < 30);
        FrameMetrics metrics = default;
        long phaseStarted = 0;
        long frameStartedAllocatedBytes = measure
            ? GC.GetAllocatedBytesForCurrentThread()
            : 0;
        _renderingFrame = true;
        try
        {
            flushPendingPointerMove();
            _pendingFrames.Clear();
            foreach (NativeCharacterState state in _scene.States)
            {
                if (!state.IsVisible ||
                    state.Resource == null ||
                    state.Surface == null)
                {
                    continue;
                }

                float animationSpeed =
                    (float)state.Config.AnimationSpeed;
                if (state.Resource.AnimationState.TimeScale !=
                    animationSpeed)
                {
                    state.Resource.AnimationState.TimeScale =
                        animationSpeed;
                }

                if (measure) phaseStarted = Stopwatch.GetTimestamp();
                state.Resource.Update((float)elapsedSeconds);
                if (measure)
                {
                    long now = Stopwatch.GetTimestamp();
                    metrics.Animation += now - phaseStarted;
                    phaseStarted = now;
                }
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
                if (measure)
                {
                    long now = Stopwatch.GetTimestamp();
                    metrics.Geometry += now - phaseStarted;
                    phaseStarted = now;
                }
                int beforeRecreate = state.Surface.RecreationCount;
                float pixelScale =
                    (float)state.CurrentScale * window.DpiScale;
                state.Surface.EnsureSize(
                    state.Envelope,
                    state.PivotX,
                    state.PivotY,
                    pixelScale);
                UpdateSurfacePosition(state);
                UpdateScreenBounds(
                    state,
                    window,
                    state.Geometry.Bounds,
                    pixelScale);
                if (measure)
                {
                    metrics.Surface += Stopwatch.GetTimestamp() - phaseStarted;
                    metrics.Recreates += state.Surface.RecreationCount - beforeRecreate;
                    metrics.SurfacePixels += (long)state.Surface.PixelWidth * state.Surface.PixelHeight;
                }
                state.LastBatches = plan.Batches;
                _pendingFrames.Add(new PendingFrame(
                    state,
                    plan,
                    pixelScale));
            }

            int appliedBefore = _inputRegions.RegionApplyCount;
            int reusedBefore = _inputRegions.RegionReuseCount;
            if (measure) phaseStarted = Stopwatch.GetTimestamp();
            _inputRegions.Update(
                _session,
                _scene.States,
                pointerDragging);
            if (measure)
            {
                long now = Stopwatch.GetTimestamp();
                metrics.Input += now - phaseStarted;
                metrics.RegionApplies += _inputRegions.RegionApplyCount - appliedBefore;
                metrics.RegionReuses += _inputRegions.RegionReuseCount - reusedBefore;
                phaseStarted = now;
            }
            foreach (PendingFrame frame in _pendingFrames)
            {
                graphics.Render(
                    frame.State.Surface!,
                    frame.Plan,
                    frame.State.Surface!.GetTransform(frame.PixelScale));
            }

            if (measure)
            {
                long now = Stopwatch.GetTimestamp();
                metrics.Draw += now - phaseStarted;
                phaseStarted = now;
            }
            bool rendered = _pendingFrames.Count > 0;
            if (rendered || _compositionDirty)
            {
                graphics.Commit();
                _compositionDirty = false;
            }
            if (measure) metrics.Commit += Stopwatch.GetTimestamp() - phaseStarted;
        }
        catch (Exception exception)
        {
            AppLogger.Write(
                nameof(NativeCharacterRenderHost),
                $"frame-failed message={exception.Message}");
        }
        finally
        {
            if (measure)
            {
                RecordPerformanceFrame(
                    frameStartedTimestamp,
                    frameStartedAllocatedBytes,
                    _pendingFrames.Count,
                    targetFrameRate, in metrics);
            }

            _pendingFrames.Clear();
            _renderingFrame = false;
        }
    }

    public void Commit()
    {
        _session.Commit();
        _compositionDirty = false;
    }

    public void PurgeUnusedTextures()
    {
        NativeGraphicsDevice? graphics = _session.Graphics;
        if (graphics == null)
            return;

        HashSet<string> activePaths =
            CollectRetainedTexturePaths(_scene.States);
        graphics.PurgeTextures(activePaths);
    }

    internal static HashSet<string> CollectRetainedTexturePaths(
        IEnumerable<NativeCharacterState> states)
    {
        HashSet<string> paths =
            new(StringComparer.OrdinalIgnoreCase);
        foreach (NativeCharacterState state in states)
        {
            if (state.Resource != null)
            {
                AddTexturePaths(paths, state.Resource);
            }

            foreach (NativeCharacterLoadResult slot in
                     state.ResourceSlots.Values)
            {
                AddTexturePaths(paths, slot.Resource);
            }
        }

        return paths;
    }

    private static void AddTexturePaths(
        HashSet<string> paths,
        NativeSpineResource resource)
    {
        foreach (NativeTextureSource texture in
                 resource.TextureLoader.Textures)
        {
            paths.Add(texture.Path);
        }
    }

    private static void UpdateScreenBounds(
        NativeCharacterState state,
        NativeCompositionWindow window,
        NativeSpineBounds bounds,
        float pixelScale)
    {
        float anchorX =
            window.Left +
            NativeInputRegionCoordinator.ToClientPixelX(
                window,
                state.Config.PositionX);
        float anchorY =
            window.Top +
            NativeInputRegionCoordinator.ToClientPixelY(
                window,
                state.Config.PositionY);
        state.PreviousRenderRegionBounds =
            state.RenderRegionBounds;
        if (bounds.IsEmpty)
        {
            state.ScreenBounds = RectangleF.Empty;
            state.RenderRegionBounds = RectangleF.Empty;
            return;
        }

        state.ScreenBounds = RectangleF.FromLTRB(
            anchorX + (bounds.Left - state.PivotX) * pixelScale,
            anchorY + (bounds.Top - state.PivotY) * pixelScale,
            anchorX + (bounds.Right - state.PivotX) * pixelScale,
            anchorY + (bounds.Bottom - state.PivotY) * pixelScale);
        state.RenderRegionBounds =
            NativeInputRegionCoordinator.GetSurfaceScreenBounds(
                state.Surface,
                anchorX,
                anchorY);
    }

    private void RecordPerformanceFrame(
        long frameStartedTimestamp,
        long frameStartedAllocatedBytes,
        int visibleCharacterCount,
        int targetFrameRate, in FrameMetrics metrics)
    {
        _windowMetrics.Add(in metrics);
        long completedTimestamp = Stopwatch.GetTimestamp();
        long frameTicks = completedTimestamp - frameStartedTimestamp;
        long allocatedBytes = Math.Max(
            0,
            GC.GetAllocatedBytesForCurrentThread() -
            frameStartedAllocatedBytes);
        if (_performanceWindowStartTimestamp == 0)
            _performanceWindowStartTimestamp = frameStartedTimestamp;

        _performanceFrameCount++;
        _performanceFrameTicks += frameTicks;
        _performanceMaximumFrameTicks = Math.Max(
            _performanceMaximumFrameTicks,
            frameTicks);
        _performanceAllocatedBytes += allocatedBytes;

        double windowSeconds =
            (completedTimestamp - _performanceWindowStartTimestamp) /
            (double)Stopwatch.Frequency;
        if (windowSeconds < PerformanceWindowSeconds)
            return;

        double actualFrameRate = _performanceFrameCount / windowSeconds;
        double averageFrameMilliseconds =
            _performanceFrameTicks * 1000.0 /
            Stopwatch.Frequency /
            _performanceFrameCount;
        double maximumFrameMilliseconds =
            _performanceMaximumFrameTicks * 1000.0 /
            Stopwatch.Frequency;
        long allocatedBytesPerFrame =
            _performanceAllocatedBytes / _performanceFrameCount;
        AppLogger.Write(
            nameof(NativeCharacterRenderHost),
            $"performance target-fps={targetFrameRate} " +
            $"actual-fps={actualFrameRate:F2} " +
            $"visible={visibleCharacterCount} " +
            $"avg-frame-ms={averageFrameMilliseconds:F3} " +
            $"max-frame-ms={maximumFrameMilliseconds:F3} " +
            $"allocated-bytes-per-frame={allocatedBytesPerFrame} " +
            $"animation-ms={PhaseMilliseconds(_windowMetrics.Animation):F3} " +
            $"geometry-ms={PhaseMilliseconds(_windowMetrics.Geometry):F3} " +
            $"surface-ms={PhaseMilliseconds(_windowMetrics.Surface):F3} " +
            $"input-ms={PhaseMilliseconds(_windowMetrics.Input):F3} " +
            $"cpu-submit-ms={PhaseMilliseconds(_windowMetrics.Draw):F3} " +
            $"commit-ms={PhaseMilliseconds(_windowMetrics.Commit):F3} " +
            $"surface-recreates={_windowMetrics.Recreates} " +
            $"region-applies={_windowMetrics.RegionApplies} " +
            $"region-reuses={_windowMetrics.RegionReuses} " +
            $"avg-surface-pixels={_windowMetrics.SurfacePixels / _performanceFrameCount}");

        _performanceWindowStartTimestamp = completedTimestamp;
        _performanceFrameTicks = 0;
        _performanceMaximumFrameTicks = 0;
        _performanceAllocatedBytes = 0;
        _performanceFrameCount = 0;
        _windowMetrics = default;
    }

    private double PhaseMilliseconds(long ticks) =>
        ticks * 1000.0 / Stopwatch.Frequency / Math.Max(1, _performanceFrameCount);

    private struct FrameMetrics
    {
        public long Animation, Geometry, Surface, Input, Draw, Commit, SurfacePixels;
        public int Recreates, RegionApplies, RegionReuses;
        public void Add(in FrameMetrics other)
        {
            Animation += other.Animation; Geometry += other.Geometry;
            Surface += other.Surface; Input += other.Input;
            Draw += other.Draw; Commit += other.Commit;
            SurfacePixels += other.SurfacePixels;
            Recreates += other.Recreates;
            RegionApplies += other.RegionApplies; RegionReuses += other.RegionReuses;
        }
    }

    private readonly record struct PendingFrame(
        NativeCharacterState State,
        NativeFrameRenderPlan Plan,
        float PixelScale);
}

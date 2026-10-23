// SPDX-License-Identifier: GPL-3.0-or-later
using System.Diagnostics;
using System.Drawing;
using System.Numerics;
using SpinePet.Models;
using SpinePet.Rendering.Native;
using Xunit;

namespace SpinePet.Tests;

public sealed class ArchiveDesktopPerformanceTests
{
    [Fact]
    public void GrowingEnvelopeUsesExistingHeadroomWithoutDroppingAnySide()
    {
        var grown = new NativeSpineBounds(-110, -220, 110, 220);
        Assert.True(NativeSurfaceSizing.Contains(grown, 0, 0, 1, 240, 480, 120, 240));
        // Previous code checked the reservation scale and discarded usable headroom.
        Assert.False(NativeSurfaceSizing.Contains(grown, 0, 0, 1.2f, 240, 480, 120, 240));
        foreach (var overflow in new[] {
            new NativeSpineBounds(-121,-200,100,200),
            new NativeSpineBounds(-100,-200,121,200),
            new NativeSpineBounds(-100,-241,100,200),
            new NativeSpineBounds(-100,-200,100,241) })
            Assert.False(NativeSurfaceSizing.Contains(overflow, 0, 0, 1, 240, 480, 120, 240));
        Assert.False(NativeSurfaceSizing.Contains(grown, 0, 0, float.NaN, 240, 480, 120, 240));
        Assert.False(NativeSurfaceSizing.Contains(NativeSpineBounds.Empty, 0, 0, 1, 240, 480, 120, 240));
    }

    [Fact]
    public void RepeatedInputMasksApplyOnceAndWindowReplacementStillApplies()
    {
        var snapshot = new NativeInputRegionSnapshot();
        object owner = new();
        var regions = new List<Rectangle> { new(4,8,24,80), new(40,8,16,96) };
        int applies = 0;
        for (int i = 0; i < 1000; i++)
        {
            if (snapshot.IsCurrent(owner, regions)) continue;
            applies++;
            snapshot.RecordApplied(owner, regions);
        }
        Assert.Equal(1, applies);
        regions[1] = new Rectangle(40,8,16,104);
        Assert.False(snapshot.IsCurrent(owner, regions));
        // A failed native call must NOT be recorded as successfully applied.
        Assert.False(snapshot.IsCurrent(owner, regions));
        snapshot.RecordApplied(owner, regions);
        Assert.True(snapshot.IsCurrent(owner, regions));
        Assert.False(snapshot.IsCurrent(new object(), regions));
        regions.Clear();
        Assert.False(snapshot.IsCurrent(owner, regions));
        snapshot.RecordApplied(owner, regions);
        Assert.True(snapshot.IsCurrent(owner, regions));
    }

    [Fact]
    public void CachedTriangleCoefficientsMatchOriginalWeights()
    {
        var random = new Random(280923);
        for (int i = 0; i < 10000; i++)
        {
            Vector2 a = Point(random), b = Point(random), c = Point(random);
            var coverage = new NativeTriangleCoverage(a,b,c);
            float x = (float)random.NextDouble()*400-200;
            float y = (float)random.NextDouble()*400-200;
            bool reference = NativeTriangleMath.TryGetBarycentric(x,y,a,b,c,
                out float wa, out float wb, out float wc);
            reference &= x >= Math.Min(a.X,Math.Min(b.X,c.X)) &&
                x <= Math.Max(a.X,Math.Max(b.X,c.X)) &&
                y >= Math.Min(a.Y,Math.Min(b.Y,c.Y)) &&
                y <= Math.Max(a.Y,Math.Max(b.Y,c.Y));
            bool cached = coverage.TryGetWeights(x,y,out float ca,out float cb,out float cc);
            Assert.Equal(reference,cached);
            if (!reference) continue;
            Assert.InRange(Math.Abs(ca-wa),0,0.0001f);
            Assert.InRange(Math.Abs(cb-wb),0,0.0001f);
            Assert.InRange(Math.Abs(cc-wc),0,0.0001f);
        }
        Assert.False(new NativeTriangleCoverage(Vector2.Zero,Vector2.One,new(2,2)).IsValid);
    }

    [Fact]
    public void CellRejectionKeepsThinAndEdgeCrossingTriangles()
    {
        var random = new Random(1314);
        foreach (float halfSize in new[] { 0.25f, 4f, 16f, 400f })
        for (int i = 0; i < 2000; i++)
        {
            Vector2 a = Point(random), b = Point(random), c = Point(random);
            var triangle = new NativeTriangleCoverage(a,b,c);
            if (!triangle.IsValid) continue;
            float u = (float)random.NextDouble(), v = (float)random.NextDouble()*(1-u);
            Vector2 inside = a*u+b*v+c*(1-u-v);
            float x = MathF.Floor(inside.X/(halfSize*2))*halfSize*2+halfSize;
            float y = MathF.Floor(inside.Y/(halfSize*2))*halfSize*2+halfSize;
            Assert.True(triangle.MayIntersectSquare(x,y,halfSize));
        }
        var limb = new NativeTriangleCoverage(new(0.001f,0),new(0.002f,1000),new(0.003f,0));
        Assert.True(limb.MayIntersectSquare(4,500,4));
        Assert.False(limb.MayIntersectSquare(40,500,4));
        var broad = new NativeTriangleCoverage(new(0,0),new(100,0),new(0,100));
        int rejected = 0;
        for (int y=4; y<100; y+=8)
        for (int x=4; x<100; x+=8)
            if (!broad.MayIntersectSquare(x,y,4)) rejected++;
        Assert.True(rejected >= 45, "Reject empty triangular bounding-box cells before alpha sampling");
    }

    [Fact]
    public void RealAnimatedBd2SilhouetteReportsCpuCostAcrossFrames()
    {
        string directory = Environment.GetEnvironmentVariable("SPINEPET_BD2_TEST_DIR")
            ?? throw new InvalidOperationException("Real pinned BD2 fixture is required");
        using var resource = NativeSpineResource.Load(new CharacterConfig {
            SkeletonPath=Path.Combine(directory,"char000201.skel"),
            AtlasPath=Path.Combine(directory,"char000201.atlas") });
        string idle = resource.AnimationNames.First(name =>
            name.Contains("idle",StringComparison.OrdinalIgnoreCase));
        resource.SetAnimation(idle,repeat:true);
        var geometry = new NativeSpineGeometry();
        var (setup,_) = NativeSpineEnvelopeCalculator.Calculate(resource.SkeletonData);
        float px=(setup.Left+setup.Right)*0.5f, py=setup.Bottom;
        var timings = new List<double>();
        long allocated=0;
        for (int i=0; i<16; i++)
        {
            resource.Update(1f/30);
            var batches = geometry.Build(resource.Skeleton);
            var bounds=geometry.Bounds;
            float scale=650f/Math.Max(1,bounds.Height);
            var screen=RectangleF.FromLTRB(
                920+(bounds.Left-px)*scale,780+(bounds.Top-py)*scale,
                920+(bounds.Right-px)*scale,780+(bounds.Bottom-py)*scale);
            long before=GC.GetAllocatedBytesForCurrentThread();
            long started=Stopwatch.GetTimestamp();
            var runs=NativeSilhouetteRasterizer.Rasterize(
                batches,screen,920,780,px,py,scale,0,0);
            double ms=Stopwatch.GetElapsedTime(started).TotalMilliseconds;
            Assert.NotEmpty(runs);
            if (i<4) continue; // warm the reusable scratch buffers and JIT
            timings.Add(ms);
            allocated+=GC.GetAllocatedBytesForCurrentThread()-before;
        }
        timings.Sort();
        Console.WriteLine(
            $"BD2 CPU silhouette samples={timings.Count} avg-ms={timings.Average():F3} " +
            $"p95-ms={timings[(int)Math.Ceiling(timings.Count*0.95)-1]:F3} " +
            $"allocated-bytes-per-sample={allocated/timings.Count}");
    }

    [Fact]
    public void RealCompositionSurfaceReusesGrowthHeadroomAndExpandsBeforeClipping()
    {
        using NativeCompositionWindow window = new();
        using NativeGraphicsDevice graphics = new(window.Handle);
        using NativeCompositionSurface surface = graphics.CreateSurface();
        surface.EnsureSize(new(-100,-200,100,200),0,0,1);
        Assert.Equal(1,surface.RecreationCount);
        for (int i=0; i<100; i++)
        {
            float extra=i*0.18f;
            surface.EnsureSize(new(-100-extra,-200-extra,100+extra,200+extra),0,0,1);
        }
        Assert.Equal(1,surface.RecreationCount);
        var shifted = new NativeSpineBounds(-100,-200,150,200);
        surface.EnsureSize(shifted,0,0,1);
        Assert.Equal(2,surface.RecreationCount);
        Assert.True(NativeSurfaceSizing.Contains(shifted,0,0,1,
            surface.PixelWidth,surface.PixelHeight,surface.AnchorPixelX,surface.AnchorPixelY));
        // Actual native clear/readback continues to preserve premultiplied alpha.
        var frame=graphics.RenderAndReadback(surface,NativeFrameRenderPlan.Create([]),
            surface.GetTransform(1));
        Assert.All(frame.BgraPixels,value=>Assert.Equal(0,value));
    }

    [Fact]
    public async Task RealInputWindowSkipsUnchangedMaskButAppliesChangedPixels()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("windir")))
            Environment.SetEnvironmentVariable("windir",
                Environment.GetEnvironmentVariable("SystemRoot"));
        using NativeRenderSession session = new();
        await session.Initialize((_,_,_)=>{});
        var window=session.Window!;
        var config=new CharacterConfig {
            PositionX=System.Windows.SystemParameters.VirtualScreenLeft+100/window.DpiScale,
            PositionY=System.Windows.SystemParameters.VirtualScreenTop+100/window.DpiScale };
        // Keep a controlled fresh silhouette throughout this native-apply test.
        // This separates region submission from the independently tested 100ms clock.
        var state=new NativeCharacterState {
            Config=config, IsVisible=true, CurrentScale=1, HasCachedSilhouette=true,
            CachedAnchorX=window.Left+100,CachedAnchorY=window.Top+100,
            CachedPixelScale=window.DpiScale,
            CachedSilhouetteTimestamp=Stopwatch.GetTimestamp()+Stopwatch.Frequency*60 };
        state.CachedSilhouetteRuns.Add(new Rectangle(100,100,80,120));
        var coordinator=new NativeInputRegionCoordinator();
        coordinator.Update(session,[state],false);
        Assert.Equal(1,coordinator.RegionApplyCount);
        state.CachedSilhouetteTimestamp++;
        coordinator.Update(session,[state],false);
        Assert.Equal(2,coordinator.RegionRebuildCount);
        Assert.Equal(1,coordinator.RegionApplyCount);
        Assert.Equal(1,coordinator.RegionReuseCount);
        state.CachedSilhouetteRuns[0]=new Rectangle(100,100,80,140);
        state.CachedSilhouetteTimestamp++;
        coordinator.Update(session,[state],false);
        Assert.Equal(2,coordinator.RegionApplyCount);
        coordinator.Update(session,[],false);
        Assert.Equal(3,coordinator.RegionApplyCount);
    }

    private static Vector2 Point(Random r) =>
        new((float)r.NextDouble()*400-200,(float)r.NextDouble()*400-200);
}

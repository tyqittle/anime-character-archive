// SPDX-License-Identifier: GPL-3.0-or-later
// Release-gating regression exercised with ACTUAL pinned BD2 costume assets,
// not with placeholder silhouettes, synthetic rectangles or source-string tests.
using System.Drawing;
using SpinePet.Models;
using SpinePet.Rendering.Native;
using Xunit;

namespace SpinePet.Tests;

public sealed class ArchiveDesktopFullBodyTests
{
    [Fact]
    public void CombinedSkinSetupBoundsAndMouseMaskCoverRealBd2LowerBody()
    {
        string directory = Environment.GetEnvironmentVariable("SPINEPET_BD2_TEST_DIR")
            ?? throw new InvalidOperationException(
                "CI must provide an actual downloaded BD2 test character");
        string skel = Path.Combine(directory, "char000201.skel");
        string atlas = Path.Combine(directory, "char000201.atlas");
        Assert.True(File.Exists(skel), "Real BD2 skeleton missing");
        Assert.True(File.Exists(atlas), "Real BD2 atlas missing");

        using var resource = NativeSpineResource.Load(new CharacterConfig
        {
            SkeletonPath = skel,
            AtlasPath = atlas
        });

        var (setup, envelope) =
            NativeSpineEnvelopeCalculator.Calculate(resource.SkeletonData);
        Assert.False(setup.IsEmpty);
        Assert.False(envelope.IsEmpty);
        NativeSpineGeometry geometry = new();

        // Previously the envelope sampler forgot to combine all outfit skins
        // while NativeSpineResource rendered all skins. Compare world
        // geometry from the ACTUAL loaded renderer against sampled bounds.
        resource.Skeleton.SetToSetupPose();
        resource.Skeleton.UpdateWorldTransform();
        geometry.Build(resource.Skeleton);
        AssertContains(setup, geometry.Bounds, 2f);
        AssertContains(envelope, geometry.Bounds, 2f);

        string? idle = resource.AnimationNames
            .FirstOrDefault(name => name.Contains("idle",
                StringComparison.OrdinalIgnoreCase))
            ?? resource.AnimationNames.FirstOrDefault();
        resource.SetAnimation(idle, repeat: true);
        resource.Update(1f / 60f);
        var batches = geometry.Build(resource.Skeleton);
        var actual = geometry.Bounds;
        Assert.False(actual.IsEmpty);
        AssertContains(envelope, actual, 2f);

        // Test the SAME alpha-mask rasterizer used for Win32 SetWindowRgn.
        // An opaque lower limb must create input-window regions in the
        // LOWER part of its real projected geometry, not just the torso.
        float scale = Math.Min(1f, 650f / Math.Max(1f, actual.Height));
        float anchorX = 920f, anchorY = 780f;
        float pivotX = (setup.Left + setup.Right) * 0.5f;
        float pivotY = setup.Bottom;
        RectangleF physical = RectangleF.FromLTRB(
            anchorX + (actual.Left - pivotX) * scale,
            anchorY + (actual.Top - pivotY) * scale,
            anchorX + (actual.Right - pivotX) * scale,
            anchorY + (actual.Bottom - pivotY) * scale);
        var regions = NativeSilhouetteRasterizer.Rasterize(
            batches, physical, anchorX, anchorY, pivotX, pivotY,
            scale, windowLeft: 0, windowTop: 0);
        Assert.NotEmpty(regions);

        float lastClickableY = regions.Max(region => region.Bottom);
        Assert.True(lastClickableY >= physical.Top + physical.Height * 0.6f,
            $"BD2 lower-body mouse region missing: visible bounds={physical}, " +
            $"last input pixel y={lastClickableY}, regions={regions.Count}");
        // The old test only required 60% of the geometric height to be
        // clickable; torso-only regions could pass while visible legs did not.
        // Instead, take REAL opaque pixels at triangle centroids, sort by
        // projected Y, and verify the lowest visible portions are in the
        // native Win32 input region at their actual desktop coordinates.
        var opaqueSamples = new List<(float X, float Y)>();
        foreach (NativeSpineDrawBatch batch in batches)
        {
            for (int index = 0; index + 2 < batch.IndexCount; index += 3)
            {
                NativeSpineVertex a = batch.Vertices[batch.Indices[index]];
                NativeSpineVertex b = batch.Vertices[batch.Indices[index + 1]];
                NativeSpineVertex c = batch.Vertices[batch.Indices[index + 2]];
                float u = (a.TextureCoordinate.X +
                    b.TextureCoordinate.X + c.TextureCoordinate.X) / 3f;
                float v = (a.TextureCoordinate.Y +
                    b.TextureCoordinate.Y + c.TextureCoordinate.Y) / 3f;
                float opacity = (a.LightColor.W + b.LightColor.W +
                    c.LightColor.W) / 3f;
                if (!batch.Texture.IsVisiblePixel(u, v, opacity))
                    continue;
                float x = (a.Position.X + b.Position.X + c.Position.X) / 3f;
                float y = (a.Position.Y + b.Position.Y + c.Position.Y) / 3f;
                opaqueSamples.Add((
                    anchorX + (x - pivotX) * scale,
                    anchorY + (y - pivotY) * scale));
            }
        }
        Assert.NotEmpty(opaqueSamples);
        foreach ((float x, float y) in opaqueSamples
            .OrderByDescending(point => point.Y).Take(64))
        {
            int px = (int)Math.Floor(x);
            int py = (int)Math.Floor(y);
            Assert.True(regions.Any(run => run.Contains(px, py)),
                $"Visible BD2 lower-body triangle passes through to the " +
                $"desktop at ({px},{py}); lastClickableY={lastClickableY:F1}");
        }
        Console.WriteLine(
            $"PASS BD2 full-body: setup={setup}, animation={actual}, " +
            $"clickableBottom={lastClickableY:F1}, " +
            $"drawnBottom={physical.Bottom:F1}, " +
            $"opaqueSamples={opaqueSamples.Count}, regionCount={regions.Count}");
    }

    private static void AssertContains(
        NativeSpineBounds parent, NativeSpineBounds child, float slack)
    {
        Assert.True(parent.Left <= child.Left + slack,
            $"Clipped left: parent={parent} child={child}");
        Assert.True(parent.Top <= child.Top + slack,
            $"Clipped top: parent={parent} child={child}");
        Assert.True(parent.Right >= child.Right - slack,
            $"Clipped right: parent={parent} child={child}");
        Assert.True(parent.Bottom >= child.Bottom - slack,
            $"Clipped lower-body: parent={parent} child={child}");
    }
}

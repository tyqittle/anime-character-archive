// SPDX-License-Identifier: GPL-3.0-or-later
using System.Drawing;

namespace SpinePet.Rendering.Native;

// Records only successfully applied regions. A replacement HWND must always
// receive its first update even if another window used the same rectangles.
internal sealed class NativeInputRegionSnapshot
{
    private object? _owner;
    private readonly List<Rectangle> _regions = [];
    public bool IsCurrent(object owner, IReadOnlyList<Rectangle> regions)
    {
        if (!ReferenceEquals(_owner, owner) || _regions.Count != regions.Count)
            return false;
        for (int i = 0; i < regions.Count; i++)
            if (_regions[i] != regions[i]) return false;
        return true;
    }
    public void RecordApplied(object owner, IReadOnlyList<Rectangle> regions)
    {
        _regions.Clear();
        for (int i = 0; i < regions.Count; i++) _regions.Add(regions[i]);
        _owner = owner;
    }
}

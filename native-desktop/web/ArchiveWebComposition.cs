// SPDX-License-Identifier: GPL-3.0-or-later
using System.Runtime.InteropServices;
using Vortice.Direct3D;
using Vortice.Direct3D11;
using Vortice.DirectComposition;
using Vortice.DXGI;
using static Vortice.Direct3D11.D3D11;
namespace SpinePet;

// A real GPU composition visual. Web pixels never become a window-shaped bitmap.
internal sealed class ArchiveWebComposition : IDisposable
{
    private ID3D11Device? _device;
    private IDXGIDevice? _dxgi;
    private IDCompositionDevice? _composition;
    private IDCompositionTarget? _target;
    private IDCompositionVisual? _visual;
    private object? _visualTarget;
    public object VisualTarget => _visualTarget ?? throw new ObjectDisposedException(nameof(ArchiveWebComposition));
    public ArchiveWebComposition(IntPtr hwnd)
    {
        try
        {
            _device=D3D11CreateDevice(DriverType.Hardware,DeviceCreationFlags.BgraSupport,
                [FeatureLevel.Level_11_1,FeatureLevel.Level_11_0,FeatureLevel.Level_10_1,FeatureLevel.Level_10_0]);
            _dxgi=_device.QueryInterface<IDXGIDevice>();
            _composition=DComp.DCompositionCreateDevice<IDCompositionDevice>(_dxgi);
            _composition.CreateTargetForHwnd(hwnd,true,out var target).CheckError();
            _target=target;_visual=_composition.CreateVisual();
            _target.SetRoot(_visual).CheckError();
            _visualTarget=Marshal.GetObjectForIUnknown(_visual.NativePointer);
            Commit();
        }
        catch { Dispose();throw; }
    }
    public void Commit() => _composition?.Commit().CheckError();
    public void Dispose()
    {
        if (_visualTarget != null && Marshal.IsComObject(_visualTarget))
            Marshal.ReleaseComObject(_visualTarget);
        _visualTarget=null;
        _visual?.Dispose();_visual=null;
        _target?.Dispose();_target=null;
        _composition?.Dispose();_composition=null;
        _dxgi?.Dispose();_dxgi=null;
        _device?.Dispose();_device=null;
    }
}

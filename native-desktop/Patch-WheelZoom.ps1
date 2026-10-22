# SPDX-License-Identifier: GPL-3.0-or-later
# Enable native mouse-wheel zoom through My_SpinePet's existing scale API.
# Does not replace the upstream render engine or alter the visual alpha pipeline.
param([Parameter(Mandatory=$true)][string]$UpstreamRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$native = Join-Path $UpstreamRoot 'SpinePet/src/SpinePet/Rendering/Native'
function ReplaceOnce([string]$file,[string]$from,[string]$to){
    $value=[System.IO.File]::ReadAllText($file)
    $matches=[regex]::Matches($value,[regex]::Escape($from))
    if($matches.Count -ne 1){throw "Expected exactly 1 scale hook in $file; got $($matches.Count): $from"}
    $value=$value.Replace($from,$to)
    [System.IO.File]::WriteAllText($file,$value,[System.Text.UTF8Encoding]::new($false))
}
$input = Join-Path $native 'NativeInputWindow.cs'
ReplaceOnce $input 'private const uint WmMouseMove = 0x0200;' 'private const uint WmMouseMove = 0x0200;
    private const uint WmMouseWheel = 0x020A;'
ReplaceOnce $input 'public Action<uint, int, int>? MouseInput { get; set; }' 'public Action<uint, int, int>? MouseInput { get; set; }
    public Action<int, int, int>? MouseWheelInput { get; set; }'
ReplaceOnce $input 'if (message == WmLeftButtonDown ||
                    message == WmRightButtonDown ||' 'if (message == WmMouseWheel)
                {
                    GetCursorPos(out NativePoint wheelPoint);
                    int wheelDelta = unchecked((short)((wParam.ToInt64() >> 16) & 0xffff));
                    if (wheelDelta != 0)
                        instance.MouseWheelInput?.Invoke(wheelDelta, wheelPoint.X, wheelPoint.Y);
                    return IntPtr.Zero;
                }

                if (message == WmLeftButtonDown ||
                    message == WmRightButtonDown ||'
ReplaceOnce $input 'MouseInput = null;' 'MouseInput = null;
        MouseWheelInput = null;'

$session=Join-Path $native 'NativeRenderSession.cs'
ReplaceOnce $session 'Initialize(Action<uint, int, int> mouseInput)' 'Initialize(Action<uint, int, int> mouseInput, Action<int, int, int> mouseWheelInput)'
ReplaceOnce $session 'MouseInput = mouseInput' 'MouseInput = mouseInput,
                MouseWheelInput = mouseWheelInput'
ReplaceOnce $session 'InputWindow.MouseInput = null;' 'InputWindow.MouseInput = null;
        if (InputWindow != null)
            InputWindow.MouseWheelInput = null;'

$engine=Join-Path $native 'NativeCharacterRenderEngine.cs'
ReplaceOnce $engine 'return _session.Initialize(OnNativeMouseInput);' 'return _session.Initialize(OnNativeMouseInput, OnNativeMouseWheel);'
ReplaceOnce $engine 'private void OnNativeMouseInput(uint message, int x, int y)' 'private void OnNativeMouseWheel(int delta, int x, int y)
    {
        if (_closed || delta == 0)
            return;

        if (!NativeCharacterHitTester.TryHit(_scene, _session.Window, x, y,
                out NativeCharacterState? character) || character == null)
            return;
        // Windows sends wheel delta in units of 120. Support high-resolution
        // wheels without allowing huge unexpected jumps or zero-sized scale.
        double ticks = Math.Clamp((double)delta / 120.0, -3, 3);
        double factor = Math.Pow(1.15, ticks);
        SetCharacterScale(character.Config.Id, character.CurrentScale * factor);
    }

    private void OnNativeMouseInput(uint message, int x, int y)'
ReplaceOnce $engine '_session.InputWindow.MouseInput = null;' '_session.InputWindow.MouseInput = null;
        if (_session.InputWindow != null)
            _session.InputWindow.MouseWheelInput = null;'
Write-Host 'Native SpinePet existing zoom API wired to mouse wheel on character.'

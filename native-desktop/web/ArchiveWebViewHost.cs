// SPDX-License-Identifier: GPL-3.0-or-later
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using SpinePet.Infrastructure;
using SpinePet.Rendering.Native;
using Forms=System.Windows.Forms;

namespace SpinePet;

// UI-thread-owned composition controller and separate input window.
// Only registered model identities cross the protocol; no arbitrary website URL.
internal sealed class ArchiveWebViewHost : IDisposable
{
    private readonly ArchiveWebSelection _selection;
    private readonly Uri _site;
    private readonly string _session=Guid.NewGuid().ToString("N");
    private readonly TaskCompletionSource<bool> _ready=new(TaskCreationOptions.RunContinuationsAsynchronously);
    private NativeCompositionWindow? _window;
    private NativeInputWindow? _input;
    private ArchiveWebComposition? _composition;
    private CoreWebView2CompositionController? _controller;
    private Forms.ContextMenuStrip? _menu;
    private readonly List<(string Id,string Label)> _actions=[];
    private bool _pressed,_disposed,_visible=true,_voice;
    internal int MaskCount { get; private set; }
    internal int InputApplyCount => _input?.RegionApplyCount ?? 0;
    internal string ReadyEngine { get; private set; }="";
    internal string ReadyName { get; private set; }="";
    internal Task Ready => _ready.Task;
    internal CoreWebView2? Core => _controller?.CoreWebView2;
    internal NativeCompositionWindow? Window => _window;
    internal IntPtr InputHandle => _input?.Handle ?? IntPtr.Zero;
    public event Action? HiddenByUser;
    public ArchiveWebViewHost(ArchiveWebSelection selection,Uri? site=null)
    { _selection=selection;_site=site??ArchiveWebSelection.Site; }

    public async Task OpenAsync(string profileDirectory,CancellationToken cancellation,string? publicTestDirectory=null)
    {
        if (!_selection.IsValid) throw new ArgumentException("Invalid catalog identity");
        try
        {
            await ArchiveWebRuntime.EnsureAsync(cancellation);
            cancellation.ThrowIfCancellationRequested();
            _window=new NativeCompositionWindow();
            _input=new NativeInputWindow(_window.Left,_window.Top,_window.Width,_window.Height);
            _input.ClearAndHide();
            _input.MouseInput=OnMouse;
            _input.MouseWheelInput=(delta,x,y)=>Forward(CoreWebView2MouseEventKind.Wheel,
                new Point(x-_window.Left,y-_window.Top),unchecked((uint)delta));
            _composition=new ArchiveWebComposition(_window.Handle);
            var options=new CoreWebView2EnvironmentOptions(
                additionalBrowserArguments:"--autoplay-policy=no-user-gesture-required");
            var environment=await CoreWebView2Environment.CreateAsync(
                userDataFolder:profileDirectory,options:options).WaitAsync(cancellation);
            cancellation.ThrowIfCancellationRequested();
            if (_disposed) throw new OperationCanceledException();
            var creation=environment.CreateCoreWebView2CompositionControllerAsync(_window.Handle);
            try {_controller=await creation.WaitAsync(cancellation);}
            catch
            {
                _ = creation.ContinueWith(task=>{
                    if(task.IsCompletedSuccessfully)task.Result.Close();
                    else _ = task.Exception;
                },CancellationToken.None,TaskContinuationOptions.None,
                    TaskScheduler.FromCurrentSynchronizationContext());
                throw;
            }
            _controller.DefaultBackgroundColor=Color.FromArgb(0,0,0,0);
            _controller.Bounds=new Rectangle(0,0,_window.Width,_window.Height);
            _controller.RasterizationScale=_window.DpiScale;
            _controller.BoundsMode=CoreWebView2BoundsMode.UseRawPixels;
            _controller.RootVisualTarget=_composition.VisualTarget;
            _controller.IsVisible=true;
            var web=_controller.CoreWebView2;
            web.Settings.AreDefaultContextMenusEnabled=false;
            web.Settings.AreHostObjectsAllowed=false;
            web.Settings.IsPasswordAutosaveEnabled=false;
            web.Settings.IsGeneralAutofillEnabled=false;
            web.Settings.AreDevToolsEnabled=publicTestDirectory!=null;
            web.PermissionRequested+=(_,e)=>e.State=CoreWebView2PermissionState.Deny;
            web.NewWindowRequested+=(_,e)=>e.Handled=true;
            web.DownloadStarting+=(_,e)=>e.Cancel=true;
            web.NavigationStarting+=(_,e)=>{
                if (!ArchiveWebSelection.IsPage(e.Uri,_site)) e.Cancel=true;
                _input?.ClearAndHide();
            };
            web.NavigationCompleted+=(_,e)=>{
                if (!e.IsSuccess) _ready.TrySetException(new IOException("桌宠页面加载失败："+e.WebErrorStatus));
            };
            web.ProcessFailed+=(_,e)=>{
                _input?.ClearAndHide();
                _ready.TrySetException(new IOException("网页渲染进程已停止："+e.ProcessFailedKind));
                AppLogger.Write(nameof(ArchiveWebViewHost),"web-process-failed "+e.ProcessFailedKind);
            };
            web.WebMessageReceived+=OnMessage;
            if (publicTestDirectory!=null)
            {
                if (_site.Host!="archive-desktop.test") throw new InvalidOperationException("Test mapping is isolated");
                web.SetVirtualHostNameToFolderMapping(_site.Host,publicTestDirectory,
                    CoreWebView2HostResourceAccessKind.DenyCors);
            }
            _composition.Commit();
            web.Navigate(_selection.Page(_site,_session).AbsoluteUri);
            await _ready.Task.WaitAsync(TimeSpan.FromSeconds(80),cancellation);
            AppLogger.Write(nameof(ArchiveWebViewHost),
                $"universal-playing game={_selection.Game} id={_selection.Id} engine={ReadyEngine}");
        }
        catch
        {
            if(publicTestDirectory!=null&&_controller!=null)
            {
                try
                {
                    string diagnostics=await _controller.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify({url:location.href,status:document.getElementById('status')?.textContent,bridge:window.ArchiveDesktopBridge?.inspect()})");
                    Console.WriteLine("UNIVERSAL_FAILURE "+diagnostics);
                }
                catch(Exception diagnosticError){Console.WriteLine("UNIVERSAL_DIAGNOSTIC "+diagnosticError.Message);}
            }
            Dispose();throw;
        }
    }

    private void OnMessage(object? sender,CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (_disposed||!ArchiveWebSelection.IsPage(e.Source,_site)) return;
        try
        {
            string text=e.WebMessageAsJson;
            if (text.Length>2_000_000) throw new InvalidDataException("Desktop bridge budget exceeded");
            using var document=JsonDocument.Parse(text);var data=document.RootElement;
            if (data.GetProperty("channel").GetString()!="archive-desktop-v1" ||
                data.GetProperty("session").GetString()!=_session) return;
            string kind=data.GetProperty("kind").GetString()??"";
            if (data.TryGetProperty("id",out var id)&&id.GetString()!=_selection.Id) return;
            if (kind=="error")
            {
                _input?.ClearAndHide();
                string error=data.GetProperty("error").GetString()??"模型加载失败";
                _ready.TrySetException(new InvalidDataException(error));
                AppLogger.Write(nameof(ArchiveWebViewHost),"universal-model-error "+error);
            }
            else if (kind=="ready")
            {
                if (data.GetProperty("game").GetString()!=_selection.Game) return;
                ReadyEngine=data.GetProperty("engine").GetString()??"";
                ReadyName=data.GetProperty("name").GetString()??_selection.Id;
            }
            else if (kind=="actions")
            {
                var actions=data.GetProperty("actions");
                if (actions.GetArrayLength()>4096) throw new InvalidDataException("Action menu budget exceeded");
                _actions.Clear();
                foreach(var item in actions.EnumerateArray())
                {
                    string value=item.GetProperty("id").GetString()??"";
                    string label=item.GetProperty("label").GetString()??value;
                    if (value.Length>1024||label.Length>1024) continue;
                    _actions.Add((value,label));
                }
            }
            else if (kind=="mask") ApplyMask(data);
        }
        catch(Exception error)
        {
            _input?.ClearAndHide();
            _ready.TrySetException(error);
            AppLogger.Write(nameof(ArchiveWebViewHost),"invalid-desktop-message "+error.Message);
        }
    }

    private void ApplyMask(JsonElement data)
    {
        if (_window==null||_input==null||!_visible) return;
        double width=data.GetProperty("width").GetDouble(),height=data.GetProperty("height").GetDouble();
        if (!double.IsFinite(width)||!double.IsFinite(height)||width<=0||height<=0||
            width>50000||height>50000) throw new InvalidDataException("Invalid viewport");
        var source=data.GetProperty("rects");
        if (source.GetArrayLength()>768) throw new InvalidDataException("Input region budget exceeded");
        var regions=new List<Rectangle>(source.GetArrayLength());
        foreach(var rect in source.EnumerateArray())
        {
            if(rect.GetArrayLength()!=4)throw new InvalidDataException("Invalid input rectangle");
            double x=rect[0].GetDouble(),y=rect[1].GetDouble(),w=rect[2].GetDouble(),h=rect[3].GetDouble();
            if(!double.IsFinite(x)||!double.IsFinite(y)||!double.IsFinite(w)||!double.IsFinite(h)||
                x<0||y<0||w<0||h<0||x+w>width+2||y+h>height+2)
                throw new InvalidDataException("Out-of-bounds input rectangle");
            regions.Add(Rectangle.FromLTRB(
                (int)Math.Floor(x/width*_window.Width),(int)Math.Floor(y/height*_window.Height),
                (int)Math.Ceiling((x+w)/width*_window.Width),(int)Math.Ceiling((y+h)/height*_window.Height)));
        }
        if(regions.Count==0){if(!_pressed)_input.ClearAndHide();return;}
        _input.SetInteractiveRegions(regions);_input.Show();
        // Keep the no-paint input HWND underneath the GPU visual in the same topmost band.
        SetWindowPos(_input.Handle,_window.Handle,0,0,0,0,0x0001|0x0002|0x0010);
        MaskCount++;
        if(!string.IsNullOrEmpty(ReadyEngine))_ready.TrySetResult(true);
    }

    private void Forward(CoreWebView2MouseEventKind kind,Point point,uint data=0)
    {
        if(_disposed||!_visible||_controller==null)return;
        var keys=_pressed?CoreWebView2MouseEventVirtualKeys.LeftButton:CoreWebView2MouseEventVirtualKeys.None;
        _controller.SendMouseInput(kind,keys,data,point);
    }
    private void OnMouse(uint message,int x,int y)
    {
        if(_window==null)return;
        var point=new Point(x-_window.Left,y-_window.Top);
        if(message==0x0201){_pressed=true;Forward(CoreWebView2MouseEventKind.LeftButtonDown,point);}
        else if(message==0x0202){_pressed=false;Forward(CoreWebView2MouseEventKind.LeftButtonUp,point);}
        else if(message==0x0200)Forward(CoreWebView2MouseEventKind.Move,point);
        else if(message==0x0215&&_pressed){_pressed=false;Forward(CoreWebView2MouseEventKind.LeftButtonUp,point);}
        else if(message==0x0205)ShowMenu(new Point(x,y));
    }
    public void Command(string command,string? value=null,bool enabled=false)
    {
        _controller?.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(
            new {kind="command",session=_session,command,value,enabled}));
    }
    private void ShowMenu(Point position)
    {
        _menu?.Dispose();_menu=new Forms.ContextMenuStrip();
        _menu.Items.Add(string.IsNullOrWhiteSpace(ReadyName)?_selection.Id:ReadyName).Enabled=false;
        var motions=new Forms.ToolStripMenuItem("切换动作");
        for(int start=0;start<_actions.Count;start+=40)
        {
            var page=new Forms.ToolStripMenuItem(_actions.Count<=40?"动作":$"{start+1}–{Math.Min(start+40,_actions.Count)}");
            foreach(var action in _actions.Skip(start).Take(40))
            {
                var item=new Forms.ToolStripMenuItem(action.Label);
                item.Click+=(_,_)=>Command("action",action.Id);page.DropDownItems.Add(item);
            }
            if(_actions.Count<=40)motions=page;else motions.DropDownItems.Add(page);
        }
        motions.Enabled=_actions.Count>0;_menu.Items.Add(motions);
        _menu.Items.Add("放大",null,(_,_)=>Command("zoomIn"));
        _menu.Items.Add("缩小",null,(_,_)=>Command("zoomOut"));
        _menu.Items.Add("适应画面",null,(_,_)=>Command("resetView"));
        var voice=new Forms.ToolStripMenuItem("角色语音"){Checked=_voice,CheckOnClick=true};
        voice.Click+=(_,_)=>{_voice=voice.Checked;Command("voice",enabled:_voice);};_menu.Items.Add(voice);
        _menu.Items.Add("重新加载",null,(_,_)=>Command("retryCharacter"));
        _menu.Items.Add("隐藏角色",null,(_,_)=>{SetVisible(false);HiddenByUser?.Invoke();});
        _menu.Show(position);
    }
    public void SetVisible(bool visible)
    {
        if(_disposed)return;_visible=visible;
        if(_controller!=null)_controller.IsVisible=visible;
        if(_window!=null)ShowWindow(_window.Handle,visible?4:0);
        if(!visible)_input?.ClearAndHide();
    }
    public void Dispose()
    {
        if(_disposed)return;_disposed=true;_pressed=false;
        _ready.TrySetCanceled();
        _menu?.Dispose();_menu=null;
        if(_input!=null){_input.MouseInput=null;_input.MouseWheelInput=null;_input.Dispose();_input=null;}
        if(_controller!=null)
        {
            try{_controller.RootVisualTarget=null;_controller.Close();}catch(Exception e){AppLogger.Write(nameof(ArchiveWebViewHost),"web-close "+e.Message);}
            _controller=null;
        }
        _composition?.Dispose();_composition=null;_window?.Dispose();_window=null;
    }
    [DllImport("user32.dll")]private static extern bool SetWindowPos(IntPtr hwnd,IntPtr after,int x,int y,int w,int h,uint flags);
    [DllImport("user32.dll")]private static extern bool ShowWindow(IntPtr hwnd,int command);
}

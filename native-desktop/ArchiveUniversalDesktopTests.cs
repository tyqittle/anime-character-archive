// SPDX-License-Identifier: GPL-3.0-or-later
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;

namespace SpinePet.Tests;

// All composition tests execute sequentially in one xUnit class and own an STA dispatcher.
// Profiles and public-only virtual host roots are unique to this test run.
public sealed class ArchiveUniversalDesktopTests
{
    private sealed class SessionProbe:IDisposable
    {
        public readonly TaskCompletionSource<bool> Loaded=new(TaskCreationOptions.RunContinuationsAsynchronously);
        public bool Visible;
        public int Disposals;
        public void Dispose()=>Disposals++;
    }
    [Fact]
    public async Task DesktopSessionsLoadTogetherAndVisibilityBelongsToEachIdentity()
    {
        var probes=new Dictionary<ArchiveWebSelection,SessionProbe>();
        using var sessions=new ArchiveDesktopSessions<SessionProbe>(
            selection=>probes[selection]=new(),(host,_)=>host.Loaded.Task,(host,visible)=>host.Visible=visible);
        var first=new ArchiveWebSelection("one","shared");
        var second=new ArchiveWebSelection("two","shared");
        var a=sessions.ShowAsync(first);var b=sessions.ShowAsync(second);
        Assert.Equal(2,sessions.Count);
        probes[second].Loaded.SetResult(true);await b;
        Assert.True(probes[second].Visible);Assert.False(a.IsCompleted);
        probes[first].Loaded.SetResult(true);await a;
        Assert.True(probes[first].Visible&&probes[second].Visible);
        sessions.Hide(first);Assert.False(probes[first].Visible);Assert.True(probes[second].Visible);
        Assert.Same(probes[first],await sessions.ShowAsync(first));
        sessions.Remove(second);Assert.Equal(1,probes[second].Disposals);Assert.True(probes[first].Visible);
    }
    [Fact]
    public async Task RemovingALoadingPetCannotResurrectItOrDisposeItsReplacement()
    {
        var probes=new List<SessionProbe>();
        using var sessions=new ArchiveDesktopSessions<SessionProbe>(
            _=>{var probe=new SessionProbe();probes.Add(probe);return probe;},
            (host,_)=>host.Loaded.Task,(host,visible)=>host.Visible=visible);
        var selection=new ArchiveWebSelection("one","role");
        var old=sessions.ShowAsync(selection);sessions.Remove(selection);
        var replacement=sessions.ShowAsync(selection);
        probes[0].Loaded.SetResult(true);Assert.Null(await old);
        Assert.Equal(1,sessions.Count);Assert.Equal(1,probes[0].Disposals);
        probes[1].Loaded.SetResult(true);Assert.Same(probes[1],await replacement);
        Assert.Same(probes[1],sessions.Find(selection));Assert.Equal(0,probes[1].Disposals);
    }
    [Fact]
    public void MultipleVisiblePetsAndMouseThroughPreferencesSurviveRestart()
    {
        string root=Path.Combine(Path.GetTempPath(),"archive-multiple-"+Guid.NewGuid().ToString("N"));
        try
        {
            string path=Path.Combine(root,"library.json"),legacy=Path.Combine(root,"none");
            var library=ArchiveWebLibrary.Load(path,legacy);
            library.Put(new("one","a","First",true,MouseThrough:true));
            library.Put(new("two","b","Second",true));
            var restored=ArchiveWebLibrary.Load(path,legacy);
            Assert.Equal(2,restored.Characters.Count(x=>x.Visible));
            Assert.True(restored.Find(new("one","a"))!.MouseThrough);
            restored.Remove(new("one","a"));
            Assert.True(restored.Characters.Single().Visible);
        }
        finally {if(Directory.Exists(root))Directory.Delete(root,true);}
    }
    [Fact]
    public Task DesktopClicksReachBackgroundAndContextMenusStayAboveThePortrait()=>Sta(async()=>{
        using var backdrop=new System.Windows.Forms.Form{
            FormBorderStyle=System.Windows.Forms.FormBorderStyle.None,
            StartPosition=System.Windows.Forms.FormStartPosition.Manual,
            Bounds=new Rectangle(0,0,320,300),ShowInTaskbar=false
        };
        var target=new System.Windows.Forms.Button{Location=new Point(155,155),Size=new Size(100,80),Text="Desktop target"};
        backdrop.Controls.Add(target);backdrop.Show();
        using var host=new ArchiveWebViewHost(new("fixture","one"),TestSite);
        await host.OpenAsync(Path.Combine(TestRoot,"input-profile"),CancellationToken.None,Path.Combine(TestRoot,"fixture"));
        await Task.Delay(250);
        Assert.False(IsWindowEnabled(host.Window!.Handle));
        var backgroundPoint=target.PointToScreen(new Point(20,20));
        Assert.Equal(target.Handle,WindowFromPoint(backgroundPoint));
        await host.Core!.ExecuteScriptAsync("window.__pointerUps=0;document.addEventListener('pointerup',()=>window.__pointerUps++);chrome.webview.addEventListener('message',e=>window.__command=e.data.command)");
        int x=host.Window.Left+40,y=host.Window.Top+40;
        SetCursorPos(x,y);
        SendMessage(host.InputHandle,0x0200,IntPtr.Zero,IntPtr.Zero);
        SendMessage(host.InputHandle,0x0201,IntPtr.Zero,IntPtr.Zero);
        SendMessage(host.InputHandle,0x0202,IntPtr.Zero,IntPtr.Zero);
        await Task.Delay(120);
        Assert.Equal("1",await host.Core.ExecuteScriptAsync("window.__pointerUps"));
        SendMessage(host.InputHandle,0x0204,IntPtr.Zero,IntPtr.Zero);
        SendMessage(host.InputHandle,0x0205,IntPtr.Zero,IntPtr.Zero);
        await Task.Delay(350);
        Assert.NotNull(host.Menu);Assert.True(host.Menu!.Visible);
        var zoom=host.Menu.Items.Cast<System.Windows.Forms.ToolStripItem>().Single(item=>item.Text=="放大");
        var menuPoint=host.Menu.PointToScreen(new Point(zoom.Bounds.Left+12,zoom.Bounds.Top+zoom.Bounds.Height/2));
        Assert.Equal(host.Menu.Handle,WindowFromPoint(menuPoint));
        zoom.PerformClick();await Task.Delay(80);
        Assert.Equal("\"zoomIn\"",await host.Core.ExecuteScriptAsync("window.__command"));
        host.Menu.Close();
        host.SetMouseThrough(true);await Task.Delay(150);
        Assert.False(IsWindowVisible(host.InputHandle));
        Assert.Equal(target.Handle,WindowFromPoint(backgroundPoint));
        host.SetMouseThrough(false);await Task.Delay(150);Assert.True(IsWindowVisible(host.InputHandle));
        backdrop.Close();
    });
    [Theory]
    [InlineData(640,560,1)]
    [InlineData(640,560,1.25)]
    [InlineData(800,640,1.5)]
    [InlineData(1020,720,2)]
    public Task GlobalCommandsRemainVisibleAndClickableInBothLibraryTabs(double width,double height,double textScale)=>Sta(async()=>{
        var window=(System.Windows.Window)System.Windows.Application.LoadComponent(
            new Uri("/SpinePet;component/Views/MainWindow.xaml",UriKind.Relative));
        window.Width=width;window.Height=height;window.Topmost=false;window.ShowInTaskbar=false;
        string folder=Path.Combine(TestRoot,"layout-"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        try
        {
            var toolbar=(System.Windows.Controls.WrapPanel)window.FindName("ArchiveWindowToolbar");
            foreach(var button in toolbar.Children.OfType<System.Windows.Controls.Button>())button.FontSize=12*textScale;
            var libraryHost=(System.Windows.Controls.Grid)window.FindName("ArchiveCharacterLibraryHost");
            var settingsHost=(System.Windows.Controls.Grid)window.FindName("ArchiveCharacterSettingsHost");
            var library=ArchiveWebLibrary.Load(Path.Combine(folder,"library.json"),Path.Combine(folder,"none"));
            library.Put(new("fixture","role","Layout sample"));
            using var panel=new ArchiveWebLibraryPanel(libraryHost,settingsHost,library,
                _=>Task.CompletedTask,_=>{},_=>{},_=>null);
            window.Show();window.UpdateLayout();await Task.Delay(60);
            var content=(System.Windows.FrameworkElement)window.Content;
            foreach(int tab in new[]{0,1})
            {
                libraryHost.Children.OfType<System.Windows.Controls.TabControl>().Single().SelectedIndex=tab;
                window.UpdateLayout();
                foreach(string name in new[]{"UniversalCatalogButton","ManualUpdateButton","ExitButton"})
                {
                    var button=(System.Windows.Controls.Button)window.FindName(name);
                    Assert.True(button.IsVisible&&button.IsHitTestVisible,name+" is unavailable");
                    var bounds=button.TransformToAncestor(content).TransformBounds(new System.Windows.Rect(button.RenderSize));
                    Assert.True(bounds.Left>=0&&bounds.Top>=0&&bounds.Right<=content.ActualWidth+1&&
                        bounds.Bottom<=content.ActualHeight+1,name+" is clipped by the window");
                    Assert.True(button.ActualHeight+button.Margin.Top+button.Margin.Bottom+1>=button.DesiredSize.Height,
                        name+" is clipped vertically");
                    var hit=content.InputHitTest(new System.Windows.Point(bounds.Left+bounds.Width/2,bounds.Top+bounds.Height/2))
                        as System.Windows.DependencyObject;
                    Assert.True(hit==button||(hit!=null&&button.IsAncestorOf(hit)),name+" is covered by settings");
                }
                var tools=(System.Windows.Controls.WrapPanel)window.FindName("ArchiveLibraryToolbar");
                foreach(var tool in tools.Children.OfType<System.Windows.FrameworkElement>())
                {
                    var bounds=tool.TransformToAncestor(tools).TransformBounds(new System.Windows.Rect(tool.RenderSize));
                    Assert.True(bounds.Left>=-1&&bounds.Right<=tools.ActualWidth+1&&
                        bounds.Bottom<=tools.ActualHeight+1,"Library action is clipped");
                }
            }
        }
        finally {window.Close();Directory.Delete(folder,true);}
    });

    [Fact]
    public void LibraryPersistsEveryModelAndUsesGameAndIdAsIdentity()
    {
        string root=Path.Combine(Path.GetTempPath(),"archive-library-"+Guid.NewGuid().ToString("N"));
        try
        {
            string path=Path.Combine(root,"library.json"),legacy=Path.Combine(root,"old.json");
            var library=ArchiveWebLibrary.Load(path,legacy);
            library.Put(new("game-a","same","First",true));
            library.Put(new("game-b","same","Second",true,true,"idle-2"));
            library.Put(new("game-a","same","Renamed"));
            var restored=ArchiveWebLibrary.Load(path,legacy);
            Assert.Equal(2,restored.Characters.Count);
            Assert.Equal("Renamed",restored.Find(new("game-a","same"))!.Name);
            var second=restored.Find(new("game-b","same"))!;
            Assert.True(second.Visible);Assert.True(second.Voice);Assert.Equal("idle-2",second.Action);
            Assert.Single(restored.Characters,x=>x.Visible);
            Assert.Empty(Directory.GetFiles(root,"*.tmp"));
        }
        finally {if(Directory.Exists(root))Directory.Delete(root,true);}
    }

    [Fact]
    public void MigrationAndRemovalDoNotResurrectTheLastLegacyCharacter()
    {
        string root=Path.Combine(Path.GetTempPath(),"archive-migrate-"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            string path=Path.Combine(root,"library.json"),legacy=Path.Combine(root,"old.json");
            File.WriteAllText(legacy,JsonSerializer.Serialize(new{Game="example",Id="old",Visible=true}));
            var library=ArchiveWebLibrary.Load(path,legacy);
            Assert.True(library.Characters.Single().Visible);
            library.Remove(new("example","old"));
            Assert.Empty(ArchiveWebLibrary.Load(path,legacy).Characters);
            Assert.True(File.Exists(legacy));
        }
        finally {Directory.Delete(root,true);}
    }

    [Fact]
    public void FailedSaveKeepsThePreviousLibraryAndMalformedInputIsPreserved()
    {
        string root=Path.Combine(Path.GetTempPath(),"archive-save-"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            string path=Path.Combine(root,"library.json");
            var library=ArchiveWebLibrary.Load(path,Path.Combine(root,"none"));
            library.Put(new("example","one","One"));
            using(var locked=File.Open(path,FileMode.Open,FileAccess.Read,FileShare.None))
            {
                var error=Record.Exception(()=>library.Put(new("example","two","Two")));
                Assert.True(error is IOException or UnauthorizedAccessException,
                    "A locked library must reject replacement without changing its contents.");
            }
            Assert.Single(library.Characters);
            Assert.Single(ArchiveWebLibrary.Load(path,Path.Combine(root,"none")).Characters);
            Assert.Empty(Directory.GetFiles(root,"*.tmp"));
            File.WriteAllText(path,"broken");
            Assert.Throws<JsonException>(()=>ArchiveWebLibrary.Load(path,Path.Combine(root,"none")));
            Assert.Equal("broken",File.ReadAllText(path));
        }
        finally {Directory.Delete(root,true);}
    }

    [Fact]
    public Task SavedWebsiteModelsAppearInCharactersWithoutNativeResources()=>Sta(async()=>{
        string root=Path.Combine(TestRoot,"library-ui-"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var library=ArchiveWebLibrary.Load(Path.Combine(root,"library.json"),Path.Combine(root,"none"));
            library.Put(new("example","one","First"));
            library.Put(new("another","two","Second"));
            var listHost=new System.Windows.Controls.Grid();
            listHost.Children.Add(new System.Windows.Controls.ListBox());
            var settingsHost=new System.Windows.Controls.Grid();
            var shown=new List<ArchiveWebSelection>();var hidden=new List<ArchiveWebSelection>();
            using var panel=new ArchiveWebLibraryPanel(listHost,settingsHost,library,
                selected=>{shown.Add(selected);library.Put(library.Find(selected)! with{Visible=true});return Task.CompletedTask;},
                selected=>{hidden.Add(selected);library.Put(library.Find(selected)! with{Visible=false});},
                selected=>library.Remove(selected),_=>null);
            Assert.Equal(2,panel.List.Items.Count);
            panel.Select(new("another","two"));
            void Click(string label)=>panel.Settings.Children.OfType<System.Windows.Controls.Button>()
                .Single(x=>Equals(x.Content,label)).RaiseEvent(new System.Windows.RoutedEventArgs(System.Windows.Controls.Button.ClickEvent));
            Click("显示角色");Assert.Equal(new("another","two"),shown.Single());
            Click("隐藏角色");Assert.Equal(new("another","two"),hidden.Single());
            Click("从列表移除");
            Assert.Single(panel.List.Items.Cast<object>());
            Assert.Single(ArchiveWebLibrary.Load(Path.Combine(root,"library.json"),Path.Combine(root,"none")).Characters);
            await Task.CompletedTask;
        }
        finally {Directory.Delete(root,true);}
    });

    [Theory]
    [InlineData("girlscafegun","gc-girl01-l2d00")]
    [InlineData("future-game","角色 / + & ? #")]
    public void CatalogIdentitiesRoundTripWithoutGameWhitelist(string game,string id)
    {
        string link="animecharacter://open?host=webview2&game="+Uri.EscapeDataString(game)+"&id="+Uri.EscapeDataString(id);
        var selection=ArchiveWebSelection.Parse(link);
        Assert.Equal(new ArchiveWebSelection(game,id),selection);
        var page=selection!.Page(ArchiveWebSelection.Site,new string('a',32));
        Assert.True(ArchiveWebSelection.IsPage(page.AbsoluteUri,ArchiveWebSelection.Site));
        Assert.Contains("transport=webview2",page.Query);
        Assert.Contains("id="+Uri.EscapeDataString(id),page.Query);
    }

    [Theory]
    [InlineData("animecharacter://open?host=webview2&game=x&id=a&id=b")]
    [InlineData("animecharacter://open?host=webview2&game=x&id=a&url=https://evil.invalid")]
    [InlineData("animecharacter://evil/open?host=webview2&game=x&id=a")]
    [InlineData("animecharacter://open/path?host=webview2&game=x&id=a")]
    [InlineData("animecharacter://open?host=webview2&game=&id=a")]
    [InlineData("animecharacter://open?host=webview2&game=x&id=%00")]
    public void InvalidOrAmbiguousProtocolCannotNavigate(string link)
        =>Assert.Null(ArchiveWebSelection.Parse(link));

    [Fact]
    public async Task ClaimingOldRequestNeverDeletesANewerSelection()
    {
        string folder=Path.Combine(Path.GetTempPath(),"archive-inbox-"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        try
        {
            string path=Path.Combine(folder,"request.json");
            await File.WriteAllTextAsync(path,"old");
            using(var claimed=ArchiveRequestInbox.Claim(path))
            {
                Assert.NotNull(claimed);
                await File.WriteAllTextAsync(path,"new");
                Assert.Equal("old",await claimed!.ReadAsync());
            }
            Assert.Equal("new",await File.ReadAllTextAsync(path));
            using(var current=ArchiveRequestInbox.Claim(path))
                Assert.Equal("new",await current!.ReadAsync());
            Assert.Null(ArchiveRequestInbox.Claim(path));
        }
        finally {Directory.Delete(folder,true);}
    }

    [Fact]
    public Task CompositionPreservesAlphaAndInputShape()=>Sta(async()=>{
        string root=Path.Combine(TestRoot,"fixture");
        using var host=new ArchiveWebViewHost(new("fixture","one"),TestSite);
        await host.OpenAsync(Path.Combine(TestRoot,"fixture-profile"),CancellationToken.None,root);
        await Task.Delay(400);
        Assert.Equal("fixture",host.ReadyEngine);
        Assert.True(host.MaskCount>0);
        Assert.NotEqual(IntPtr.Zero,host.InputHandle);
        // Win32 region, not a full-screen invisible input window.
        IntPtr region=CreateRectRgn(0,0,0,0);
        try
        {
            Assert.NotEqual(0,GetWindowRgn(host.InputHandle,region));
            Assert.True(PtInRegion(region,30,30));
            Assert.False(PtInRegion(region,180,180));
        }
        finally {DeleteObject(region);}
        using var stream=new MemoryStream();
        await host.Core!.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);
        stream.Position=0;
        using var bitmap=new Bitmap(stream);
        Assert.Equal(0,bitmap.GetPixel(bitmap.Width-4,bitmap.Height-4).A);
        var visible=bitmap.GetPixel(30,30);
        Assert.True(visible.A>240&&visible.R>220&&visible.G<30,"Fixture red pixels must be visible");
        Assert.Equal(host.Window!.Handle,GetWindow(host.InputHandle,3)); // GW_HWNDPREV
        // Hidden hosts release their input HWND. Showing resumes masks.
        host.SetVisible(false);Assert.False(IsWindowVisible(host.InputHandle));
        host.SetVisible(true);
    });

    [Fact]
    public Task TwoRealCompositionHostsShareTheCacheAndKeepIndependentVisibility()=>Sta(async()=>{
        string profile=Path.Combine(TestRoot,"multi-profile"),root=Path.Combine(TestRoot,"fixture");
        using var first=new ArchiveWebViewHost(new("fixture","first"),TestSite);
        using var second=new ArchiveWebViewHost(new("fixture","second"),TestSite,placementIndex:1);
        await Task.WhenAll(first.OpenAsync(profile,CancellationToken.None,root),
            second.OpenAsync(profile,CancellationToken.None,root));
        Assert.NotEqual(first.Window!.Handle,second.Window!.Handle);
        Assert.True(first.MaskCount>0&&second.MaskCount>0);
        int count=second.MaskCount;
        first.SetVisible(false);await Task.Delay(350);
        Assert.False(IsWindowVisible(first.InputHandle));Assert.True(IsWindowVisible(second.InputHandle));
        Assert.True(second.MaskCount>count);
        first.SetVisible(true);await Task.Delay(150);
        Assert.True(IsWindowVisible(first.InputHandle)&&IsWindowVisible(second.InputHandle));
    });

    [Fact]
    public Task CurrentWebsiteEnginesRenderAndKeepUserView()=>Sta(async()=>{
        var cases=JsonSerializer.Deserialize<List<CatalogCase>>(
            await File.ReadAllTextAsync(Path.Combine(TestRoot,"cases.json")))!;
        Assert.True(cases.Count>=5);
        foreach(var item in cases)
        {
            using var host=new ArchiveWebViewHost(new(item.Game,item.Id),TestSite);
            await host.OpenAsync(Path.Combine(TestRoot,"catalog-profile"),CancellationToken.None,
                Path.Combine(TestRoot,"public"));
            Assert.Equal(item.Engine,host.ReadyEngine);
            int mask=host.MaskCount;
            var before=await Inspect(host);
            await Task.Delay(650);
            var after=await Inspect(host);
            Assert.True(after.GetProperty("renderedFrames").GetInt32()>before.GetProperty("renderedFrames").GetInt32(),
                "Animation clock stopped: "+item.Id);
            Assert.True(host.MaskCount>mask,"Input mask stopped: "+item.Id);
            host.Command("zoomIn");await Task.Delay(350);
            var zoomed=await Inspect(host);
            double zoom=zoomed.GetProperty("view").GetProperty("zoom").GetDouble();
            Assert.True(zoom>after.GetProperty("view").GetProperty("zoom").GetDouble(),"Zoom command failed: "+item.Id);
            string actionJson=await host.Core!.ExecuteScriptAsync(
                "JSON.stringify(Array.from(document.getElementById('animationPicker').options).filter(o=>o.value).map(o=>o.value))");
            string[] actions=JsonSerializer.Deserialize<string[]>(JsonSerializer.Deserialize<string>(actionJson)!)!;
            if(actions.Length>0)
            {
                host.Command("action",actions[^1]);await Task.Delay(800);
                var switched=await Inspect(host);
                Assert.Equal(zoom,switched.GetProperty("view").GetProperty("zoom").GetDouble(),3);
            }
            using var stream=new MemoryStream();
            await host.Core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);
            stream.Position=0;using var bitmap=new Bitmap(stream);
            int transparent=0,opaque=0;
            for(int y=0;y<bitmap.Height;y+=8)for(int x=0;x<bitmap.Width;x+=8)
            {int a=bitmap.GetPixel(x,y).A;if(a==0)transparent++;if(a>16)opaque++;}
            Assert.True(transparent>100&&opaque>20,"Missing transparent animated portrait: "+item.Id);
            Console.WriteLine($"UNIVERSAL_RENDER game={item.Game} id={item.Id} engine={host.ReadyEngine} masks={host.MaskCount} transparent={transparent} visible={opaque}");
            host.SetVisible(false);Assert.False(IsWindowVisible(host.InputHandle));
            host.SetVisible(true);
        }
    });

    private static async Task<JsonElement> Inspect(ArchiveWebViewHost host)
    {
        string result=await host.Core!.ExecuteScriptAsync("JSON.stringify(ArchiveDesktopBridge.inspect())");
        using var doc=JsonDocument.Parse(JsonSerializer.Deserialize<string>(result)!);
        return doc.RootElement.Clone();
    }
    private sealed record CatalogCase(string Game,string Id,string Engine);
    private static string TestRoot=>Environment.GetEnvironmentVariable("ARCHIVE_WEB_TEST_ROOT")
        ??throw new InvalidOperationException("Universal test fixtures missing");
    private static readonly Uri TestSite=new("https://archive-desktop.test/");
    private static async Task Sta(Func<Task> action)
    {
        var completion=new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread=new Thread(()=>{
            var dispatcher=Dispatcher.CurrentDispatcher;
            SynchronizationContext.SetSynchronizationContext(new DispatcherSynchronizationContext(dispatcher));
            dispatcher.BeginInvoke(new Action(async()=>{
                try {await action();completion.TrySetResult(true);}
                catch(Exception error){completion.TrySetException(error);}
                finally {dispatcher.BeginInvokeShutdown(DispatcherPriority.Background);}
            }));
            Dispatcher.Run();
        }){IsBackground=true};
        thread.SetApartmentState(ApartmentState.STA);thread.Start();
        await completion.Task.WaitAsync(TimeSpan.FromMinutes(15));
    }
    [DllImport("gdi32.dll")]private static extern IntPtr CreateRectRgn(int left,int top,int right,int bottom);
    [DllImport("gdi32.dll")]private static extern bool PtInRegion(IntPtr region,int x,int y);
    [DllImport("gdi32.dll")]private static extern bool DeleteObject(IntPtr region);
    [DllImport("user32.dll")]private static extern int GetWindowRgn(IntPtr hwnd,IntPtr region);
    [DllImport("user32.dll")]private static extern IntPtr GetWindow(IntPtr hwnd,uint command);
    [DllImport("user32.dll")]private static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")]private static extern bool IsWindowEnabled(IntPtr hwnd);
    [DllImport("user32.dll")]private static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")]private static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll",EntryPoint="SendMessageW")]private static extern IntPtr SendMessage(IntPtr window,uint message,IntPtr wParam,IntPtr lParam);
}

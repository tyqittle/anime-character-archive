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
}

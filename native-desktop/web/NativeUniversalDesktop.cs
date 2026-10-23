// SPDX-License-Identifier: GPL-3.0-or-later
using System.IO;
using System.Text.Json;
using System.Windows;
using SpinePet.Infrastructure;
namespace SpinePet;

public sealed partial class App
{
    private ArchiveWebViewHost? _universalDesktop;
    private CancellationTokenSource? _universalLoad;
    private ArchiveWebSelection? _universalSelection;
    private void InitializeUniversalCatalogButton()
    {
        if(_mainWindow?.FindName("UniversalCatalogButton") is System.Windows.Controls.Button button)
            button.Click+=(_,_)=>System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(
                new Uri(ArchiveWebSelection.Site,"spine.html").AbsoluteUri){UseShellExecute=true});
    }
    private static string UniversalStatePath=>Path.Combine(AppPaths.LocalDataDirectory,"universal-desktop-v1.json");
    private sealed record UniversalState(string Game,string Id,bool Visible);

    private async Task ShowUniversalDesktopAsync(ArchiveWebSelection selection,bool save=true)
    {
        if (!selection.IsValid||IsShutdownRequested)return;
        _universalLoad?.Cancel();_universalLoad?.Dispose();
        var cancellation=new CancellationTokenSource(TimeSpan.FromMinutes(6));
        _universalLoad=cancellation;
        _universalDesktop?.Dispose();_universalDesktop=null;
        var host=new ArchiveWebViewHost(selection);
        _universalDesktop=host;
        host.HiddenByUser+=()=>SaveUniversalState(selection,false);
        try
        {
            // User-selected durable model directory, outside versioned app files.
            string profile=Path.Combine(AppPaths.ResourceDirectory,".archive-webview2");
            Directory.CreateDirectory(profile);
            await host.OpenAsync(profile,cancellation.Token);
            if (cancellation.IsCancellationRequested||_universalDesktop!=host)return;
            _universalSelection=selection;
            if(save)SaveUniversalState(selection,true);
        }
        catch(OperationCanceledException) {}
        catch(Exception error)
        {
            if(cancellation.IsCancellationRequested||IsShutdownRequested)return;
            AppLogger.Write(nameof(App),"universal-open-failed "+error.Message);
            System.Windows.MessageBox.Show(error.Message+"\n可在网站重新选择角色并重试。","桌面立绘加载失败",
                MessageBoxButton.OK,MessageBoxImage.Warning);
        }
        finally
        {
            if(cancellation.IsCancellationRequested&&_universalDesktop==host)
            {_universalDesktop=null;host.Dispose();}
        }
    }
    private static void SaveUniversalState(ArchiveWebSelection selection,bool visible)
    {
        try
        {
            Directory.CreateDirectory(AppPaths.LocalDataDirectory);
            string temporary=UniversalStatePath+"."+Guid.NewGuid().ToString("N")+".tmp";
            try
            {
                File.WriteAllText(temporary,JsonSerializer.Serialize(
                    new UniversalState(selection.Game,selection.Id,visible)));
                File.Move(temporary,UniversalStatePath,true);
            }
            finally { if(File.Exists(temporary))File.Delete(temporary); }
        }
        catch(Exception error){AppLogger.Write(nameof(App),"universal-state-save "+error.Message);}
    }
    private async Task RestoreUniversalDesktopAsync()
    {
        if(!File.Exists(UniversalStatePath)||File.Exists(ArchiveRequestPath))return;
        try
        {
            var state=JsonSerializer.Deserialize<UniversalState>(await File.ReadAllTextAsync(UniversalStatePath));
            if(state?.Visible==true)
                await ShowUniversalDesktopAsync(new(state.Game,state.Id),save:false);
        }
        catch(Exception error){AppLogger.Write(nameof(App),"universal-state-restore "+error.Message);}
    }
    private void HideUniversalDesktop()
    {
        _universalDesktop?.SetVisible(false);
        if(_universalSelection!=null)SaveUniversalState(_universalSelection,false);
    }
    private void ShowUniversalDesktop()
    {
        _universalDesktop?.SetVisible(true);
        if(_universalSelection!=null)SaveUniversalState(_universalSelection,true);
    }
    private void StopUniversalDesktop()
    {
        _universalLoad?.Cancel();_universalLoad?.Dispose();_universalLoad=null;
        _universalDesktop?.Dispose();_universalDesktop=null;
    }
}

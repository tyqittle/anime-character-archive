// SPDX-License-Identifier: GPL-3.0-or-later
using System.IO;
using System.Windows;
using SpinePet.Infrastructure;
namespace SpinePet;

public sealed partial class App
{
    private ArchiveWebViewHost? _universalDesktop;
    private CancellationTokenSource? _universalLoad;
    private ArchiveWebSelection? _universalSelection;
    private ArchiveWebSelection? _universalPending;
    private ArchiveWebLibrary? _universalLibrary;
    private ArchiveWebLibraryPanel? _universalPanel;
    private static string UniversalStatePath=>Path.Combine(AppPaths.LocalDataDirectory,"universal-desktop-v1.json");
    private ArchiveWebLibrary UniversalLibrary=>_universalLibrary??=ArchiveWebLibrary.Load(
        Path.Combine(AppPaths.LocalDataDirectory,"universal-characters-v1.json"),UniversalStatePath);
    private void InitializeUniversalCatalogButton()
    {
        if(_mainWindow?.FindName("UniversalCatalogButton") is System.Windows.Controls.Button button)
            button.Click+=(_,_)=>System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(
                new Uri(ArchiveWebSelection.Site,"spine.html").AbsoluteUri){UseShellExecute=true});
        try
        {
            if(_mainWindow?.FindName("ArchiveCharacterLibraryHost") is System.Windows.Controls.Grid library&&
                _mainWindow.FindName("ArchiveCharacterSettingsHost") is System.Windows.Controls.Grid settings)
                _universalPanel=new(library,settings,UniversalLibrary,
                    selection=>ShowUniversalDesktopAsync(selection),HideUniversalCharacter,
                    RemoveUniversalCharacter,selection=>_universalSelection==selection?_universalDesktop:null,
                    _mainWindow.FindName("CharacterSearchBox") as System.Windows.Controls.TextBox,
                    _mainWindow.FindName("CharacterCountText") as System.Windows.Controls.TextBlock);
        }
        catch(Exception error)
        {AppLogger.Write(nameof(App),"universal-library-load "+error.Message);
            System.Windows.MessageBox.Show(error.Message,"网页角色清单读取失败");}
    }
    private async Task ShowUniversalDesktopAsync(ArchiveWebSelection selection,bool save=true)
    {
        if(!selection.IsValid||IsShutdownRequested)return;
        _universalLoad?.Cancel();_universalLoad?.Dispose();
        var cancellation=new CancellationTokenSource(TimeSpan.FromMinutes(6));_universalLoad=cancellation;
        ArchiveWebViewHost? host=null;
        _universalPending=selection;
        try
        {
            var entry=UniversalLibrary.Find(selection)??new(selection.Game,selection.Id,selection.Id);
            if(_universalSelection!=null&&UniversalLibrary.Find(_universalSelection) is { } previous)
                UniversalLibrary.Put(previous with{Visible=false});
            _universalDesktop?.Dispose();_universalDesktop=null;_universalSelection=null;
            UniversalLibrary.Put(entry with{Visible=false});_universalPanel?.Select(selection);
            host=new ArchiveWebViewHost(selection);_universalDesktop=host;
            host.HiddenByUser+=()=>HideUniversalCharacter(selection);
            host.SettingsChanged+=()=>{
                if(_universalDesktop!=host||_universalSelection!=selection)return;
                if(UniversalLibrary.Find(selection) is { } current)
                    UniversalLibrary.Put(current with{Voice=host.VoiceEnabled,Action=host.ActionId});
            };
            string profile=Path.Combine(AppPaths.ResourceDirectory,".archive-webview2");Directory.CreateDirectory(profile);
            await host.OpenAsync(profile,cancellation.Token);
            if(cancellation.IsCancellationRequested||_universalDesktop!=host)return;
            host.Command("voice",enabled:entry.Voice);
            if(!string.IsNullOrEmpty(entry.Action))host.Command("action",entry.Action);
            UniversalLibrary.Put(entry with{Name=string.IsNullOrWhiteSpace(host.ReadyName)?entry.Name:host.ReadyName,Visible=true});
            _universalSelection=selection;
            _universalPanel?.Select(selection);
        }
        catch(OperationCanceledException) {}
        catch(Exception error)
        {
            if(cancellation.IsCancellationRequested||IsShutdownRequested)return;
            AppLogger.Write(nameof(App),"universal-open-failed "+error.Message);
            System.Windows.MessageBox.Show(error.Message+"\n角色已保留在列表，可稍后重试。","桌面立绘加载失败",
                MessageBoxButton.OK,MessageBoxImage.Warning);
        }
        finally
        {
            if(_universalDesktop==host&&(cancellation.IsCancellationRequested||_universalSelection!=selection))
            {_universalDesktop=null;_universalSelection=null;host?.Dispose();}
            if(_universalLoad==cancellation){_universalLoad=null;_universalPending=null;cancellation.Dispose();}
            _universalPanel?.Refresh();
        }
    }
    private async Task RestoreUniversalDesktopAsync()
    {
        if(File.Exists(ArchiveRequestPath))return;
        try
        {
            var saved=UniversalLibrary.Characters.LastOrDefault(x=>x.Visible);
            if(saved!=null)await ShowUniversalDesktopAsync(saved.Selection,save:false);
        }
        catch(Exception error){AppLogger.Write(nameof(App),"universal-state-restore "+error.Message);}
    }
    private void HideUniversalCharacter(ArchiveWebSelection selection)
    {
        if(_universalSelection==selection)_universalDesktop?.SetVisible(false);
        if(UniversalLibrary.Find(selection) is { } entry)UniversalLibrary.Put(entry with{Visible=false});
    }
    private void RemoveUniversalCharacter(ArchiveWebSelection selection)
    {
        if(_universalPending==selection)
        {_universalLoad?.Cancel();_universalDesktop?.Dispose();_universalDesktop=null;}
        if(_universalSelection==selection)
        {_universalDesktop?.Dispose();_universalDesktop=null;_universalSelection=null;}
        UniversalLibrary.Remove(selection);
    }
    private void HideUniversalDesktop()
    {if(_universalSelection!=null)HideUniversalCharacter(_universalSelection);}
    private void ShowUniversalDesktop()
    {
        if(_universalSelection==null)return;
        _universalDesktop?.SetVisible(true);
        if(UniversalLibrary.Find(_universalSelection) is { } entry)UniversalLibrary.Put(entry with{Visible=true});
    }
    private void StopUniversalDesktop()
    {
        _universalLoad?.Cancel();_universalLoad?.Dispose();_universalLoad=null;
        _universalDesktop?.Dispose();_universalDesktop=null;_universalPanel?.Dispose();_universalPanel=null;
    }
}

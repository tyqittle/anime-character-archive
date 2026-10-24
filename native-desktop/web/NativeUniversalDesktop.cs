// SPDX-License-Identifier: GPL-3.0-or-later
using System.IO;
using System.Windows;
using SpinePet.Infrastructure;
namespace SpinePet;

public sealed partial class App
{
    private ArchiveWebLibrary? _universalLibrary;
    private ArchiveWebLibraryPanel? _universalPanel;
    private ArchiveDesktopSessions<ArchiveWebViewHost>? _universalHosts;
    private static string UniversalStatePath=>Path.Combine(AppPaths.LocalDataDirectory,"universal-desktop-v1.json");
    private ArchiveWebLibrary UniversalLibrary=>_universalLibrary??=ArchiveWebLibrary.Load(
        Path.Combine(AppPaths.LocalDataDirectory,"universal-characters-v1.json"),UniversalStatePath);
    private ArchiveDesktopSessions<ArchiveWebViewHost> UniversalHosts=>_universalHosts??=new(
        CreateUniversalHost,OpenUniversalHostAsync,(host,visible)=>host.SetVisible(visible));
    private ArchiveWebViewHost CreateUniversalHost(ArchiveWebSelection selection)
    {
        var host=new ArchiveWebViewHost(selection,placementIndex:_universalHosts?.Count??0);
        host.HiddenByUser+=()=>HideUniversalCharacter(selection);
        host.CapabilitiesChanged+=()=>_universalPanel?.Refresh();
        host.SettingsChanged+=()=>{
            if(_universalHosts?.Find(selection)!=host)return;
            if(UniversalLibrary.Find(selection) is {} entry)
                UniversalLibrary.Put(entry with{Voice=host.VoiceEnabled,Action=host.ActionId,MouseThrough=host.MouseThrough});
        };
        return host;
    }
    private static Task OpenUniversalHostAsync(ArchiveWebViewHost host,CancellationToken cancellation)
    {
        string profile=Path.Combine(AppPaths.ResourceDirectory,".archive-webview2");
        Directory.CreateDirectory(profile);
        return host.OpenAsync(profile,cancellation);
    }
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
                    RemoveUniversalCharacter,selection=>_universalHosts?.Find(selection),
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
        try
        {
            var entry=UniversalLibrary.Find(selection);
            if(entry==null)
            {
                entry=new(selection.Game,selection.Id,selection.Id);
                UniversalLibrary.Put(entry);
            }
            _universalPanel?.Select(selection);
            var host=await UniversalHosts.ShowAsync(selection);
            if(host==null||IsShutdownRequested)return;
            // Read the current entry: preferences may change while a model loads.
            entry=UniversalLibrary.Find(selection);
            if(entry==null)return;
            host.Command("voice",enabled:entry.Voice);
            if(!string.IsNullOrEmpty(entry.Action))host.Command("action",entry.Action);
            host.SetMouseThrough(entry.MouseThrough);
            UniversalLibrary.Put(entry with{Name=string.IsNullOrWhiteSpace(host.ReadyName)?entry.Name:host.ReadyName,Visible=true});
        }
        catch(OperationCanceledException) {}
        catch(Exception error)
        {
            if(IsShutdownRequested)return;
            if(_universalHosts?.Find(selection)==null&&UniversalLibrary.Find(selection) is {} failed)
                UniversalLibrary.Put(failed with{Visible=false});
            AppLogger.Write(nameof(App),"universal-open-failed "+error.Message);
            System.Windows.MessageBox.Show(error.Message+"\n角色已保留在列表，可稍后重试。","桌面立绘加载失败",
                MessageBoxButton.OK,MessageBoxImage.Warning);
        }
        finally {_universalPanel?.Refresh();}
    }
    private async Task RestoreUniversalDesktopAsync()
    {
        try
        {
            var saved=UniversalLibrary.Characters.Where(x=>x.Visible).Select(x=>x.Selection).ToArray();
            await Task.WhenAll(saved.Select(x=>ShowUniversalDesktopAsync(x,save:false)));
        }
        catch(Exception error){AppLogger.Write(nameof(App),"universal-state-restore "+error.Message);}
    }
    private void HideUniversalCharacter(ArchiveWebSelection selection)
    {
        _universalHosts?.Hide(selection);
        if(UniversalLibrary.Find(selection) is {} entry)UniversalLibrary.Put(entry with{Visible=false});
    }
    private void RemoveUniversalCharacter(ArchiveWebSelection selection)
    {_universalHosts?.Remove(selection);UniversalLibrary.Remove(selection);}
    private void HideUniversalDesktop()
    {
        foreach(var entry in UniversalLibrary.Characters.ToArray())HideUniversalCharacter(entry.Selection);
    }
    private void ShowUniversalDesktop()
    {
        foreach(var entry in UniversalLibrary.Characters.ToArray())_ = ShowUniversalDesktopAsync(entry.Selection);
    }
    private void StopUniversalDesktop()
    {
        _universalHosts?.Dispose();_universalHosts=null;
        _universalPanel?.Dispose();_universalPanel=null;
    }
}

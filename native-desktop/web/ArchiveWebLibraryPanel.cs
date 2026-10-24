// SPDX-License-Identifier: GPL-3.0-or-later
using W=System.Windows;
using C=System.Windows.Controls;
using M=System.Windows.Media;
namespace SpinePet;

// Extends the existing Characters area. Native controls retain their own lifecycle.
internal sealed class ArchiveWebLibraryPanel : IDisposable
{
    private readonly ArchiveWebLibrary _library;
    private readonly Func<ArchiveWebSelection,Task> _show;
    private readonly Action<ArchiveWebSelection> _hide,_remove;
    private readonly Func<ArchiveWebSelection,ArchiveWebViewHost?> _host;
    private readonly C.ListBox _list=new(){DisplayMemberPath=nameof(ArchiveWebCharacter.Label)};
    private readonly C.StackPanel _settings=new(){Margin=new W.Thickness(14)};
    private readonly C.Border _overlay;
    private readonly C.TabControl _tabs=new();
    private readonly C.TextBox _search=new(){Margin=new W.Thickness(0,0,0,8),ToolTip="搜索网页角色、游戏或模型 ID"};
    private readonly C.TextBlock _count=new();
    private readonly C.TextBlock? _nativeCount;
    private readonly C.TextChangedEventHandler _searchChanged;
    private bool _refreshing;
    internal C.ListBox List=>_list;
    internal C.Panel Settings=>_settings;
    internal ArchiveWebLibraryPanel(C.Grid libraryHost,C.Grid settingsHost,ArchiveWebLibrary library,
        Func<ArchiveWebSelection,Task> show,Action<ArchiveWebSelection> hide,
        Action<ArchiveWebSelection> remove,Func<ArchiveWebSelection,ArchiveWebViewHost?> host,
        C.TextBox? search=null,C.TextBlock? nativeCount=null)
    {
        _library=library;_show=show;_hide=hide;_remove=remove;_host=host;
        _nativeCount=nativeCount;
        if(search!=null)_search=search;
        var native=new C.Grid();
        var children=libraryHost.Children.Cast<W.UIElement>().ToArray();
        libraryHost.Children.Clear();foreach(var child in children)native.Children.Add(child);
        var web=new C.DockPanel();
        var header=new C.StackPanel();header.Children.Add(_count);
        if(search==null)header.Children.Add(_search);
        C.DockPanel.SetDock(header,C.Dock.Top);web.Children.Add(header);web.Children.Add(_list);
        _tabs.Items.Add(new C.TabItem{Header="网页角色",Content=web});
        _tabs.Items.Add(new C.TabItem{Header="本地素材",Content=native});libraryHost.Children.Add(_tabs);
        _overlay=new C.Border{Background=new M.SolidColorBrush(M.Color.FromRgb(24,24,30)),Child=_settings};
        C.Grid.SetRowSpan(_overlay,2);C.Panel.SetZIndex(_overlay,10);settingsHost.Children.Add(_overlay);
        _list.SelectionChanged+=(_,_)=>RenderSettings();
        void TabChanged()
        {
            _overlay.Visibility=_tabs.SelectedIndex==0?W.Visibility.Visible:W.Visibility.Collapsed;
            if(_nativeCount!=null)_nativeCount.Visibility=_tabs.SelectedIndex==0?W.Visibility.Collapsed:W.Visibility.Visible;
        }
        _tabs.SelectionChanged+=(_,_)=>TabChanged();
        _searchChanged=(_,_)=>Refresh();_search.TextChanged+=_searchChanged;
        _library.Changed+=Refresh;Refresh();
        _tabs.SelectedIndex=library.Characters.Count>0?0:1;
        TabChanged();
    }
    public void Select(ArchiveWebSelection selection)
    {
        _search.Text="";Refresh();_list.SelectedItem=_list.Items.Cast<ArchiveWebCharacter>()
            .FirstOrDefault(x=>x.Selection==selection);_tabs.SelectedIndex=0;RenderSettings();
    }
    public void Refresh()
    {
        var selection=(_list.SelectedItem as ArchiveWebCharacter)?.Selection;
        string query=_search.Text.Trim();
        _list.ItemsSource=_library.Characters.Where(x=>query.Length==0||
            (x.Name+" "+x.Game+" "+x.Id).Contains(query,StringComparison.OrdinalIgnoreCase)).ToArray();
        _list.SelectedItem=_list.Items.Cast<ArchiveWebCharacter>().FirstOrDefault(x=>x.Selection==selection)
            ??_list.Items.Cast<ArchiveWebCharacter>().FirstOrDefault();
        _count.Text=$"{_library.Characters.Count} 个已加入网页角色";RenderSettings();
    }
    private void RenderSettings()
    {
        if(_refreshing)return;_refreshing=true;
        try
        {
            _settings.Children.Clear();
            if(_list.SelectedItem is not ArchiveWebCharacter item)
            {Text("从网页选择角色并点击「放到桌面」，即可加入这里。");return;}
            Text(item.Name,18);Text(item.Game+" · "+item.Id);Text(item.Visible?"桌面显示中":"已保存，可随时显示");
            Button(item.Visible?"隐藏角色":"显示角色",async()=>{
                if(item.Visible)_hide(item.Selection);else await _show(item.Selection);
            });
            var host=_host(item.Selection);
            if(!string.IsNullOrWhiteSpace(host?.InteractionDescription))Text(host.InteractionDescription);
            if(host!=null)
            {
                var actions=new C.ComboBox{ItemsSource=host.Actions,DisplayMemberPath="Label",
                    SelectedValuePath="Id",SelectedValue=item.Action,Margin=new W.Thickness(0,8,0,8)};
                actions.SelectionChanged+=(_,_)=>{if(!_refreshing&&actions.SelectedValue is string id)host.Command("action",id);};
                _settings.Children.Add(actions);
                Button("放大",()=>{host.Command("zoomIn");return Task.CompletedTask;});
                Button("缩小",()=>{host.Command("zoomOut");return Task.CompletedTask;});
                Button("适应画面",()=>{host.Command("resetView");return Task.CompletedTask;});
            }
            var through=new C.CheckBox{Content="鼠标穿透",IsChecked=item.MouseThrough,
                Foreground=M.Brushes.White,Margin=new W.Thickness(0,8,0,8)};
            through.Click+=(_,_)=>{
                if(host!=null)host.SetMouseThrough(through.IsChecked==true);
                else _library.Put(item with{MouseThrough=through.IsChecked==true});
            };_settings.Children.Add(through);
            var voice=new C.CheckBox{Content="角色语音",IsChecked=item.Voice,
                Foreground=M.Brushes.White,Margin=new W.Thickness(0,8,0,8)};
            voice.Click+=(_,_)=>{
                bool enabled=voice.IsChecked==true;
                if(host!=null)host.Command("voice",enabled:enabled);
                else _library.Put(item with{Voice=enabled});
            };_settings.Children.Add(voice);
            Button("从列表移除",()=>{_remove(item.Selection);return Task.CompletedTask;});
        }
        finally {_refreshing=false;}
    }
    private void Text(string text,double size=13)=>_settings.Children.Add(new C.TextBlock{
        Text=text,FontSize=size,TextWrapping=W.TextWrapping.Wrap,Foreground=M.Brushes.White,
        Margin=new W.Thickness(0,0,0,10)});
    private void Button(string text,Func<Task> action)
    {
        var button=new C.Button{Content=text,Margin=new W.Thickness(0,4,0,4),Padding=new W.Thickness(8),MinHeight=32};
        button.Click+=async(_,_)=>{
            button.IsEnabled=false;
            try{await action();}
            catch(Exception error){W.MessageBox.Show(error.Message,"网页角色操作失败");}
            finally{Refresh();}
        };_settings.Children.Add(button);
    }
    public void Dispose()
    {_library.Changed-=Refresh;_search.TextChanged-=_searchChanged;}
}

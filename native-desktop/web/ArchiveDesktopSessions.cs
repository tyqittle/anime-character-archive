// SPDX-License-Identifier: GPL-3.0-or-later
namespace SpinePet;

// Owned by the UI thread. Each identity owns its own host, load and lifetime.
internal sealed class ArchiveDesktopSessions<T> : IDisposable where T:class,IDisposable
{
    private sealed class Entry(T host)
    {
        public readonly T Host=host;
        public readonly CancellationTokenSource Cancellation=new(TimeSpan.FromMinutes(6));
        public Task<T?> Opening=null!;
        public bool Ready,Disposed;
        public void Release(){if(!Disposed){Disposed=true;Host.Dispose();}}
    }
    private readonly Dictionary<ArchiveWebSelection,Entry> _entries=[];
    private readonly Func<ArchiveWebSelection,T> _create;
    private readonly Func<T,CancellationToken,Task> _open;
    private readonly Action<T,bool> _visible;
    private bool _disposed;
    public int Count=>_entries.Count;
    public ArchiveDesktopSessions(Func<ArchiveWebSelection,T> create,Func<T,CancellationToken,Task> open,Action<T,bool> visible)
    {_create=create;_open=open;_visible=visible;}
    public T? Find(ArchiveWebSelection selection)=>_entries.TryGetValue(selection,out var entry)&&entry.Ready?entry.Host:null;
    public Task<T?> ShowAsync(ArchiveWebSelection selection)
    {
        ObjectDisposedException.ThrowIf(_disposed,this);
        if(_entries.TryGetValue(selection,out var existing))
        {
            if(existing.Ready)_visible(existing.Host,true);
            return existing.Opening;
        }
        var entry=new Entry(_create(selection));
        _entries.Add(selection,entry);
        entry.Opening=OpenAsync(selection,entry);
        return entry.Opening;
    }
    private async Task<T?> OpenAsync(ArchiveWebSelection selection,Entry entry)
    {
        try
        {
            await _open(entry.Host,entry.Cancellation.Token);
            if(entry.Cancellation.IsCancellationRequested||!Owns(selection,entry))return null;
            entry.Ready=true;_visible(entry.Host,true);return entry.Host;
        }
        catch(OperationCanceledException) when(entry.Cancellation.IsCancellationRequested){return null;}
        catch {if(Owns(selection,entry))_entries.Remove(selection);entry.Release();throw;}
        finally
        {
            if(!entry.Ready){if(Owns(selection,entry))_entries.Remove(selection);entry.Release();}
            entry.Cancellation.Dispose();
        }
    }
    private bool Owns(ArchiveWebSelection selection,Entry entry)=>_entries.TryGetValue(selection,out var current)&&current==entry;
    public void Hide(ArchiveWebSelection selection)
    {
        if(!_entries.TryGetValue(selection,out var entry))return;
        if(entry.Ready)_visible(entry.Host,false);else Remove(selection);
    }
    public void Remove(ArchiveWebSelection selection)
    {
        if(!_entries.Remove(selection,out var entry))return;
        if(!entry.Ready)entry.Cancellation.Cancel();
        entry.Release();
    }
    public void Dispose()
    {
        if(_disposed)return;_disposed=true;
        foreach(var selection in _entries.Keys.ToArray())Remove(selection);
    }
}

// SPDX-License-Identifier: GPL-3.0-or-later
using System.Text.RegularExpressions;
namespace SpinePet;

internal sealed record ArchiveWebSelection(string Game, string Id)
{
    public static readonly Uri Site=new("https://tyqittle.github.io/anime-character-archive/");
    private static bool Identity(string? value)=>!string.IsNullOrWhiteSpace(value)&&
        value.Length<=256&&!value.Any(char.IsControl);
    public bool IsValid=>Identity(Game)&&Identity(Id);
    public static ArchiveWebSelection? Parse(string? value)
    {
        if(value==null||value.Length>4096||!Uri.TryCreate(value,UriKind.Absolute,out var uri)||
            uri.Scheme!="animecharacter"||uri.Host!="open"||!string.IsNullOrEmpty(uri.UserInfo)||
            !string.IsNullOrEmpty(uri.Fragment)||!uri.IsDefaultPort||
            (uri.AbsolutePath!=""&&uri.AbsolutePath!="/"))return null;
        var query=new Dictionary<string,string>(StringComparer.Ordinal);
        foreach(string part in uri.Query.TrimStart('?').Split('&'))
        {
            int index=part.IndexOf('=');if(index<=0)return null;
            string key=Uri.UnescapeDataString(part[..index].Replace("+"," "));
            string text=Uri.UnescapeDataString(part[(index+1)..].Replace("+"," "));
            if(!query.TryAdd(key,text))return null;
        }
        if(query.Count!=3||!query.TryGetValue("host",out var host)||host!="webview2"||
            !query.TryGetValue("game",out var game)||!query.TryGetValue("id",out var id))return null;
        var selection=new ArchiveWebSelection(game,id);
        return selection.IsValid?selection:null;
    }
    public Uri Page(Uri site,string session)
    {
        if(!IsValid||!Regex.IsMatch(session,@"^[a-f0-9]{32}$"))
            throw new ArgumentException("Invalid desktop selection");
        return new(site,"spine.html?desktop=1&transport=webview2&game="+
            Uri.EscapeDataString(Game)+"&id="+Uri.EscapeDataString(Id)+"&session="+session);
    }
    public static bool IsPage(string value,Uri site)=>
        Uri.TryCreate(value,UriKind.Absolute,out var uri)&&
        uri.Scheme==site.Scheme&&uri.Host==site.Host&&uri.Port==site.Port&&
        uri.AbsolutePath==new Uri(site,"spine.html").AbsolutePath&&string.IsNullOrEmpty(uri.UserInfo);
}

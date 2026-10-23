// SPDX-License-Identifier: GPL-3.0-or-later
using System.IO;
using System.Text.Json;
namespace SpinePet;

internal sealed record ArchiveWebCharacter(string Game,string Id,string Name,bool Visible=false,
    bool Voice=false,string Action="")
{
    public ArchiveWebSelection Selection=>new(Game,Id);
    public string Label=>$"{Name}\n{Game} · {(Visible?"桌面显示中":"已保存")}";
}

// UI-thread owned. Identity is the exact catalog (game, model ID), never a filename.
internal sealed class ArchiveWebLibrary
{
    private sealed record Document(int Version,List<ArchiveWebCharacter> Characters);
    private readonly string _path;
    private readonly List<ArchiveWebCharacter> _characters=[];
    public IReadOnlyList<ArchiveWebCharacter> Characters=>_characters;
    public event Action? Changed;
    private ArchiveWebLibrary(string path)=>_path=path;
    public static ArchiveWebLibrary Load(string path,string legacyPath)
    {
        var library=new ArchiveWebLibrary(path);
        if(File.Exists(path))
        {
            var document=JsonSerializer.Deserialize<Document>(File.ReadAllText(path))
                ??throw new InvalidDataException("网页角色清单为空");
            if(document.Version!=1)throw new InvalidDataException("不支持的网页角色清单版本");
            foreach(var item in document.Characters)
            {
                if(!item.Selection.IsValid)throw new InvalidDataException("网页角色标识无效");
                if(library.Find(item.Selection)==null)library._characters.Add(item);
            }
        }
        else if(File.Exists(legacyPath))
        {
            using var data=JsonDocument.Parse(File.ReadAllText(legacyPath));
            var state=data.RootElement;
            var selection=new ArchiveWebSelection(state.GetProperty("Game").GetString()??"",
                state.GetProperty("Id").GetString()??"");
            if(selection.IsValid)library._characters.Add(new(selection.Game,selection.Id,
                selection.Id,state.GetProperty("Visible").GetBoolean()));
            library.Save(); // The new empty list remains authoritative after removal.
        }
        return library;
    }
    public ArchiveWebCharacter? Find(ArchiveWebSelection selection)=>
        _characters.FirstOrDefault(x=>x.Game==selection.Game&&x.Id==selection.Id);
    public void Put(ArchiveWebCharacter character)
    {
        if(!character.Selection.IsValid)throw new ArgumentException("Invalid catalog identity");
        var next=_characters.ToList();
        int index=next.FindIndex(x=>x.Game==character.Game&&x.Id==character.Id);
        if(index<0)next.Add(character);else next[index]=character;
        if(character.Visible)
            for(int i=0;i<next.Count;i++)if(i!= (index<0?next.Count-1:index))next[i]=next[i] with{Visible=false};
        Commit(next);
    }
    public void Remove(ArchiveWebSelection selection)=>Commit(_characters.Where(x=>x.Selection!=selection).ToList());
    private void Commit(List<ArchiveWebCharacter> next)
    {
        Save(next); // A failed disk write must not pretend the record was persisted.
        _characters.Clear();_characters.AddRange(next);Changed?.Invoke();
    }
    private void Save(List<ArchiveWebCharacter>? items=null)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(_path))!);
        string temporary=_path+"."+Guid.NewGuid().ToString("N")+".tmp";
        try
        {
            File.WriteAllText(temporary,JsonSerializer.Serialize(new Document(1,items??_characters)));
            File.Move(temporary,_path,true);
        }
        finally {if(File.Exists(temporary))File.Delete(temporary);}
    }
}

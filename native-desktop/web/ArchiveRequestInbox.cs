// SPDX-License-Identifier: GPL-3.0-or-later
using System.IO;
namespace SpinePet;

internal sealed class ArchiveRequestInbox : IDisposable
{
    private readonly string _claimed;
    private ArchiveRequestInbox(string claimed){_claimed=claimed;}
    public static ArchiveRequestInbox? Claim(string path)
    {
        string claimed=path+"."+Guid.NewGuid().ToString("N")+".processing";
        try {File.Move(path,claimed);return new(claimed);}
        catch(FileNotFoundException){return null;}
        catch(DirectoryNotFoundException){return null;}
    }
    public Task<string> ReadAsync()
    {
        if(new FileInfo(_claimed).Length>4096)throw new InvalidDataException("Desktop request exceeds budget");
        return File.ReadAllTextAsync(_claimed);
    }
    public void Dispose(){if(File.Exists(_claimed))File.Delete(_claimed);}
}

// SPDX-License-Identifier: GPL-3.0-or-later
// Dedicated Brown Dust 2 import adapter for the existing native Spine 4.1
// renderer. No arbitrary user-supplied URLs, extracted archives or scripts.
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using SpinePet.Infrastructure;
using SpinePet.Infrastructure.Import;

namespace SpinePet;

public sealed partial class App
{
    private const string BrownDust2Catalog =
        "https://tyqittle.github.io/anime-character-archive/data/spine-bd2-characters.json";
    private const string TrustedBrownDust2 =
        "https://raw.githubusercontent.com/Zormolo/Brown-Dust-2-Assets/" +
        "94a3ac97b8fab7ee054e0826de7d912de0a233ef/assets/spine/character/";

    private static async Task<string> EnsureBrownDust2DownloadedAsync(string id)
    {
        if (!Regex.IsMatch(id, @"^bd2-char[0-9]{6}(?:_c)?$",
                RegexOptions.CultureInvariant))
            throw new InvalidDataException("Invalid Brown Dust 2 character identifier");

        byte[] catalogBytes = await ArchiveHttp.GetByteArrayAsync(BrownDust2Catalog);
        if (catalogBytes.Length is < 10 or > 2_000_000)
            throw new InvalidDataException("Unexpected Brown Dust 2 catalog size");
        using JsonDocument catalog = JsonDocument.Parse(catalogBytes);
        JsonElement selected = default;
        bool matched = false;
        foreach (JsonElement candidate in catalog.RootElement
                     .GetProperty("characters").EnumerateArray())
        {
            if (candidate.GetProperty("id").GetString() != id) continue;
            if (matched) throw new InvalidDataException("Duplicate Brown Dust 2 ID");
            matched = true;
            selected = candidate;
        }
        if (!matched)
            throw new InvalidDataException($"Brown Dust 2 character {id} not found");
        if (selected.GetProperty("gameId").GetString() != "browndust2")
            throw new InvalidDataException("Brown Dust 2 game ID mismatch");

        string url = selected.GetProperty("base").GetString() ?? "";
        // The website catalog is not allowed to direct the native client to
        // arbitrary hosts or repositories. Both repository AND immutable
        // upstream SHA must match exactly. The final stem must match the ID.
        if (!url.StartsWith(TrustedBrownDust2, StringComparison.Ordinal) ||
            !Uri.TryCreate(url, UriKind.Absolute, out Uri? uri) ||
            uri.Scheme != Uri.UriSchemeHttps ||
            uri.Host != "raw.githubusercontent.com" ||
            uri.Query.Length != 0 || uri.Fragment.Length != 0)
            throw new InvalidDataException("Brown Dust 2 source is not trusted");
        string relative = url[TrustedBrownDust2.Length..];
        string[] parts = relative.Split('/');
        if (parts.Length != 3 ||
            parts.Take(2).Any(part => !Regex.IsMatch(
                part, @"^[A-Za-z0-9_'-]+$", RegexOptions.CultureInvariant)) ||
            !Regex.IsMatch(parts[2], @"^char[0-9]{6}(?:_c)?$",
                RegexOptions.CultureInvariant) ||
            !string.Equals(id, "bd2-" + parts[2],
                StringComparison.Ordinal))
            throw new InvalidDataException("Brown Dust 2 asset path failed validation");

        string stem = parts[2];
        string characterName = selected.GetProperty("name").GetString() ?? id;
        char[] invalid = Path.GetInvalidFileNameChars();
        characterName = new string(characterName.Select(ch =>
            invalid.Contains(ch) || char.IsControl(ch) ? '_' : ch).ToArray())
            .Trim(' ', '.');
        if (characterName.Length == 0) characterName = id;
        if (characterName.Length > 90) characterName = characterName[..90];

        // Upstream resource discovery expects
        // res/<character>/<skin>/standing/<stem>.skel.
        // Include game and complete ID, so costumes cannot replace one another.
        string parent = Path.Combine(AppPaths.ResourceDirectory,
            "BD2 " + characterName, id);
        string standing = Path.Combine(parent, "standing");
        string skeleton = Path.Combine(standing, stem + ".skel");
        string atlas = Path.Combine(standing, stem + ".atlas");
        if (File.Exists(skeleton) && File.Exists(atlas))
        {
            SpineSkeletonCompatibility.EnsureSupported(skeleton);
            string[] existingPages = AtlasImagePages(
                await File.ReadAllTextAsync(atlas));
            if (existingPages.All(page =>
                    File.Exists(Path.Combine(standing, page))))
                return Path.GetFullPath(skeleton);
        }
        if (Directory.Exists(standing))
            throw new InvalidDataException(
                "Existing Brown Dust 2 model is incomplete. " +
                "Please repair the saved model before importing again.");

        // Preserve current downloaded assets and never publish half a model.
        Directory.CreateDirectory(parent);
        string staging = Path.Combine(parent,
            ".archive-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(staging);
        try
        {
            byte[] atlasBytes = await ArchiveHttp.GetByteArrayAsync(url + ".atlas");
            if (atlasBytes.Length is < 50 or > 2_000_000)
                throw new InvalidDataException("Unexpected Brown Dust 2 atlas size");
            string[] pages = AtlasImagePages(Encoding.UTF8.GetString(atlasBytes));
            byte[] skelBytes = await ArchiveHttp.GetByteArrayAsync(url + ".skel");
            if (skelBytes.Length is < 256 or > 30_000_000)
                throw new InvalidDataException("Unexpected Brown Dust 2 skeleton size");
            string stagedSkeleton = Path.Combine(staging, stem + ".skel");
            await File.WriteAllBytesAsync(stagedSkeleton, skelBytes);
            // Rely on My_SpinePet's real Spine 4.1 parser. Web metadata can
            // claim 4.1 when a source file is actually another runtime version.
            SpineSkeletonCompatibility.EnsureSupported(stagedSkeleton);
            await File.WriteAllBytesAsync(
                Path.Combine(staging, stem + ".atlas"), atlasBytes);
            string folderUrl = url[..(url.LastIndexOf('/') + 1)];
            foreach (string page in pages)
            {
                byte[] texture = await ArchiveHttp.GetByteArrayAsync(folderUrl + page);
                if (texture.Length is < 100 or > 50_000_000)
                    throw new InvalidDataException("Unexpected texture size: " + page);
                await File.WriteAllBytesAsync(Path.Combine(staging, page), texture);
            }
            Directory.Move(staging, standing);
        }
        finally
        {
            if (Directory.Exists(staging))
                Directory.Delete(staging, recursive: true);
        }
        return Path.GetFullPath(skeleton);
    }
}

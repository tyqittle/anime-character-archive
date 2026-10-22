// SPDX-License-Identifier: GPL-3.0-or-later
// A small integration extension for the original GPL My_SpinePet Windows app.
// The existing Direct3D11/DirectComposition rendering engine is NOT modified.
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Windows;
using Microsoft.Win32;
using SpinePet.Infrastructure;
using SpinePet.Services;

namespace SpinePet;

public sealed partial class App
{
    private const string ArchiveRequestName = ".anime-archive-show.json";
    private const string ArchiveCatalog =
        "https://tyqittle.github.io/anime-character-archive/data/spine-characters.json";
    private const string TrustedNikke =
        "https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/";
    private static readonly HttpClient ArchiveHttp = new()
    {
        Timeout = TimeSpan.FromSeconds(110)
    };

    private readonly SemaphoreSlim _archiveShowGate = new(1, 1);
    private CharacterResourceDiscoveryService? _archiveDiscovery;
    private sealed record ArchiveShowRequest(string ResourceName);

    private static string ArchiveRequestPath =>
        Path.Combine(AppPaths.LocalDataDirectory, ArchiveRequestName);

    // The browser invokes "SpinePet.exe animecharacter://open?id=c015".
    // This is a strict identifier, NEVER a user-supplied path or download URL.
    private static string? ParseArchiveUrl(string? arg)
    {
        if (arg == null) return null;
        Match m = Regex.Match(arg,
            @"^animecharacter://open/?\?id=(c[0-9]{3,6}(?:_[0-9]{2})?)$",
            RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
        return m.Success ? m.Groups[1].Value.ToLowerInvariant() : null;
    }

    private void AcceptArchiveStartupArgs(string[] args)
    {
        if (args.Length != 1) return;
        string? id = ParseArchiveUrl(args[0]);
        if (id == null) return;
        SaveArchiveRequest(id);
    }

    private static void SaveArchiveRequest(string resourceId)
    {
        Directory.CreateDirectory(AppPaths.LocalDataDirectory);
        var request = new ArchiveShowRequest(resourceId);
        string temp = ArchiveRequestPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            File.WriteAllText(temp, JsonSerializer.Serialize(request), Encoding.UTF8);
            File.Move(temp, ArchiveRequestPath, overwrite: true);
        }
        finally
        {
            if (File.Exists(temp)) File.Delete(temp);
        }
    }

    private void OfferArchiveProtocolRegistration()
    {
        // Registration is per-user only, with an explicit one-time opt-in.
        // The app never silently takes over a protocol registered to another app.
        try
        {
            using var existing = Registry.CurrentUser.OpenSubKey(
                @"Software\Classes\animecharacter\shell\open\command");
            string? current = existing?.GetValue(null) as string;
            string exe = Environment.ProcessPath ??
                Path.Combine(AppContext.BaseDirectory, "SpinePet.exe");
            string desired = $"\"{exe}\" \"%1\"";
            if (string.Equals(current, desired, StringComparison.OrdinalIgnoreCase))
                return;

            var answer = System.Windows.MessageBox.Show(
                "启用本站「放到桌面」一键导入吗？\n" +
                "启用后，浏览器可以请求此程序下载经过来源验证的妮姬 Spine 4.1 模型并在桌面显示。\n" +
                "此设置仅影响当前 Windows 用户，可随时在系统的默认应用设置中更改。",
                "次元立绘 · 网站一键导入", MessageBoxButton.YesNo,
                MessageBoxImage.Question);
            if (answer != MessageBoxResult.Yes) return;
            using var root = Registry.CurrentUser.CreateSubKey(
                @"Software\Classes\animecharacter");
            if (root == null) throw new IOException("Cannot register URL scheme");
            root.SetValue(null, "URL:Anime Character Archive Native");
            root.SetValue("URL Protocol", string.Empty);
            using var command = Registry.CurrentUser.CreateSubKey(
                @"Software\Classes\animecharacter\shell\open\command");
            if (command == null) throw new IOException("Cannot set URL command");
            command.SetValue(null, desired);
        }
        catch (Exception ex)
        {
            AppLogger.Write(nameof(App),
                $"archive-protocol-registration-failed {ex.GetType().Name} {ex.Message}");
        }
    }

    private async Task RestoreArchiveCharactersAsync()
    {
        await RestoreCharactersAsync();
        await ShowArchiveRequestAsync();
    }

    private async Task ShowArchiveRequestAsync()
    {
        if (_characterManager == null || _archiveDiscovery == null || IsShutdownRequested)
            return;
        if (!await _archiveShowGate.WaitAsync(0)) return;
        try
        {
            if (!File.Exists(ArchiveRequestPath)) return;
            var request = JsonSerializer.Deserialize<ArchiveShowRequest>(
                await File.ReadAllTextAsync(ArchiveRequestPath));
            string id = request?.ResourceName ?? "";
            if (!Regex.IsMatch(id, @"^c[0-9]{3,6}(?:_[0-9]{2})?$",
                    RegexOptions.CultureInvariant))
            {
                AppLogger.Write(nameof(App), "archive-invalid-character-id");
                File.Delete(ArchiveRequestPath);
                return;
            }

            string stem = await EnsureArchiveModelDownloadedAsync(id);
            SynchronizeDiscoveredResources(_archiveDiscovery);
            var character = _characterManager.Characters.FirstOrDefault(c =>
                string.Equals(Path.GetFileNameWithoutExtension(c.SkeletonPath),
                    stem, StringComparison.OrdinalIgnoreCase));
            if (character == null)
                throw new InvalidDataException("The native Spine 4.1 parser rejected this model.");

            // Use upstream My_SpinePet's built-in animation rendering and state.
            await _characterManager.ShowCharacterAsync(character);
            File.Delete(ArchiveRequestPath);
            AppLogger.Write(nameof(App), $"archive-one-click-shown {stem}");
        }
        catch (Exception ex)
        {
            AppLogger.Write(nameof(App),
                $"archive-one-click-failed {ex.GetType().Name}: {ex.Message}");
            System.Windows.MessageBox.Show(ex.Message, "一键导入失败",
                MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        finally
        {
            _archiveShowGate.Release();
        }
    }

    private static async Task<string> EnsureArchiveModelDownloadedAsync(string id)
    {
        byte[] manifestBytes = await ArchiveHttp.GetByteArrayAsync(ArchiveCatalog);
        if (manifestBytes.Length > 4_000_000)
            throw new InvalidDataException("Catalog size exceeds safety limit");
        using JsonDocument manifest = JsonDocument.Parse(manifestBytes);
        JsonElement found = default;
        bool matched = false;
        foreach (JsonElement entry in manifest.RootElement.GetProperty("characters").EnumerateArray())
        {
            if (entry.GetProperty("id").GetString() != id) continue;
            if (matched) throw new InvalidDataException("Duplicate character IDs");
            found = entry;
            matched = true;
        }
        if (!matched) throw new InvalidDataException($"Character {id} not found");
        if (found.GetProperty("gameId").GetString() != "nikke" ||
            found.GetProperty("spineVersion").GetString() != "4.1" ||
            (found.TryGetProperty("versionUnverified", out var unverified) &&
             unverified.ValueKind == JsonValueKind.True))
            throw new InvalidDataException("Native renderer currently supports verified NIKKE Spine 4.1 only");

        string modelUrl = found.GetProperty("base").GetString() ?? "";
        if (!modelUrl.StartsWith(TrustedNikke + id + "/", StringComparison.Ordinal) ||
            !Regex.IsMatch(modelUrl, @"/c[0-9]{3,6}(?:_[0-9]{2})?_[0-9]{2}$",
                RegexOptions.CultureInvariant))
            throw new InvalidDataException("Asset URL is not a trusted Nikke-db resource");

        string stem = modelUrl[(modelUrl.LastIndexOf('/') + 1)..];
        if (!stem.StartsWith(id + "_", StringComparison.Ordinal))
            throw new InvalidDataException("ID mismatch in asset URL");
        string skin = stem[(id.Length + 1)..];
        if (!Regex.IsMatch(skin, @"^[0-9]{2}$", RegexOptions.CultureInvariant))
            throw new InvalidDataException("Skin identifier is not a supported numeric code");

        string name = found.GetProperty("name").GetString() ?? id;
        var invalid = Path.GetInvalidFileNameChars();
        name = new string(name.Select(ch => invalid.Contains(ch) ? '_' : ch).ToArray())
            .Trim(' ', '.');
        if (name.Length == 0 || name is "." or "..") name = id;
        name = name.Length > 120 ? name[..120] : name;
        string parent = Path.Combine(AppPaths.ResourceDirectory, name, skin);
        string standing = Path.Combine(parent, "standing");
        string skeleton = Path.Combine(standing, stem + ".skel");
        string atlas = Path.Combine(standing, stem + ".atlas");
        if (File.Exists(skeleton) && File.Exists(atlas))
        {
            string[] pages = AtlasImagePages(await File.ReadAllTextAsync(atlas));
            if (pages.All(page => File.Exists(Path.Combine(standing, page))))
                return stem;
        }
        if (Directory.Exists(standing))
            throw new InvalidDataException("Existing model folder is incomplete. Please remove or repair it manually.");

        // Download to a staging folder and atomically publish the complete pack.
        // Never unzip arbitrary inputs or trust remote path components.
        Directory.CreateDirectory(parent);
        string temporary = Path.Combine(parent, ".archive-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temporary);
        try
        {
            byte[] atlasBytes = await ArchiveHttp.GetByteArrayAsync(modelUrl + ".atlas");
            if (atlasBytes.Length is < 50 or > 2_000_000)
                throw new InvalidDataException("Unexpected atlas size");
            string[] pages = AtlasImagePages(Encoding.UTF8.GetString(atlasBytes));
            byte[] skeletonBytes = await ArchiveHttp.GetByteArrayAsync(modelUrl + ".skel");
            if (skeletonBytes.Length is < 256 or > 30_000_000)
                throw new InvalidDataException("Unexpected skeleton size");
            await File.WriteAllBytesAsync(Path.Combine(temporary, stem + ".skel"), skeletonBytes);
            await File.WriteAllBytesAsync(Path.Combine(temporary, stem + ".atlas"), atlasBytes);
            string folderUrl = modelUrl[..(modelUrl.LastIndexOf('/') + 1)];
            foreach (string page in pages)
            {
                byte[] image = await ArchiveHttp.GetByteArrayAsync(folderUrl + page);
                if (image.Length is < 100 or > 50_000_000)
                    throw new InvalidDataException($"Unexpected texture size: {page}");
                await File.WriteAllBytesAsync(Path.Combine(temporary, page), image);
            }
            Directory.Move(temporary, standing);
        }
        finally
        {
            if (Directory.Exists(temporary)) Directory.Delete(temporary, recursive: true);
        }
        return stem;
    }

    private static string[] AtlasImagePages(string atlas)
    {
        var pages = atlas.Split('\n')
            .Select(line => line.Trim())
            .Where(line => Regex.IsMatch(line, @"^[A-Za-z0-9._-]+\.png$",
                RegexOptions.CultureInvariant))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        if (pages.Length is < 1 or > 16)
            throw new InvalidDataException("Incomplete or unsafe atlas page list");
        return pages;
    }
}

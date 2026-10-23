// SPDX-License-Identifier: GPL-3.0-or-later
// Self-heal legacy site-managed model folders without touching user models
// elsewhere in the configured resource library.
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using SpinePet.Infrastructure;
using SpinePet.Infrastructure.Import;

namespace SpinePet;

public sealed partial class App
{
    private const string ArchiveAssetReceiptFile = ".archive-source-v2.json";

    private sealed record ArchiveAssetReceipt(
        string SourceUrl,
        Dictionary<string, string> FileHashes);

    private static async Task<bool> VerifyArchiveReceiptAsync(
        string standing, string sourceUrl)
    {
        string path = Path.Combine(standing, ArchiveAssetReceiptFile);
        if (!File.Exists(path)) return false;
        try
        {
            ArchiveAssetReceipt? receipt =
                JsonSerializer.Deserialize<ArchiveAssetReceipt>(
                    await File.ReadAllTextAsync(path));
            if (receipt?.SourceUrl != sourceUrl ||
                receipt.FileHashes == null ||
                receipt.FileHashes.Count < 3)
                return false;
            foreach (var entry in receipt.FileHashes)
            {
                // Receipt keys are produced only from validated atlas page
                // names and the skeleton / atlas names.
                if (entry.Key != Path.GetFileName(entry.Key) ||
                    !File.Exists(Path.Combine(standing, entry.Key)))
                    return false;
                string digest = await ComputeArchiveFileHashAsync(
                    Path.Combine(standing, entry.Key));
                if (!string.Equals(digest, entry.Value,
                        StringComparison.OrdinalIgnoreCase))
                    return false;
            }
            return true;
        }
        catch (Exception ex) when (ex is IOException ||
                                   ex is UnauthorizedAccessException ||
                                   ex is JsonException ||
                                   ex is ArgumentException)
        {
            AppLogger.Write(nameof(App),
                "archive-cache-receipt-invalid " + ex.Message);
            return false;
        }
    }

    private static async Task<string> ComputeArchiveFileHashAsync(string path)
    {
        await using FileStream file = new(
            path, FileMode.Open, FileAccess.Read, FileShare.Read,
            bufferSize: 131072, useAsync: true);
        byte[] hash = await SHA256.HashDataAsync(file);
        return Convert.ToHexString(hash);
    }

    // Stamp freshly downloaded atomic packs immediately, avoiding an
    // unnecessary second network verification at their next import.
    private static async Task WriteArchiveReceiptForFreshDownloadAsync(
        string directory, string stem, string sourceUrl)
    {
        string atlasName = stem + ".atlas";
        string skeletonName = stem + ".skel";
        string[] pages = AtlasImagePages(
            await File.ReadAllTextAsync(Path.Combine(directory, atlasName)));
        var hashes = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (string filename in pages.Append(skeletonName)
            .Append(atlasName).Distinct())
        {
            hashes[filename] = await ComputeArchiveFileHashAsync(
                Path.Combine(directory, filename));
        }
        await File.WriteAllTextAsync(
            Path.Combine(directory, ArchiveAssetReceiptFile),
            JsonSerializer.Serialize(new ArchiveAssetReceipt(sourceUrl, hashes)));
    }

    // Called only for a site-managed *complete* pack whose legacy files
    // were previously trusted based on File.Exists alone. The remote URL has
    // already passed the game's strict allowlist and identifier validation.
    // Normal subsequent imports verify LOCAL digests and incur zero downloads.
    private static async Task VerifyOrRepairArchiveModelAsync(
        string standing, string stem, string sourceUrl)
    {
        if (await VerifyArchiveReceiptAsync(standing, sourceUrl))
            return;

        string parent = Path.GetDirectoryName(standing)
            ?? throw new InvalidDataException("Invalid managed model path");
        string staging = Path.Combine(parent,
            ".archive-recheck-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(staging);
        try
        {
            byte[] atlasBytes =
                await ArchiveHttp.GetByteArrayAsync(sourceUrl + ".atlas");
            byte[] skeletonBytes =
                await ArchiveHttp.GetByteArrayAsync(sourceUrl + ".skel");
            if (atlasBytes.Length is < 50 or > 2_000_000 ||
                skeletonBytes.Length is < 256 or > 30_000_000)
                throw new InvalidDataException("Unexpected model metadata size");

            string skeletonName = stem + ".skel";
            string atlasName = stem + ".atlas";
            await File.WriteAllBytesAsync(
                Path.Combine(staging, skeletonName), skeletonBytes);
            SpineSkeletonCompatibility.EnsureSupported(
                Path.Combine(staging, skeletonName));
            await File.WriteAllBytesAsync(
                Path.Combine(staging, atlasName), atlasBytes);

            var pages = AtlasImagePages(
                System.Text.Encoding.UTF8.GetString(atlasBytes));
            string folderUrl =
                sourceUrl[..(sourceUrl.LastIndexOf('/') + 1)];
            foreach (string page in pages)
            {
                byte[] image =
                    await ArchiveHttp.GetByteArrayAsync(folderUrl + page);
                if (image.Length is < 100 or > 50_000_000)
                    throw new InvalidDataException(
                        "Unexpected atlas image size: " + page);
                await File.WriteAllBytesAsync(
                    Path.Combine(staging, page), image);
            }

            var hashes = new Dictionary<string, string>(
                StringComparer.Ordinal);
            foreach (string filename in pages
                .Append(skeletonName).Append(atlasName).Distinct())
            {
                hashes[filename] = await ComputeArchiveFileHashAsync(
                    Path.Combine(staging, filename));
            }
            var receipt = new ArchiveAssetReceipt(sourceUrl, hashes);
            string receiptJson = JsonSerializer.Serialize(receipt);

            bool identical = true;
            foreach (var entry in hashes)
            {
                string current = Path.Combine(standing, entry.Key);
                if (!File.Exists(current) ||
                    !string.Equals(
                        await ComputeArchiveFileHashAsync(current),
                        entry.Value, StringComparison.OrdinalIgnoreCase))
                {
                    identical = false;
                    break;
                }
            }
            if (identical)
            {
                // Old model was already correct: keep every original file.
                // Only publish a source-verified digest receipt.
                await File.WriteAllTextAsync(
                    Path.Combine(standing, ArchiveAssetReceiptFile),
                    receiptJson);
                return;
            }

            // Entire package is validated BEFORE replacing anything.
            // Same-volume renames allow rollback if publishing fails.
            await File.WriteAllTextAsync(
                Path.Combine(staging, ArchiveAssetReceiptFile),
                receiptJson);
            string backup = Path.Combine(parent,
                ".archive-replaced-" + Guid.NewGuid().ToString("N"));
            Directory.Move(standing, backup);
            try
            {
                Directory.Move(staging, standing);
            }
            catch
            {
                Directory.Move(backup, standing);
                throw;
            }
            try
            {
                Directory.Delete(backup, recursive: true);
            }
            catch (IOException ex)
            {
                // A loaded old texture may still be held briefly by another
                // renderer. The hidden backup does not replace the new pack.
                AppLogger.Write(nameof(App),
                    "archive-cache-backup-cleanup " + ex.Message);
            }
            AppLogger.Write(nameof(App),
                "archive-cache-repaired source=" + sourceUrl +
                " files=" + hashes.Count);
        }
        catch (Exception ex) when (ex is System.Net.Http.HttpRequestException ||
                                   ex is TaskCanceledException)
        {
            // Previously downloaded characters must remain usable offline.
            // Do not replace a working legacy pack if its trusted source is
            // temporarily unreachable; retry verification on next import.
            string skeleton = Path.Combine(standing, stem + ".skel");
            string atlas = Path.Combine(standing, stem + ".atlas");
            if (!File.Exists(skeleton) || !File.Exists(atlas))
                throw;
            SpineSkeletonCompatibility.EnsureSupported(skeleton);
            string[] pages = AtlasImagePages(
                await File.ReadAllTextAsync(atlas));
            if (!pages.All(page => File.Exists(Path.Combine(standing, page))))
                throw;
            AppLogger.Write(nameof(App),
                "archive-cache-verify-deferred-offline " + ex.Message);
        }
        finally
        {
            if (Directory.Exists(staging))
                Directory.Delete(staging, recursive: true);
        }
    }
}

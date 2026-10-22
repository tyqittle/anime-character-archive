// SPDX-License-Identifier: GPL-3.0-or-later
// Archive extension to KAIDO-YONAGI/My_SpinePet, pinned GPL source.
// This extension does NOT replace or fork the upstream D3D11 renderer.
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
using SpinePet.Infrastructure;
using SpinePet.Services;

namespace SpinePet;

public sealed partial class App
{
    private const string ArchiveRequestName = ".anime-archive-show.json";
    private readonly SemaphoreSlim _archiveShowGate = new(1, 1);
    private CharacterResourceDiscoveryService? _archiveDiscovery;

    private sealed record ArchiveShowRequest(string ResourceName);

    private async Task RestoreArchiveCharactersAsync()
    {
        await RestoreCharactersAsync();
        await ShowArchiveRequestAsync();
    }

    private async Task ShowArchiveRequestAsync()
    {
        if (_characterManager == null || _archiveDiscovery == null || IsShutdownRequested)
            return;
        if (!await _archiveShowGate.WaitAsync(0))
            return;
        try
        {
            string requestPath = Path.Combine(AppPaths.ResourceDirectory, ArchiveRequestName);
            if (!File.Exists(requestPath))
                return;

            string json = await File.ReadAllTextAsync(requestPath);
            ArchiveShowRequest? request = JsonSerializer.Deserialize<ArchiveShowRequest>(json);
            string resourceName = request?.ResourceName ?? string.Empty;
            if (!Regex.IsMatch(resourceName, @"^c[0-9]{3,6}_[0-9]{2}$",
                    RegexOptions.CultureInvariant))
            {
                AppLogger.Write(nameof(App), "archive-bridge-rejected-invalid-resource");
                return;
            }

            // Reuse My_SpinePet's genuine resource discovery/version checks,
            // catalog state and show animation code, not a separate renderer.
            SynchronizeDiscoveredResources(_archiveDiscovery);
            var character = _characterManager.Characters.FirstOrDefault(c =>
                string.Equals(Path.GetFileNameWithoutExtension(c.SkeletonPath),
                    resourceName, StringComparison.OrdinalIgnoreCase));
            if (character == null)
            {
                AppLogger.Write(nameof(App), $"archive-bridge-resource-not-found {resourceName}");
                return;
            }

            await _characterManager.ShowCharacterAsync(character);
            File.Delete(requestPath);
            AppLogger.Write(nameof(App), $"archive-bridge-character-shown {resourceName}");
        }
        catch (Exception exception)
        {
            AppLogger.Write(nameof(App), $"archive-bridge-failed {exception.GetType().Name} {exception.Message}");
            // Keep the request so the next app activation can retry.
        }
        finally
        {
            _archiveShowGate.Release();
        }
    }
}

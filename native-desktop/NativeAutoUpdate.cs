// SPDX-License-Identifier: GPL-3.0-or-later
// Native Windows auto-updates via open-source Velopack (MIT).
// Only use the repository's public GitHub Releases; never execute remote scripts.
using System.IO;
using System.Windows;
using Velopack;
using Velopack.Sources;
using Velopack.Exceptions;
using SpinePet.Infrastructure;
using System.Windows.Threading;

namespace SpinePet;

public sealed partial class App
{
    private const string ArchiveUpdateRepository =
        "https://github.com/tyqittle/anime-character-archive";
    private int _archiveUpdateStarted;
    private DispatcherTimer? _archiveUpdateTimer;

    private void StartArchiveUpdateLoop()
    {
        if (_archiveUpdateTimer != null) return;
        _archiveUpdateTimer = new DispatcherTimer(
            DispatcherPriority.Background, Dispatcher)
        {
            Interval = TimeSpan.FromHours(8)
        };
        _archiveUpdateTimer.Tick += (_, _) =>
        {
            if (IsShutdownRequested)
            {
                _archiveUpdateTimer?.Stop();
                return;
            }
            _ = CheckArchiveUpdatesAsync();
        };
        _archiveUpdateTimer.Start();
        _ = CheckArchiveUpdatesAsync();
    }

    private async Task CheckArchiveUpdatesAsync()
    {
        if (Interlocked.Exchange(ref _archiveUpdateStarted, 1) != 0)
            return;
        try
        {
            // Keep startup and any existing protocol-migration prompt responsive.
            await Task.Delay(TimeSpan.FromSeconds(8));
            if (IsShutdownRequested) return;

            string marker = Path.Combine(AppPaths.LocalDataDirectory,
                "native-archive-update-check.txt");
            if (File.Exists(marker) &&
                DateTimeOffset.TryParse(await File.ReadAllTextAsync(marker),
                    out DateTimeOffset lastCheck) &&
                DateTimeOffset.UtcNow - lastCheck < TimeSpan.FromHours(8))
                return;

            var manager = new UpdateManager(new GithubSource(
                ArchiveUpdateRepository, accessToken: null, prerelease: false));
            // This check throws NotInstalledException for legacy portable ZIPs.
            var newer = await manager.CheckForUpdatesAsync();
            Directory.CreateDirectory(AppPaths.LocalDataDirectory);
            await File.WriteAllTextAsync(marker,
                DateTimeOffset.UtcNow.ToString("O"));
            if (newer == null || IsShutdownRequested) return;

            // Velopack verifies update package size/hash, then installs after
            // user consent. Do not silently run downloaded executables.
            await manager.DownloadUpdatesAsync(newer);
            if (IsShutdownRequested) return;
            var choice = System.Windows.MessageBox.Show(
                "新版本的次元桌面立绘已经自动下载并通过更新包校验。\n" +
                "是否保存当前人物状态，安装更新并重启？\n" +
                "选择“否”会保留已下载的更新包。",
                "次元桌面立绘 · 自动更新",
                System.Windows.MessageBoxButton.YesNo, System.Windows.MessageBoxImage.Question);
            if (choice != System.Windows.MessageBoxResult.Yes) return;
            _characterManager?.SaveAllState();
            manager.ApplyUpdatesAndRestart(newer);
        }
        catch (NotInstalledException)
        {
            // Portable ZIP cannot safely mutate itself. Switching one time to
            // Velopack Setup.exe gives future installations a stable updater.
        }
        catch (Exception ex)
        {
            AppLogger.Write(nameof(App),
                $"archive-auto-update-failed {ex.GetType().Name}: {ex.Message}");
        }
        finally
        {
            Volatile.Write(ref _archiveUpdateStarted, 0);
        }
    }
}

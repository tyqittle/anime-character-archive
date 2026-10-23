// SPDX-License-Identifier: GPL-3.0-or-later
// Velopack native update integration. Scheduled checks remain quiet; the
// visible button always bypasses the eight-hour scheduled-check throttle.
using System.IO;
using System.Windows;
using Button = System.Windows.Controls.Button;
using System.Windows.Threading;
using Velopack;
using Velopack.Sources;
using Velopack.Exceptions;
using SpinePet.Infrastructure;

namespace SpinePet;

public sealed partial class App
{
    private const string ArchiveUpdateRepository =
        "https://github.com/tyqittle/anime-character-archive";
    private int _archiveUpdateStarted;
    private DispatcherTimer? _archiveUpdateTimer;
    private Button? _archiveUpdateButton;

    private void SetArchiveUpdateButton(string label, bool enabled = true)
    {
        if (_archiveUpdateButton == null || Dispatcher.HasShutdownStarted) return;
        _archiveUpdateButton.Content = label;
        _archiveUpdateButton.IsEnabled = enabled;
    }

    private void StartArchiveUpdateLoop()
    {
        // The main window is created from XAML and is already shown here.
        // Its update control is not a second updater EXE.
        if (_archiveUpdateButton == null && _mainWindow != null)
        {
            _archiveUpdateButton =
                _mainWindow.FindName("ManualUpdateButton") as Button;
            if (_archiveUpdateButton != null)
            {
                _archiveUpdateButton.ToolTip =
                    "当前程序版本：" +
                    (typeof(App).Assembly.GetName().Version?.ToString() ?? "未知") +
                    "；从 GitHub Releases 在线检查更新，无需重新下载安装包。";
                _archiveUpdateButton.Click += (_, _) =>
                    _ = CheckArchiveUpdatesAsync(manual: true);
            }
        }
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
            _ = CheckArchiveUpdatesAsync(manual: false);
        };
        _archiveUpdateTimer.Start();
        _ = CheckArchiveUpdatesAsync(manual: false, onStartup: true);
    }

    private async Task CheckArchiveUpdatesAsync(
        bool manual = false, bool onStartup = false)
    {
        if (Interlocked.Exchange(ref _archiveUpdateStarted, 1) != 0)
        {
            if (manual && !IsShutdownRequested)
                MessageBox.Show("已有更新检查正在进行，请查看更新状态。",
                    "次元桌面立绘", MessageBoxButton.OK,
                    MessageBoxImage.Information);
            return;
        }

        try
        {
            if (manual)
                SetArchiveUpdateButton("检查中…", false);
            else
                await Task.Delay(TimeSpan.FromSeconds(8));

            if (IsShutdownRequested) return;

            string marker = Path.Combine(AppPaths.LocalDataDirectory,
                "native-archive-update-check.txt");
            if (!manual && !onStartup && File.Exists(marker) &&
                DateTimeOffset.TryParse(await File.ReadAllTextAsync(marker),
                    out DateTimeOffset lastCheck) &&
                DateTimeOffset.UtcNow - lastCheck < TimeSpan.FromHours(8))
                return;

            var manager = new UpdateManager(new GithubSource(
                ArchiveUpdateRepository, accessToken: null, prerelease: false));
            // A portable ZIP is not a Velopack installation and cannot safely
            // update itself. Explain this instead of silently doing nothing.
            var newer = await manager.CheckForUpdatesAsync();
            Directory.CreateDirectory(AppPaths.LocalDataDirectory);
            await File.WriteAllTextAsync(marker,
                DateTimeOffset.UtcNow.ToString("O"));

            if (newer == null)
            {
                if (manual && !IsShutdownRequested)
                    MessageBox.Show("当前已经是最新版，无需重新下载 EXE。",
                        "次元桌面立绘 · 检查更新",
                        MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            if (IsShutdownRequested) return;

            SetArchiveUpdateButton("下载更新…", false);
            await manager.DownloadUpdatesAsync(newer, percent =>
            {
                if (Dispatcher.HasShutdownStarted) return;
                _ = Dispatcher.BeginInvoke(new Action(() =>
                    SetArchiveUpdateButton($"下载 {percent}%", false)));
            });
            if (IsShutdownRequested) return;

            // Keep the user's chosen app and asset paths: Velopack installs
            // an update in place; the outer two-folder wizard is NOT rerun.
            SetArchiveUpdateButton("更新已就绪", true);
            var choice = MessageBox.Show(
                "新版本已下载并通过更新包校验。\n" +
                "是否保存当前角色状态、安装更新并重启？\n" +
                "选择“否”会保留下载的更新包。",
                "次元桌面立绘 · 自动更新",
                MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (choice != MessageBoxResult.Yes) return;
            _characterManager?.SaveAllState();
            manager.ApplyUpdatesAndRestart(newer);
        }
        catch (NotInstalledException)
        {
            if (manual && !IsShutdownRequested)
                MessageBox.Show(
                    "当前运行的是便携版，无法原地自动更新。\n" +
                    "请先安装一次官方双目录安装版，以后就能在这里直接更新。",
                    "次元桌面立绘 · 便携版",
                    MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            AppLogger.Write(nameof(App),
                $"archive-update-failed {ex.GetType().Name}: {ex.Message}");
            if (manual && !IsShutdownRequested)
                MessageBox.Show(
                    "检查更新失败：" + ex.Message +
                    "\n请确认网络能够访问 GitHub Releases 后重试。",
                    "次元桌面立绘 · 更新失败",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        finally
        {
            SetArchiveUpdateButton("检查更新");
            Volatile.Write(ref _archiveUpdateStarted, 0);
        }
    }
}

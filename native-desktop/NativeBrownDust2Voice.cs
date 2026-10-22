// SPDX-License-Identifier: GPL-3.0-or-later
// Brown Dust 2 native click voices, fetched on demand from a pinned public
// source. No character voice audio is bundled into the installer.
// Native renderer click callbacks are carried to the WPF UI dispatcher.
using System.IO;
using System.Text.RegularExpressions;
using System.Windows.Media;
using SpinePet.Infrastructure;

namespace SpinePet;

internal static class NativeDesktopVoiceRelay
{
    internal static event Action<string>? Clicked;

    internal static void NotifyClicked(string characterId) =>
        Clicked?.Invoke(characterId);
}

public sealed partial class App
{
    private const string BrownDust2VoiceRoot =
        "https://raw.githubusercontent.com/Jelosus2/BD2-L2D-Viewer/" +
        "b899b929df3e3ea883984a05f83c944608a27cb4/src/assets/audios/";

    private MediaPlayer? _brownDust2VoicePlayer;
    private int _brownDust2VoiceSequence;
    private int _brownDust2VoiceClipIndex;

    private void InitializeBrownDust2Voice()
    {
        // Click is raised by the native PointerController only after a genuine
        // mouse click on opaque character pixels (not while dragging).
        NativeDesktopVoiceRelay.Clicked += characterId =>
        {
            if (IsShutdownRequested || Dispatcher.HasShutdownStarted) return;
            _ = Dispatcher.BeginInvoke(new Action(() =>
                _ = PlayBrownDust2VoiceAsync(characterId)));
        };
    }

    private async Task PlayBrownDust2VoiceAsync(string characterId)
    {
        try
        {
            var character = _characterManager?.Characters.FirstOrDefault(
                c => string.Equals(c.Id, characterId, StringComparison.Ordinal));
            if (character == null) return;
            string? standing = Path.GetDirectoryName(character.SkeletonPath);
            if (string.IsNullOrEmpty(standing) ||
                !string.Equals(Path.GetFileName(standing), "standing",
                    StringComparison.OrdinalIgnoreCase)) return;
            string? costumeDir = Path.GetDirectoryName(standing);
            string costumeId = Path.GetFileName(costumeDir ?? "");
            // Prevent a local arbitrary resource path from becoming a voice URL.
            if (!Regex.IsMatch(costumeId,
                @"^bd2-char[0-9]{6}(?:_c)?$", RegexOptions.CultureInvariant))
                return;
            string root = Path.GetFullPath(AppPaths.ResourceDirectory)
                .TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (!Path.GetFullPath(standing).StartsWith(root,
                StringComparison.OrdinalIgnoreCase)) return;

            string code = costumeId.Substring(8); // "bd2-char" is 8 chars
            // In the pinned voice archive _c costumes have a suffixed
            // directory (000502_c), but the actual files retain Char000502.
            string clipCode = code.EndsWith("_c", StringComparison.Ordinal)
                ? code[..^2] : code;
            string language = "JP";
            int index = _brownDust2VoiceClipIndex++ % 3 + 1;
            int sequence = ++_brownDust2VoiceSequence;
            string basename = "Char" + clipCode + "_BattleReady_" + index + ".wav";
            string localDir = Path.Combine(
                AppPaths.ResourceDirectory, ".bd2-voice-cache", code, language);
            string cached = Path.Combine(localDir, basename);
            if (!File.Exists(cached))
            {
                string url = BrownDust2VoiceRoot + code + "/" + language + "/" +
                    "Char" + clipCode + "_BattleReady_" + index + ".webm";
                byte[] audio = await ArchiveHttp.GetByteArrayAsync(url);
                if (audio.Length is < 200 or > 3_000_000 ||
                    audio[0] != 0x1A || audio[1] != 0x45 ||
                    audio[2] != 0xDF || audio[3] != 0xA3)
                    throw new InvalidDataException(
                        "Brown Dust 2 voice is missing or not a WebM audio file");
                // Opus-in-WebM is not uniformly supported by Windows WPF media
                // decoders. Convert locally with the managed pinned codec,
                // then feed guaranteed PCM WAV to the system player.
                byte[] wave = await Task.Run(() =>
                    NativeBrownDust2WebMDecoder.DecodeToWave(audio));
                Directory.CreateDirectory(localDir);
                string temp = cached + "." + Guid.NewGuid().ToString("N") + ".tmp";
                try
                {
                    await File.WriteAllBytesAsync(temp, wave);
                    File.Move(temp, cached, overwrite: true);
                }
                finally { if (File.Exists(temp)) File.Delete(temp); }
            }

            if (IsShutdownRequested || sequence != _brownDust2VoiceSequence)
                return;
            if (_brownDust2VoicePlayer == null)
            {
                _brownDust2VoicePlayer = new MediaPlayer();
                _brownDust2VoicePlayer.MediaOpened += (_, _) =>
                    _brownDust2VoicePlayer?.Play();
                _brownDust2VoicePlayer.MediaFailed += (_, args) =>
                    AppLogger.Write(nameof(App),
                        "bd2-voice-wav-playback-failed: " +
                        args.ErrorException?.Message +
                        " (system audio device unavailable)");
            }
            _brownDust2VoicePlayer.Close();
            _brownDust2VoicePlayer.Volume = 0.8;
            _brownDust2VoicePlayer.Open(new Uri(cached, UriKind.Absolute));
            AppLogger.Write(nameof(App), "bd2-voice-open " + costumeId);
        }
        catch (Exception ex)
        {
            AppLogger.Write(nameof(App),
                "bd2-voice-failed " + ex.GetType().Name + ": " + ex.Message);
        }
    }
}

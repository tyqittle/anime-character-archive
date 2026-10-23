# Extracted from the Windows workflow. Run from the repository root.
$url = 'https://raw.githubusercontent.com/Jelosus2/BD2-L2D-Viewer/b899b929df3e3ea883984a05f83c944608a27cb4/src/assets/audios/000201/JP/Char000201_BattleReady_1.webm'
$path = Join-Path $env:RUNNER_TEMP 'bd2-click-voice.webm'
Invoke-WebRequest -Uri $url -OutFile $path
$data = [IO.File]::ReadAllBytes($path)
if ($data.Length -lt 200 -or $data.Length -gt 3000000 -or
    $data[0] -ne 0x1a -or $data[1] -ne 0x45 -or
    $data[2] -ne 0xdf -or $data[3] -ne 0xa3) {
  throw 'Pinned BD2 voice is missing, oversized, or not WebM'
}
Write-Host "PASS: BD2 voice audio source is pinned and WebM header is valid ($($data.Length) bytes)"
# Exercise the SAME managed decoder that ships in the desktop EXE
# against a real pinned upstream BD2 Opus voice, not a mock WAV.
$project = Join-Path $env:RUNNER_TEMP 'bd2-voice-regression'
dotnet new console --framework net9.0 --output $project --no-restore | Out-Null
dotnet add (Join-Path $project 'bd2-voice-regression.csproj') package Concentus --version 2.2.2 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Managed Opus test dependency restore failed' }
Copy-Item ./native-desktop/NativeBrownDust2WebMDecoder.cs $project
@'
using System;
using System.IO;
using SpinePet;
byte[] voice = File.ReadAllBytes(args[0]);
byte[] wav = NativeBrownDust2WebMDecoder.DecodeToWave(voice);
if (wav.Length < 1000 ||
    System.Text.Encoding.ASCII.GetString(wav, 0, 4) != "RIFF" ||
    System.Text.Encoding.ASCII.GetString(wav, 8, 4) != "WAVE")
    throw new Exception("BD2 voice failed to decode into PCM WAV");
Console.WriteLine($"PASS: decoded real BD2 Opus voice to {wav.Length} PCM WAV bytes");
'@ | Set-Content -Path (Join-Path $project 'Program.cs') -Encoding utf8
dotnet run --project $project --configuration Release -- $path
if ($LASTEXITCODE -ne 0) { throw 'Native BD2 WebM to WAV regression failed' }

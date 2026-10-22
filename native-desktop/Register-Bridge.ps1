# SPDX-License-Identifier: GPL-3.0-or-later
# Registers protocol for the current user only; no administrator access needed.
$ErrorActionPreference='Stop'
$base=Split-Path -Parent $MyInvocation.MyCommand.Path
$bridge=Join-Path $base 'Open-ArchiveCharacter.ps1'
$app=Join-Path $base 'app\SpinePet.exe'
if (-not (Test-Path -LiteralPath $app -PathType Leaf)) {throw "Missing $app"}
if ($bridge.Contains('"')) {throw 'Installation path cannot contain double quotes'}
$exe=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$root='HKCU:\Software\Classes\animecharacter'
New-Item -Path $root -Force | Out-Null
Set-Item -Path $root -Value 'URL:Anime Character Archive Native SpinePet'
New-ItemProperty -Path $root -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
New-Item -Path "$root\shell\open\command" -Force | Out-Null
$command="`"$exe`" -NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$bridge`" `"%1`""
Set-Item -Path "$root\shell\open\command" -Value $command
Write-Host "Registered animecharacter:// for current user."
Write-Host "Open the archive website, select a supported Nikke Spine 4.1 model, and click '放到桌面'."
Write-Host "To test manually: powershell -NoProfile -File `"$bridge`" -CharacterId c015"

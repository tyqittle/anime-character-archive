# SPDX-License-Identifier: GPL-3.0-or-later
# Companion bridge for upstream My_SpinePet, not a new renderer.
[CmdletBinding()]
param(
    [Parameter(Position=0)][string]$Uri = '',
    [string]$CharacterId = '',
    [switch]$ValidateOnly,
    [switch]$DownloadOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$catalogUrl = 'https://tyqittle.github.io/anime-character-archive/data/spine-characters.json'
$trustedPrefix = 'https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/'

function Assert-NativeSpine41 {
    param([Parameter(Mandatory=$true)][string]$SkeletonFile)
    # Inspect the true Spine binary header, not the catalog version flags.
    $bytes = [System.IO.File]::ReadAllBytes($SkeletonFile)
    if ($bytes.Length -lt 256) { throw 'Spine skeleton is incomplete.' }
    [int]$offset = 8; [int]$length = 0; [int]$shift = 0; [bool]$ended = $false
    for ($i = 0; $i -lt 5; $i++) {
        if ($offset -ge $bytes.Length) { throw 'Spine binary header is truncated.' }
        [int]$part = $bytes[$offset]; $offset++
        $length = $length -bor (($part -band 127) -shl $shift)
        if (($part -band 128) -eq 0) { $ended = $true; break }
        $shift += 7
    }
    if (-not $ended) { throw 'Invalid Spine version varint.' }
    $length--
    if ($length -lt 3 -or $length -gt 32 -or ($offset + $length) -gt $bytes.Length) {
        throw 'Invalid Spine version length.'
    }
    $actual = [System.Text.Encoding]::UTF8.GetString($bytes, $offset, $length)
    if ($actual -cnotmatch '^4\.1(?:\.[0-9]+)?

try {
    if ($Uri.Length -gt 0) {
        $protocolMatch = [regex]::Match($Uri, '^animecharacter://open\?id=(c[0-9]{3,6}(?:_[0-9]{2})?)$', 'IgnoreCase')
        if (-not $protocolMatch.Success) { throw 'Invalid desktop character link.' }
        $CharacterId = $protocolMatch.Groups[1].Value.ToLowerInvariant()
    }
    if ($CharacterId -cnotmatch '^c[0-9]{3,6}(?:_[0-9]{2})?$') {
        throw 'Choose a valid character on the website (example: c015).'
    }
    $manifest = Invoke-RestMethod -Uri $catalogUrl -TimeoutSec 45
    $matches = @($manifest.characters | Where-Object { $_.id -ceq $CharacterId })
    if ($matches.Count -ne 1) { throw "Character $CharacterId was not found." }
    $entry = $matches[0]
    if ($entry.gameId -ne 'nikke') {
        throw 'This native renderer supports NIKKE characters only.'
    }
    $base = [string]$entry.base
    if (-not $base.StartsWith(($trustedPrefix + $CharacterId + '/'), [System.StringComparison]::Ordinal) -or
        $base -cnotmatch ('/' + $CharacterId + '_[0-9]{2}$')) {
        throw 'Character source URL failed the allowlist check.'
    }
    $stem = [System.IO.Path]::GetFileName($base)
    $skin = $stem.Substring($CharacterId.Length + 1)
    $display = [string]$entry.name
    foreach ($invalid in [System.IO.Path]::GetInvalidFileNameChars()) {
        $display = $display.Replace([string]$invalid, '_')
    }
    $display = $display.Trim(' ', '.')
    if (-not $display) { $display = $CharacterId }
    if ($ValidateOnly) {
        $probeFolder = Join-Path ([System.IO.Path]::GetTempPath()) ('anime-native-verify-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $probeFolder -Force | Out-Null
        try {
            $probe = Join-Path $probeFolder ($stem + '.skel')
            Invoke-WebRequest -Uri ($base + '.skel') -OutFile $probe -TimeoutSec 90 -UseBasicParsing
            $actual = Assert-NativeSpine41 -SkeletonFile $probe
            Write-Output "PASS: $CharacterId | $display | Spine $actual | $base"
        } finally {
            Remove-Item -LiteralPath $probeFolder -Recurse -Force -ErrorAction SilentlyContinue
        }
        exit 0
    }

    $root = Split-Path -Parent $MyInvocation.MyCommand.Path
    $executable = Join-Path $root 'app\SpinePet.exe'
    $destination = Join-Path $root ("res\" + $display + "\" + $skin + "\standing")
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
        throw "Missing original native SpinePet executable: $executable"
    }
    $atlasOutput = Join-Path $destination ($stem + '.atlas')
    $skeletonOutput = Join-Path $destination ($stem + '.skel')
    $detectedVersion = $null
    if (Test-Path -LiteralPath $skeletonOutput) {
        $detectedVersion = Assert-NativeSpine41 -SkeletonFile $skeletonOutput
    }
    if (-not ((Test-Path -LiteralPath $atlasOutput) -and (Test-Path -LiteralPath $skeletonOutput))) {
        $temporary = Join-Path ([System.IO.Path]::GetTempPath()) ('anime-native-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $temporary -Force | Out-Null
        try {
            $atlasTemp = Join-Path $temporary ($stem + '.atlas')
            $skeletonTemp = Join-Path $temporary ($stem + '.skel')
            Invoke-WebRequest -Uri ($base + '.atlas') -OutFile $atlasTemp -TimeoutSec 90 -UseBasicParsing
            Invoke-WebRequest -Uri ($base + '.skel') -OutFile $skeletonTemp -TimeoutSec 90 -UseBasicParsing
            $detectedVersion = Assert-NativeSpine41 -SkeletonFile $skeletonTemp
            $pageNames = @(
                [System.IO.File]::ReadAllLines($atlasTemp) |
                ForEach-Object { $_.Trim() } |
                Where-Object { $_ -cmatch '^[A-Za-z0-9._-]+\.png$' } |
                Select-Object -Unique
            )
            if ($pageNames.Count -lt 1 -or $pageNames.Count -gt 16) {
                throw 'Atlas has no supported safe PNG image pages.'
            }
            foreach ($page in $pageNames) {
                $pageUrl = $base.Substring(0, $base.LastIndexOf('/') + 1) + $page
                $pageDestination = Join-Path $temporary $page
                Invoke-WebRequest -Uri $pageUrl -OutFile $pageDestination -TimeoutSec 120 -UseBasicParsing
                if ((Get-Item -LiteralPath $pageDestination).Length -lt 100) {
                    throw "Downloaded image page is too small: $page"
                }
            }
            New-Item -Path $destination -ItemType Directory -Force | Out-Null
            Copy-Item -LiteralPath $skeletonTemp -Destination $destination -Force
            Copy-Item -LiteralPath $atlasTemp -Destination $destination -Force
            foreach ($page in $pageNames) {
                Copy-Item -LiteralPath (Join-Path $temporary $page) -Destination $destination -Force
            }
        } finally {
            Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Output "Imported $display (Spine $detectedVersion) to $destination"
    if ($DownloadOnly) { exit 0 }
    # Tell the existing upstream application which model to show. When it is
    # running, spawning SpinePet.exe signals its existing single-instance event;
    # when not running, it consumes this request during normal startup.
    $requestFolder = Join-Path $root 'res'
    New-Item -ItemType Directory -Path $requestFolder -Force | Out-Null
    $requestFile = Join-Path $requestFolder '.anime-archive-show.json'
    $tempRequest = Join-Path $requestFolder ('.anime-archive-request-' + [guid]::NewGuid().ToString('N') + '.tmp')
    try {
        @{ ResourceName = $stem } | ConvertTo-Json -Compress |
            Set-Content -Path $tempRequest -Encoding UTF8
        Move-Item -LiteralPath $tempRequest -Destination $requestFile -Force
    } finally {
        Remove-Item -LiteralPath $tempRequest -Force -ErrorAction SilentlyContinue
    }
    Start-Process -FilePath $executable -WorkingDirectory (Split-Path -Parent $executable)
    Write-Output "Sent one-click request: show $stem on desktop."
} catch {
    $message = [string]$_.Exception.Message
    Write-Warning $message
    if (-not $ValidateOnly) {
        Add-Type -AssemblyName System.Windows.Forms
        [void][System.Windows.Forms.MessageBox]::Show($message, 'Native desktop character', 'OK', 'Warning')
    }
    exit 1
}
) {
        throw "Real skeleton version Spine $actual is incompatible with this native 4.1 renderer."
    }
    return $actual
}


try {
    if ($Uri.Length -gt 0) {
        $protocolMatch = [regex]::Match($Uri, '^animecharacter://open\?id=(c[0-9]{3,6}(?:_[0-9]{2})?)$', 'IgnoreCase')
        if (-not $protocolMatch.Success) { throw 'Invalid desktop character link.' }
        $CharacterId = $protocolMatch.Groups[1].Value.ToLowerInvariant()
    }
    if ($CharacterId -cnotmatch '^c[0-9]{3,6}(?:_[0-9]{2})?$') {
        throw 'Choose a valid character on the website (example: c015).'
    }
    $manifest = Invoke-RestMethod -Uri $catalogUrl -TimeoutSec 45
    $matches = @($manifest.characters | Where-Object { $_.id -ceq $CharacterId })
    if ($matches.Count -ne 1) { throw "Character $CharacterId was not found." }
    $entry = $matches[0]
    if ($entry.gameId -ne 'nikke' -or $entry.spineVersion -ne '4.1' -or [bool]$entry.versionUnverified) {
        throw "Native pilot supports only verified NIKKE Spine 4.1 models. $CharacterId uses version $($entry.spineVersion)."
    }
    $base = [string]$entry.base
    if (-not $base.StartsWith(($trustedPrefix + $CharacterId + '/'), [System.StringComparison]::Ordinal) -or
        $base -cnotmatch ('/' + $CharacterId + '_[0-9]{2}$')) {
        throw 'Character source URL failed the allowlist check.'
    }
    $stem = [System.IO.Path]::GetFileName($base)
    $skin = $stem.Substring($CharacterId.Length + 1)
    $display = [string]$entry.name
    foreach ($invalid in [System.IO.Path]::GetInvalidFileNameChars()) {
        $display = $display.Replace([string]$invalid, '_')
    }
    $display = $display.Trim(' ', '.')
    if (-not $display) { $display = $CharacterId }
    if ($ValidateOnly) {
        Write-Output "PASS: $CharacterId | $display | Spine 4.1 | $base"
        exit 0
    }

    $root = Split-Path -Parent $MyInvocation.MyCommand.Path
    $executable = Join-Path $root 'app\SpinePet.exe'
    $destination = Join-Path $root ("res\" + $display + "\" + $skin + "\standing")
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
        throw "Missing original native SpinePet executable: $executable"
    }
    $atlasOutput = Join-Path $destination ($stem + '.atlas')
    $skeletonOutput = Join-Path $destination ($stem + '.skel')
    if (-not ((Test-Path -LiteralPath $atlasOutput) -and (Test-Path -LiteralPath $skeletonOutput))) {
        $temporary = Join-Path ([System.IO.Path]::GetTempPath()) ('anime-native-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $temporary -Force | Out-Null
        try {
            $atlasTemp = Join-Path $temporary ($stem + '.atlas')
            $skeletonTemp = Join-Path $temporary ($stem + '.skel')
            Invoke-WebRequest -Uri ($base + '.atlas') -OutFile $atlasTemp -TimeoutSec 90 -UseBasicParsing
            Invoke-WebRequest -Uri ($base + '.skel') -OutFile $skeletonTemp -TimeoutSec 90 -UseBasicParsing
            if ((Get-Item -LiteralPath $skeletonTemp).Length -lt 256) { throw 'Downloaded skeleton is too small.' }
            $pageNames = @(
                [System.IO.File]::ReadAllLines($atlasTemp) |
                ForEach-Object { $_.Trim() } |
                Where-Object { $_ -cmatch '^[A-Za-z0-9._-]+\.png$' } |
                Select-Object -Unique
            )
            if ($pageNames.Count -lt 1 -or $pageNames.Count -gt 16) {
                throw 'Atlas has no supported safe PNG image pages.'
            }
            foreach ($page in $pageNames) {
                $pageUrl = $base.Substring(0, $base.LastIndexOf('/') + 1) + $page
                $pageDestination = Join-Path $temporary $page
                Invoke-WebRequest -Uri $pageUrl -OutFile $pageDestination -TimeoutSec 120 -UseBasicParsing
                if ((Get-Item -LiteralPath $pageDestination).Length -lt 100) {
                    throw "Downloaded image page is too small: $page"
                }
            }
            New-Item -Path $destination -ItemType Directory -Force | Out-Null
            Copy-Item -LiteralPath $skeletonTemp -Destination $destination -Force
            Copy-Item -LiteralPath $atlasTemp -Destination $destination -Force
            foreach ($page in $pageNames) {
                Copy-Item -LiteralPath (Join-Path $temporary $page) -Destination $destination -Force
            }
        } finally {
            Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Output "Imported $display to $destination"
    if ($DownloadOnly) { exit 0 }
    # Tell the existing upstream application which model to show. When it is
    # running, spawning SpinePet.exe signals its existing single-instance event;
    # when not running, it consumes this request during normal startup.
    $requestFolder = Join-Path $root 'res'
    New-Item -ItemType Directory -Path $requestFolder -Force | Out-Null
    $requestFile = Join-Path $requestFolder '.anime-archive-show.json'
    $tempRequest = Join-Path $requestFolder ('.anime-archive-request-' + [guid]::NewGuid().ToString('N') + '.tmp')
    try {
        @{ ResourceName = $stem } | ConvertTo-Json -Compress |
            Set-Content -Path $tempRequest -Encoding UTF8
        Move-Item -LiteralPath $tempRequest -Destination $requestFile -Force
    } finally {
        Remove-Item -LiteralPath $tempRequest -Force -ErrorAction SilentlyContinue
    }
    Start-Process -FilePath $executable -WorkingDirectory (Split-Path -Parent $executable)
    Write-Output "Sent one-click request: show $stem on desktop."
} catch {
    $message = [string]$_.Exception.Message
    Write-Warning $message
    if (-not $ValidateOnly) {
        Add-Type -AssemblyName System.Windows.Forms
        [void][System.Windows.Forms.MessageBox]::Show($message, 'Native desktop character', 'OK', 'Warning')
    }
    exit 1
}

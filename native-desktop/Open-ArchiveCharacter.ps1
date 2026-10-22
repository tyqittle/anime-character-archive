# SPDX-License-Identifier: GPL-3.0-or-later
# Adapter for My_SpinePet. This file is NOT part of the upstream project.
# Receives animecharacter://open?id=... and imports only validated Spine 4.1 assets.
[CmdletBinding()]
param(
  [Parameter(Position=0)][string]$Uri = '',
  [string]$CharacterId = '',
  [switch]$ValidateOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$CatalogUrl = 'https://tyqittle.github.io/anime-character-archive/data/spine-characters.json'
$TrustedSource = 'https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/'
function ReportError([string]$Message) {
  Write-Error $Message
  if (-not $ValidateOnly) {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show($Message, '次元桌面立绘 · 原生客户端', 'OK', 'Warning')
  }
  exit 1
}
try {
  if ($Uri) {
    $match = [regex]::Match($Uri, '^animecharacter://open\?id=(c[0-9]{3,6}), 'IgnoreCase')
    if (-not $match.Success) { throw '无效的角色启动链接。' }
    $CharacterId = $match.Groups[1].Value.ToLowerInvariant()
  }
  if ($CharacterId -cnotmatch '^c[0-9]{3,6}$') {
    throw '请先从网站选择角色，或使用 -CharacterId c015。'
  }
  # The catalog is the actual one used by our website, not a duplicated whitelist.
  $response = Invoke-RestMethod -Uri $CatalogUrl -TimeoutSec 35 -ErrorAction Stop
  $character = @($response.characters | Where-Object { $_.id -eq $CharacterId } | Select-Object -First 1)
  if ($character.Count -ne 1) { throw "角色 $CharacterId 不在网站的资源目录中。" }
  $entry = $character[0]
  if ($entry.gameId -ne 'nikke' -or $entry.spineVersion -ne '4.1' -or $entry.versionUnverified) {
    throw "当前原生播放器只支持经过验证的《妮姬》Spine 4.1。$CharacterId 的版本是 $($entry.spineVersion)，尚不能原生播放；网站播放器仍可继续使用。"
  }
  $base = [string]$entry.base
  if (-not $base.StartsWith("$TrustedSource$CharacterId/",[System.StringComparison]::Ordinal) -or
      $base -cnotmatch ('/' + [regex]::Escape($CharacterId) + '_[0-9]{2}$')) {
    throw '资源目录未通过来源验证，已拒绝下载。'
  }
  $stem = [System.IO.Path]::GetFileName($base)
  $skin = $stem.Substring($CharacterId.Length + 1)
  $cleanName = [string]$entry.name
  foreach ($invalid in [System.IO.Path]::GetInvalidFileNameChars()) { $cleanName = $cleanName.Replace([string]$invalid,'_') }
  $cleanName = $cleanName.Trim(' ','.')
  if (-not $cleanName) { $cleanName = $CharacterId }
  $installRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  $pet = Join-Path $installRoot 'app\SpinePet.exe'
  $target = Join-Path $installRoot "res\$cleanName\$skin\standing"
  $atlasUrl = "$base.atlas"
  $skeletonUrl = "$base.skel"
  if ($ValidateOnly) {
    Write-Output "OK: $CharacterId, $($entry.name), Spine 4.1, $base"
    exit 0
  }
  if (-not (Test-Path -LiteralPath $pet -PathType Leaf)) {
    throw "未找到原生客户端 $pet，请重新解压完整压缩包。"
  }
  $atlasDestination = Join-Path $target "$stem.atlas"
  $skeletonDestination = Join-Path $target "$stem.skel"
  if (-not ((Test-Path -LiteralPath $atlasDestination) -and (Test-Path -LiteralPath $skeletonDestination))) {
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("anime-native-"+[Guid]::NewGuid().ToString('N'))
    New-Item -Path $tmp -ItemType Directory -Force | Out-Null
    try {
      Write-Output "Downloading Spine 4.1 model: $($entry.name)"
      $atlas = Join-Path $tmp "$stem.atlas"
      $skeleton = Join-Path $tmp "$stem.skel"
      Invoke-WebRequest -Uri $atlasUrl -OutFile $atlas -TimeoutSec 80 -UseBasicParsing -ErrorAction Stop
      Invoke-WebRequest -Uri $skeletonUrl -OutFile $skeleton -TimeoutSec 80 -UseBasicParsing -ErrorAction Stop
      if ((Get-Item $skeleton).Length -lt 200) { throw '模型骨骼文件大小异常。' }
      $pageNames = @([System.IO.File]::ReadAllLines($atlas) |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -cmatch '^[A-Za-z0-9._-]+\.png } |
        Select-Object -Unique)
      if ($pageNames.Count -eq 0 -or $pageNames.Count -gt 16) { throw '贴图列表不完整或格式不安全。' }
      foreach ($page in $pageNames) {
        $url = $base.Substring(0,$base.LastIndexOf('/')+1) + $page
        Invoke-WebRequest -Uri $url -OutFile (Join-Path $tmp $page) -TimeoutSec 120 -UseBasicParsing -ErrorAction Stop
        if ((Get-Item (Join-Path $tmp $page)).Length -lt 100) { throw "贴图异常：$page" }
      }
      New-Item -Path $target -ItemType Directory -Force | Out-Null
      Copy-Item -LiteralPath $skeleton,$atlas -Destination $target -Force
      foreach ($page in $pageNames) { Copy-Item -LiteralPath (Join-Path $tmp $page) -Destination $target -Force }
    } finally {
      Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  Write-Output "Imported model into $target"
  Start-Process -FilePath $pet -WorkingDirectory (Split-Path -Parent $pet)
  Write-Output 'SpinePet 已启动。第一次导入后可在设置面板点击“扫描/Scan”刷新角色，再点击角色显示。'
} catch {
  ReportError $_.Exception.Message
}
, 'IgnoreCase')
    if (-not $match.Success) { throw '无效的角色启动链接。' }
    $CharacterId = $match.Groups[1].Value.ToLowerInvariant()
  }
  if ($CharacterId -cnotmatch '^c[0-9]{3,6}$') {
    throw '请先从网站选择角色，或使用 -CharacterId c015。'
  }
  # The catalog is the actual one used by our website, not a duplicated whitelist.
  $response = Invoke-RestMethod -Uri $CatalogUrl -TimeoutSec 35 -ErrorAction Stop
  $character = @($response.characters | Where-Object { $_.id -eq $CharacterId } | Select-Object -First 1)
  if ($character.Count -ne 1) { throw "角色 $CharacterId 不在网站的资源目录中。" }
  $entry = $character[0]
  if ($entry.gameId -ne 'nikke' -or $entry.spineVersion -ne '4.1' -or $entry.versionUnverified) {
    throw "当前原生播放器只支持经过验证的《妮姬》Spine 4.1。$CharacterId 的版本是 $($entry.spineVersion)，尚不能原生播放；网站播放器仍可继续使用。"
  }
  $base = [string]$entry.base
  if (-not $base.StartsWith("$TrustedSource$CharacterId/",[System.StringComparison]::Ordinal) -or
      $base -cnotmatch ('/' + [regex]::Escape($CharacterId) + '_[0-9]{2}$')) {
    throw '资源目录未通过来源验证，已拒绝下载。'
  }
  $stem = [System.IO.Path]::GetFileName($base)
  $skin = $stem.Substring($CharacterId.Length + 1)
  $cleanName = [regex]::Replace([string]$entry.name,'[<>:"/\\|?*\\x00-\\x1f]','_').Trim(' ','.')
  if (-not $cleanName) { $cleanName = $CharacterId }
  $installRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  $pet = Join-Path $installRoot 'app\SpinePet.exe'
  $target = Join-Path $installRoot "res\$cleanName\$skin\standing"
  $atlasUrl = "$base.atlas"
  $skeletonUrl = "$base.skel"
  if ($ValidateOnly) {
    Write-Output "OK: $CharacterId, $($entry.name), Spine 4.1, $base"
    exit 0
  }
  if (-not (Test-Path -LiteralPath $pet -PathType Leaf)) {
    throw "未找到原生客户端 $pet，请重新解压完整压缩包。"
  }
  $atlasDestination = Join-Path $target "$stem.atlas"
  $skeletonDestination = Join-Path $target "$stem.skel"
  if (-not ((Test-Path -LiteralPath $atlasDestination) -and (Test-Path -LiteralPath $skeletonDestination))) {
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("anime-native-"+[Guid]::NewGuid().ToString('N'))
    New-Item -Path $tmp -ItemType Directory -Force | Out-Null
    try {
      Write-Output "Downloading Spine 4.1 model: $($entry.name)"
      $atlas = Join-Path $tmp "$stem.atlas"
      $skeleton = Join-Path $tmp "$stem.skel"
      Invoke-WebRequest -Uri $atlasUrl -OutFile $atlas -TimeoutSec 80 -UseBasicParsing -ErrorAction Stop
      Invoke-WebRequest -Uri $skeletonUrl -OutFile $skeleton -TimeoutSec 80 -UseBasicParsing -ErrorAction Stop
      if ((Get-Item $skeleton).Length -lt 200) { throw '模型骨骼文件大小异常。' }
      $pageNames = @([System.IO.File]::ReadAllLines($atlas) |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -cmatch '^[A-Za-z0-9._-]+\\.png$' } |
        Select-Object -Unique)
      if ($pageNames.Count -eq 0 -or $pageNames.Count -gt 16) { throw '贴图列表不完整或格式不安全。' }
      foreach ($page in $pageNames) {
        $url = $base.Substring(0,$base.LastIndexOf('/')+1) + $page
        Invoke-WebRequest -Uri $url -OutFile (Join-Path $tmp $page) -TimeoutSec 120 -UseBasicParsing -ErrorAction Stop
        if ((Get-Item (Join-Path $tmp $page)).Length -lt 100) { throw "贴图异常：$page" }
      }
      New-Item -Path $target -ItemType Directory -Force | Out-Null
      Copy-Item -LiteralPath $skeleton,$atlas -Destination $target -Force
      foreach ($page in $pageNames) { Copy-Item -LiteralPath (Join-Path $tmp $page) -Destination $target -Force }
    } finally {
      Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  Write-Output "Imported model into $target"
  Start-Process -FilePath $pet -WorkingDirectory (Split-Path -Parent $pet)
  Write-Output 'SpinePet 已启动。第一次导入后可在设置面板点击“扫描/Scan”刷新角色，再点击角色显示。'
} catch {
  ReportError $_.Exception.Message
}
 } |
        Select-Object -Unique)
      if ($pageNames.Count -eq 0 -or $pageNames.Count -gt 16) { throw '贴图列表不完整或格式不安全。' }
      foreach ($page in $pageNames) {
        $url = $base.Substring(0,$base.LastIndexOf('/')+1) + $page
        Invoke-WebRequest -Uri $url -OutFile (Join-Path $tmp $page) -TimeoutSec 120 -UseBasicParsing -ErrorAction Stop
        if ((Get-Item (Join-Path $tmp $page)).Length -lt 100) { throw "贴图异常：$page" }
      }
      New-Item -Path $target -ItemType Directory -Force | Out-Null
      Copy-Item -LiteralPath $skeleton,$atlas -Destination $target -Force
      foreach ($page in $pageNames) { Copy-Item -LiteralPath (Join-Path $tmp $page) -Destination $target -Force }
    } finally {
      Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  Write-Output "Imported model into $target"
  Start-Process -FilePath $pet -WorkingDirectory (Split-Path -Parent $pet)
  Write-Output 'SpinePet 已启动。第一次导入后可在设置面板点击“扫描/Scan”刷新角色，再点击角色显示。'
} catch {
  ReportError $_.Exception.Message
}
, 'IgnoreCase')
    if (-not $match.Success) { throw '无效的角色启动链接。' }
    $CharacterId = $match.Groups[1].Value.ToLowerInvariant()
  }
  if ($CharacterId -cnotmatch '^c[0-9]{3,6}$') {
    throw '请先从网站选择角色，或使用 -CharacterId c015。'
  }
  # The catalog is the actual one used by our website, not a duplicated whitelist.
  $response = Invoke-RestMethod -Uri $CatalogUrl -TimeoutSec 35 -ErrorAction Stop
  $character = @($response.characters | Where-Object { $_.id -eq $CharacterId } | Select-Object -First 1)
  if ($character.Count -ne 1) { throw "角色 $CharacterId 不在网站的资源目录中。" }
  $entry = $character[0]
  if ($entry.gameId -ne 'nikke' -or $entry.spineVersion -ne '4.1' -or $entry.versionUnverified) {
    throw "当前原生播放器只支持经过验证的《妮姬》Spine 4.1。$CharacterId 的版本是 $($entry.spineVersion)，尚不能原生播放；网站播放器仍可继续使用。"
  }
  $base = [string]$entry.base
  if (-not $base.StartsWith("$TrustedSource$CharacterId/",[System.StringComparison]::Ordinal) -or
      $base -cnotmatch ('/' + [regex]::Escape($CharacterId) + '_[0-9]{2}$')) {
    throw '资源目录未通过来源验证，已拒绝下载。'
  }
  $stem = [System.IO.Path]::GetFileName($base)
  $skin = $stem.Substring($CharacterId.Length + 1)
  $cleanName = [regex]::Replace([string]$entry.name,'[<>:"/\\|?*\\x00-\\x1f]','_').Trim(' ','.')
  if (-not $cleanName) { $cleanName = $CharacterId }
  $installRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  $pet = Join-Path $installRoot 'app\SpinePet.exe'
  $target = Join-Path $installRoot "res\$cleanName\$skin\standing"
  $atlasUrl = "$base.atlas"
  $skeletonUrl = "$base.skel"
  if ($ValidateOnly) {
    Write-Output "OK: $CharacterId, $($entry.name), Spine 4.1, $base"
    exit 0
  }
  if (-not (Test-Path -LiteralPath $pet -PathType Leaf)) {
    throw "未找到原生客户端 $pet，请重新解压完整压缩包。"
  }
  $atlasDestination = Join-Path $target "$stem.atlas"
  $skeletonDestination = Join-Path $target "$stem.skel"
  if (-not ((Test-Path -LiteralPath $atlasDestination) -and (Test-Path -LiteralPath $skeletonDestination))) {
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("anime-native-"+[Guid]::NewGuid().ToString('N'))
    New-Item -Path $tmp -ItemType Directory -Force | Out-Null
    try {
      Write-Output "Downloading Spine 4.1 model: $($entry.name)"
      $atlas = Join-Path $tmp "$stem.atlas"
      $skeleton = Join-Path $tmp "$stem.skel"
      Invoke-WebRequest -Uri $atlasUrl -OutFile $atlas -TimeoutSec 80 -UseBasicParsing -ErrorAction Stop
      Invoke-WebRequest -Uri $skeletonUrl -OutFile $skeleton -TimeoutSec 80 -UseBasicParsing -ErrorAction Stop
      if ((Get-Item $skeleton).Length -lt 200) { throw '模型骨骼文件大小异常。' }
      $pageNames = @([System.IO.File]::ReadAllLines($atlas) |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -cmatch '^[A-Za-z0-9._-]+\\.png$' } |
        Select-Object -Unique)
      if ($pageNames.Count -eq 0 -or $pageNames.Count -gt 16) { throw '贴图列表不完整或格式不安全。' }
      foreach ($page in $pageNames) {
        $url = $base.Substring(0,$base.LastIndexOf('/')+1) + $page
        Invoke-WebRequest -Uri $url -OutFile (Join-Path $tmp $page) -TimeoutSec 120 -UseBasicParsing -ErrorAction Stop
        if ((Get-Item (Join-Path $tmp $page)).Length -lt 100) { throw "贴图异常：$page" }
      }
      New-Item -Path $target -ItemType Directory -Force | Out-Null
      Copy-Item -LiteralPath $skeleton,$atlas -Destination $target -Force
      foreach ($page in $pageNames) { Copy-Item -LiteralPath (Join-Path $tmp $page) -Destination $target -Force }
    } finally {
      Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  Write-Output "Imported model into $target"
  Start-Process -FilePath $pet -WorkingDirectory (Split-Path -Parent $pet)
  Write-Output 'SpinePet 已启动。第一次导入后可在设置面板点击“扫描/Scan”刷新角色，再点击角色显示。'
} catch {
  ReportError $_.Exception.Message
}

# Extracted from the Windows workflow. Run from the repository root.
New-Item -ItemType Directory -Force -Path ./safe-release/core,./safe-release/source | Out-Null
Move-Item -Path ./native-dist/app -Destination ./safe-release/core/app
# No game models or custom PowerShell download scripts
# in the standalone desktop application download.
New-Item -ItemType Directory -Force -Path ./safe-release/core/res | Out-Null
'SpinePet model directory. Place licensed Spine 4.1 models here; this file preserves the resource directory when unzipped.' | Set-Content ./safe-release/core/res/README.txt -Encoding utf8
# Upstream bundles optional Python and shell import tools. They are not
# required for Spine rendering or for manual .skel/.atlas/.png import.
foreach ($dir in @('./safe-release/core/app/Tools','./safe-release/core/app/tools')) {
  if (Test-Path $dir) { Remove-Item $dir -Force -Recurse }
}
# createdump.exe is a .NET crash-dump helper, not needed to render Spine.
if (Test-Path ./safe-release/core/app/createdump.exe) { Remove-Item ./safe-release/core/app/createdump.exe -Force }
Copy-Item ./native-upstream/LICENSE ./safe-release/core/LICENSE-GPL-3.0.txt
Copy-Item ./native-upstream/NOTICE ./safe-release/core/NOTICE.txt
Copy-Item ./native-upstream/THIRD_PARTY_NOTICES.md ./safe-release/core/THIRD_PARTY_NOTICES.md
Copy-Item ./native-desktop/CONCENTUS-LICENSE.txt ./safe-release/core/CONCENTUS-LICENSE.txt
Copy-Item ./native-desktop/WEBVIEW2_NOTICE.txt ./safe-release/core/app/WEBVIEW2_NOTICE.txt
@'
Anime Character Archive — native SpinePet core (Windows x64)
Renderer source: KAIDO-YONAGI/My_SpinePet, GPL-3.0-or-later
Pinned upstream commit: 6690e986b4da31dc89337794bcef1b45e6531303
Launch: app/SpinePet.exe
Website one-click import is implemented natively inside SpinePet.exe.
Registration is only offered with a visible consent dialog when you launch the app.
No scripts, shell launchers or separate ZIPs are required.
This executable is unsigned and has not been certified malware-free.
For the registered website Spine/Cubism models: select a role in the archive and click 放到桌面.
Microsoft WebView2 Runtime is reused when installed; a verified official bootstrapper is bundled.
Legacy native Spine 4.1 import remains available.
The upstream Add/Scan interface remains available for manual licensed asset import.
GPL corresponding source is provided as another artifact from this SAME build run.
See https://github.com/tyqittle/anime-character-archive/tree/main/native-desktop
'@ | Set-Content ./safe-release/core/README.txt -Encoding utf8

Copy-Item ./native-upstream/LICENSE ./safe-release/source/LICENSE-GPL-3.0.txt
git -C native-upstream archive --format=zip --output="$env:GITHUB_WORKSPACE/safe-release/source/My_SpinePet-corresponding-source.zip" HEAD
if ($LASTEXITCODE -ne 0) { throw 'Cannot provide GPL corresponding source' }
Copy-Item ./native-desktop/Open-ArchiveCharacter.ps1,./native-desktop/Register-Bridge.ps1,./native-desktop/Patch-Upstream.ps1,./native-desktop/Patch-WheelZoom.ps1,./native-desktop/Patch-RenderEnvelope.ps1,./native-desktop/Patch-ViewportSafety.ps1,./native-desktop/NativeArchiveBridge.cs,./native-desktop/NativeArchiveAssetCache.cs,./native-desktop/NativeBrownDust2Bridge.cs,./native-desktop/NativeBrownDust2Voice.cs,./native-desktop/NativeBrownDust2WebMDecoder.cs,./native-desktop/NativeAutoUpdate.cs,./native-desktop/ArchiveDesktopFullBodyTests.cs,./native-desktop/CONCENTUS-LICENSE.txt -Destination ./safe-release/source
Copy-Item ./native-desktop/ChooseFoldersInstaller.iss -Destination ./safe-release/source
# Include every build adapter, typed overlay, manifest and regression required
# to reconstruct this binary; the upstream archive alone is not patched source.
Copy-Item ./native-desktop -Destination ./safe-release/source/native-desktop -Recurse -Force
Copy-Item ./native-upstream/archive-render-overlays.json -Destination ./safe-release/source
@'
The distributed SpinePet.exe builds pinned upstream source plus NativeArchiveBridge.cs.
From this source bundle, expand My_SpinePet-corresponding-source.zip into native-upstream/.
Run PowerShell from the bundle root:
  & ./native-desktop/build/Apply-ArchiveBridge.ps1
  & ./native-desktop/build/Apply-WheelZoom.ps1
  dotnet publish ./native-upstream/SpinePet/src/SpinePet/SpinePet.csproj -c Release -r win-x64 --self-contained true
The rendering manifest verifies the pinned upstream files before copying typed C# modules.
archive-render-overlays.json records the exact installed rendering source hashes.
Archive bridge and corresponding patch source are GPL-3.0-or-later.
'@ | Set-Content ./safe-release/source/REBUILD-INSTRUCTIONS.txt -Encoding utf8

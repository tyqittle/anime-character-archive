# Extracted from the Windows workflow. Run from the repository root.
New-Item -Path ./native-integration-test/app -ItemType Directory -Force | Out-Null
New-Item -Path ./native-integration-test/app/SpinePet.exe -ItemType File -Force | Out-Null
Copy-Item ./native-desktop/Open-ArchiveCharacter.ps1 ./native-integration-test/Open-ArchiveCharacter.ps1
& ./native-integration-test/Open-ArchiveCharacter.ps1 -CharacterId c015 -DownloadOnly
if ($LASTEXITCODE -ne 0) { throw 'The website-to-native real resource import failed' }
$assets = @(Get-ChildItem -Path ./native-integration-test/res -Recurse -File)
if (-not ($assets.Name -contains 'c015_00.skel' -and $assets.Name -contains 'c015_00.atlas' -and $assets.Name -contains 'c015_00.png')) {
  throw 'Missing required complete Spine standing asset files'
}
$skeleton = @(Get-ChildItem -Path ./native-integration-test/res -Recurse -Filter 'c015_00.skel')[0].FullName
$atlas = @(Get-ChildItem -Path ./native-integration-test/res -Recurse -Filter 'c015_00.atlas')[0].FullName
dotnet run --project ./native-upstream/SpinePet/tools/skeleton-inspector/SkeletonInspector.csproj -c Release -- $skeleton $atlas
if ($LASTEXITCODE -ne 0) { throw 'Upstream Spine 4.1 parser could not open the imported model' }
# Reuse the *actual pinned BD2 assets* with the upstream 4.1 reader.
# A catalog label is not proof that its binary or atlas is compatible.
$bd2 = (Get-Content ./data/spine-bd2-characters.json -Raw | ConvertFrom-Json).characters |
  Where-Object { $_.id -eq 'bd2-char000201' } | Select-Object -First 1
if (-not $bd2) { throw 'Missing pinned Brown Dust 2 source record' }
$bd2Base = [string]$bd2.base
if (-not $bd2Base.StartsWith('https://raw.githubusercontent.com/Zormolo/Brown-Dust-2-Assets/94a3ac97b8fab7ee054e0826de7d912de0a233ef/assets/spine/character/')) {
  throw 'Brown Dust 2 test source is not pinned'
}
New-Item -ItemType Directory -Path ./native-integration-test/bd2 -Force | Out-Null
foreach ($suffix in @('.skel','.atlas','.png')) {
  Invoke-WebRequest -UseBasicParsing -Uri ($bd2Base+$suffix) -OutFile ('./native-integration-test/bd2/char000201'+$suffix)
  if ($LASTEXITCODE -ne 0) { throw 'Brown Dust 2 sample download failed' }
}
dotnet run --project ./native-upstream/SpinePet/tools/skeleton-inspector/SkeletonInspector.csproj -c Release -- ./native-integration-test/bd2/char000201.skel ./native-integration-test/bd2/char000201.atlas
if ($LASTEXITCODE -ne 0) { throw 'Brown Dust 2 Spine 4.1 reader compatibility test failed' }
# Run a pixel-based regression against the ACTUAL pinned BD2
# standing costume (combined skins, lower-body input silhouette).
# A passing build or a string-matching assertion is NOT sufficient.
$testProject = './native-upstream/SpinePet/tests/SpinePet.Tests'
Copy-Item ./native-desktop/ArchiveDesktopFullBodyTests.cs,./native-desktop/ArchiveDesktopPerformanceTests.cs $testProject
$env:SPINEPET_BD2_TEST_DIR = (Resolve-Path './native-integration-test/bd2').Path
dotnet test (Join-Path $testProject 'SpinePet.Tests.csproj') -c Release --filter 'FullyQualifiedName~ArchiveDesktop|FullyQualifiedName~NativeSilhouetteRefreshTests|FullyQualifiedName~NativeCharacterRenderHostPerformanceTests|FullyQualifiedName~NativeRenderPipelineEfficiencyTests|FullyQualifiedName~NativeInputWindowTests' --logger 'console;verbosity=normal' --logger 'trx;LogFileName=archive-native.trx' --results-directory ./native-test-results
if ($LASTEXITCODE -ne 0) { throw 'Native rendering, input reuse, performance or real BD2 full-body regression failed' }
Remove-Item Env:SPINEPET_BD2_TEST_DIR
# Second actual 4.1 costume ID: previous code incorrectly accepted
# only cNNN and rejected cNNN_XX variants altogether.
& ./native-integration-test/Open-ArchiveCharacter.ps1 -CharacterId c010_03 -DownloadOnly
if ($LASTEXITCODE -ne 0) { throw 'Costume Spine 4.1 model download failed' }
$skinSkeleton = @(Get-ChildItem -Path ./native-integration-test/res -Recurse -Filter 'c010_03_00.skel')[0].FullName
$skinAtlas = @(Get-ChildItem -Path ./native-integration-test/res -Recurse -Filter 'c010_03_00.atlas')[0].FullName
dotnet run --project ./native-upstream/SpinePet/tools/skeleton-inspector/SkeletonInspector.csproj -c Release -- $skinSkeleton $skinAtlas
if ($LASTEXITCODE -ne 0) { throw 'Costume Spine 4.1 parser failed' }
# Regression: catalog incorrectly labeled this as 4.0/unverified,
# while its real .skel header reports Spine 4.1.20.
& ./native-integration-test/Open-ArchiveCharacter.ps1 -CharacterId c113_01 -DownloadOnly
if ($LASTEXITCODE -ne 0) { throw 'Misclassified c113_01 costume import failed' }
$realSkeleton = @(Get-ChildItem -Path ./native-integration-test/res -Recurse -Filter 'c113_01_00.skel')[0].FullName
$realAtlas = @(Get-ChildItem -Path ./native-integration-test/res -Recurse -Filter 'c113_01_00.atlas')[0].FullName
dotnet run --project ./native-upstream/SpinePet/tools/skeleton-inspector/SkeletonInspector.csproj -c Release -- $realSkeleton $realAtlas
if ($LASTEXITCODE -ne 0) { throw 'Actual c113_01 Spine 4.1.20 parser validation failed' }
Remove-Item ./native-integration-test -Recurse -Force

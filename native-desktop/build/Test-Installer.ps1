# Extracted from the Windows workflow. Run from the repository root.
# This is the exact Inno EXE a user downloads, NOT just its inner
# Velopack Setup. /SILENT shows the progress GUI without blocking for wizard clicks.
$wizard = @(Get-ChildItem ./safe-release/velopack/AnimeCharacterSpinePet-ChooseFolders-Setup.exe)
if ($wizard.Count -ne 1) { throw 'Missing exact two-folder EXE artifact' }
$root = Join-Path $env:RUNNER_TEMP 'AnimeCharacterTwoFolderSmoke'
$program = Join-Path $root '程序 安装'
$models = Join-Path $root '角色 素材'
$innoLog = Join-Path $env:RUNNER_TEMP 'spinepet-wizard-install.log'
$arguments = @('/SILENT', '/SUPPRESSMSGBOXES', '/NORESTART',
  ('"/PROGRAMDIR=' + $program + '"'),
  ('"/MODELDIR=' + $models + '"'),
  ('"/LOG=' + $innoLog + '"')) -join ' '
Write-Host "Testing GUI wrapper with unattended choices and two separate non-default Unicode paths."
$proc = Start-Process -FilePath $wizard[0].FullName -ArgumentList $arguments -PassThru
# Do not let a hidden child dialog or a GUI descendant hang CI forever.
$completed = $proc.WaitForExit(360000)
if (-not $completed) {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
$code = if ($completed) { $proc.ExitCode } else { 1460 }
if (Test-Path $innoLog) {
  Get-Content $innoLog -Tail 65 | ForEach-Object { Write-Host $_ }
}
$innerLog = Join-Path $models 'SpinePet-Install.log'
if (Test-Path $innerLog) {
  Get-Content $innerLog -Tail 40 | ForEach-Object { Write-Host $_ }
}
if ($code -ne 0) { throw "FULL INSTALL WIZARD FAILED: exit $code (1460 means timeout)" }
if (-not (Test-Path $innoLog)) { throw 'Inno install trace was not written' }
$trace = Get-Content $innoLog -Raw
if (-not $trace.Contains('Native Velopack GUI bootstrap started') -or
    -not $trace.Contains('Native Velopack GUI installation verified')) {
  throw 'GUI workflow never reached the verified progress-and-finish path'
}
if (-not (Test-Path (Join-Path $program 'current/SpinePet.exe'))) {
  throw "Selected program folder missing actual current/SpinePet.exe: $program"
}
if (-not (Test-Path (Join-Path $program 'current/sq.version'))) {
  throw 'Selected program folder missing Velopack update structure'
}
if (-not (Test-Path $models)) { throw "Selected model folder not created: $models" }
$saved = (Get-ItemProperty -Path 'HKCU:\Software\AnimeCharacterSpinePet' -Name ResourceDirectory).ResourceDirectory
if ($saved -ne $models) { throw "Model directory not persisted correctly" }
Write-Host 'PASS: /SILENT progress UI and verified completion; exact downloadable GUI EXE installed app and saved independent model directory.'

; SPDX-License-Identifier: GPL-3.0-or-later
; Two-folder graphical Windows EXE bootstrapper. The actual app installer and
; ALL future updates are still handled by vetted Velopack (MIT).
; Build: ISCC.exe /DVelopackSetup=<absolute Setup.exe> /DAppVersion=<x.y.z> ...
#ifndef VelopackSetup
  #error Supply /DVelopackSetup=<absolute Velopack Setup.exe path>
#endif
#ifndef AppVersion
  #error Supply /DAppVersion=<semver>
#endif

[Setup]
AppId={{9F335752-7E99-4461-9330-21912B875A7D}
AppName=次元桌面立绘（双目录安装向导）
AppVersion={#AppVersion}
AppPublisher=Anime Character Archive
AppPublisherURL=https://github.com/tyqittle/anime-character-archive
AppSupportURL=https://github.com/tyqittle/anime-character-archive/issues
AppUpdatesURL=https://github.com/tyqittle/anime-character-archive/releases
DefaultDirName={localappdata}\AnimeCharacterSpinePet
CreateAppDir=no
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=no
PrivilegesRequired=lowest
Uninstallable=no
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
OutputBaseFilename=AnimeCharacterSpinePet-ChooseFolders-Setup
ShowLanguageDialog=no
SetupLogging=yes

[Files]
; Embedded exact same signed/unsigned Velopack binary that CI also tests.
; Inno itself only selects folders and passes --installto to Velopack.
Source: "{#VelopackSetup}"; DestDir: "{tmp}"; Flags: dontcopy

[Code]
var
  FoldersPage: TInputDirWizardPage;
  ProgramFolder, ModelFolder: String;

function ProperDirectory(const S: String): Boolean;
begin
  if Length(S) < 5 then
  begin
    Result := False;
    Exit;
  end;
  // This per-user installer requires an absolute letter-drive path.
  // A D:relative path, drive root, UNC/remote share or injected quote is not
  // a safe installation location for the self-updating package.
  Result := (S[2] = ':') and (S[3] = '\') and
    (((S[1] >= 'A') and (S[1] <= 'Z')) or
     ((S[1] >= 'a') and (S[1] <= 'z'))) and
    (Pos('"', S) = 0) and (Pos('..\', S) = 0) and
    (Pos('/', S) = 0) and
    (S[Length(S)] <> '\');
end;

function IsNestedFolder(const Parent, Child: String): Boolean;
var
  P: String;
begin
  P := Lowercase(Parent) + '\';
  Result := (CompareText(Parent, Child) = 0) or
    (Copy(Lowercase(Child), 1, Length(P)) = P);
end;

procedure InitializeWizard();
begin
  FoldersPage := CreateInputDirPage(wpWelcome,
    '选择程序与角色素材目录',
    '两个目录都可以独立选择，例如 D 盘。后续更新保留选中的路径。',
    '上方存放程序及更新组件，下方存放角色骨骼、贴图与图集。' + #13#10 +
    '不要把素材文件夹放进程序文件夹内部，否则升级时可能误删。',
    False, '');
  FoldersPage.Add('程序安装目录');
  FoldersPage.Add('角色素材目录');

  // GUI defaults. PROGRAMDIR/MODELDIR are test-only unattended overrides.
  // They allow CI to test this *exact* Inno EXE with two real chosen folders.
  FoldersPage.Values[0] := ExpandConstant('{param:PROGRAMDIR|}');
  if FoldersPage.Values[0] = '' then
    FoldersPage.Values[0] := ExpandConstant('{localappdata}\AnimeCharacterSpinePet');
  FoldersPage.Values[1] := ExpandConstant('{param:MODELDIR|}');
  if FoldersPage.Values[1] = '' then
    FoldersPage.Values[1] := ExpandConstant('{localappdata}\SpinePet\ArchiveResources');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  P, M: String;
begin
  Result := True;
  if CurPageID <> FoldersPage.ID then Exit;

  P := Trim(FoldersPage.Values[0]);
  M := Trim(FoldersPage.Values[1]);
  if (not ProperDirectory(P)) or (not ProperDirectory(M)) then
  begin
    MsgBox('请选择有效的本地磁盘完整路径，例如：' + #13#10 +
      '程序：D:\Apps\AnimeCharacterSpinePet' + #13#10 +
      '素材：D:\AnimeAssets\Characters', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if IsNestedFolder(P, M) or IsNestedFolder(M, P) then
  begin
    MsgBox('程序与角色素材必须位于互不包含的独立文件夹。' + #13#10 +
      '这样软件升级不会覆盖角色素材。', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  ProgramFolder := P;
  ModelFolder := M;
end;

function NativeInstallerReportedSuccess(const LogFile: String): Boolean;
var
  Lines: TArrayOfString;
  I: Integer;
begin
  Result := False;
  if not FileExists(LogFile) then Exit;
  if not LoadStringsFromFile(LogFile, Lines) then Exit;
  for I := 0 to GetArrayLength(Lines) - 1 do
    if Pos('Installation completed successfully!', Lines[I]) > 0 then
    begin
      Result := True;
      Exit;
    end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Payload, Stub, LogPath, Arguments, UpdateExe, VersionFile: String;
  Code, Attempt: Integer;
  Ready: Boolean;
  ProgressPage: TOutputProgressWizardPage;
begin
  if CurStep = ssInstall then
  begin
    // Show an indeterminate activity indicator while extracting the payload.
    WizardForm.StatusLabel.Caption := '正在准备安装包...';
    WizardForm.ProgressGauge.Style := npbstMarquee;
    Exit;
  end;
  if CurStep <> ssPostInstall then Exit;

  // A nested Velopack bootstrapper is not bound to the lifetime of its first
  // process. Give users visible progress and pump messages during polling.
  ProgressPage := CreateOutputProgressPage(
    '正在安装次元桌面立绘',
    '程序将安装到您选择的位置，角色素材不会被覆盖。');
  ProgressPage.ProgressBar.Style := npbstMarquee;
  ProgressPage.SetText('正在启动安装引擎...', '请勿关闭安装器。');
  ProgressPage.SetProgress(0, 100);
  ProgressPage.Show;
  try
  try
    // Wizard pages are skipped in /VERYSILENT mode. Still read and verify
    // their values so the automated test exercises the same installation.
    if ProgramFolder = '' then
    begin
      ProgramFolder := Trim(FoldersPage.Values[0]);
      ModelFolder := Trim(FoldersPage.Values[1]);
    end;
    if (not ProperDirectory(ProgramFolder)) or
       (not ProperDirectory(ModelFolder)) or
       IsNestedFolder(ProgramFolder, ModelFolder) or
       IsNestedFolder(ModelFolder, ProgramFolder) then
      RaiseException('安装位置无效或程序与素材文件夹重叠，请重新选择。');

    if not ForceDirectories(ModelFolder) then
      RaiseException('无法创建素材文件夹：' + ModelFolder);
    ExtractTemporaryFile('AnimeCharacterSpinePet-win-Setup.exe');
    Payload := ExpandConstant('{tmp}\AnimeCharacterSpinePet-win-Setup.exe');

    // Preserve the actual native install log in the selected data folder.
    // Exit code 1 alone is never enough to diagnose a failed install.
    LogPath := AddBackslash(ModelFolder) + 'SpinePet-Install.log';
    // Do not mistake an older successful run for the current installation.
    if FileExists(LogPath) then
      DeleteFile(LogPath);
    Arguments := '--silent --verbose --log "' + LogPath +
      '" --installto "' + ProgramFolder + '"';
    Log('Native Velopack GUI bootstrap started; program=' + ProgramFolder +
      '; models=' + ModelFolder);
    if not Exec(Payload, Arguments, '',
      SW_HIDE, ewNoWait, Code) then
      RaiseException('原生安装程序无法启动，Windows 错误：' + IntToStr(Code) +
        '；内部日志：' + LogPath);

    // Velopack Setup.exe is a bootstrapper. Its first process may exit
    // BEFORE the actual installer writes SpinePet.exe or sq.version.
    // GitHub's real Windows test proved that the files arrived seconds later.
    // Never conclude the install succeeded/failed from just its first PID.
    // Velopack 1.2.x uses current/SpinePet.exe for the actual program.
    // Some versions also create a root launcher, but it is NOT guaranteed.
    Stub := AddBackslash(ProgramFolder) + 'SpinePet.exe';
    if not FileExists(Stub) then
      Stub := AddBackslash(ProgramFolder) + 'current\SpinePet.exe';
    UpdateExe := AddBackslash(ProgramFolder) + 'Update.exe';
    VersionFile := AddBackslash(ProgramFolder) + 'current\sq.version';
    Ready := False;
    // Bound the entire inner installation to 300 seconds, checking every
    // 200ms. Verify the fresh success log AND installed update structure.
    for Attempt := 0 to 1500 do
    begin
      if FileExists(AddBackslash(ProgramFolder) + 'current\SpinePet.exe') and
         FileExists(UpdateExe) and
         FileExists(VersionFile) and
         NativeInstallerReportedSuccess(LogPath) then
      begin
        Ready := True;
        Break;
      end;
      if (Attempt mod 25) = 0 then
      begin
        ProgressPage.SetText('正在安装与验证主程序...',
          '已等待 ' + IntToStr(Attempt div 5) +
          ' 秒。详细日志：' + LogPath);
        Log('Native Velopack GUI progress: ' + IntToStr(Attempt div 5) + ' seconds');
      end;
      // SetProgress processes window messages. The marquee avoids
      // inventing a percentage during a variable-length native install.
      ProgressPage.SetProgress(0, 100);
      Sleep(200);
    end;
    if not Ready then
      RaiseException('300 秒内未能确认安装完成。请检查日志：' + LogPath +
        '。不要手动覆盖已有的 current 目录。');
    Log('Native Velopack GUI installation verified: executable, updater, version, log');

    // The app reads this exact HKCU key before initializing its static
    // ResourceDirectory. DO NOT alter/delete this key during auto-update.
    if not RegWriteStringValue(HKCU, 'Software\AnimeCharacterSpinePet',
      'ResourceDirectory', ModelFolder) then
      RaiseException('无法保存素材目录，请检查当前用户注册表写入权限。');

    if (not WizardSilent()) and
       (not Exec(Stub, '', ProgramFolder, SW_SHOWNORMAL,
       ewNoWait, Code)) then
      MsgBox('程序安装成功，但无法自动启动。请在以下目录手动打开 SpinePet.exe：'
        + #13#10 + ProgramFolder, mbInformation, MB_OK);
  except
    // Both Inno /LOG and the inner Velopack log remain available on failure.
    Log('Native Velopack GUI installation failed: ' + GetExceptionMessage);
    if not WizardSilent() then
      MsgBox('安装未完整完成：' + GetExceptionMessage, mbError, MB_OK);
    RaiseException('安装失败：' + GetExceptionMessage);
  end;
  finally
    ProgressPage.Hide;
    ProgressPage.Free;
    WizardForm.ProgressGauge.Style := npbstNormal;
  end;
end;

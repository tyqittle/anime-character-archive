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
  // This per-user installer requires an absolute letter-drive path.
  // A D:relative path, drive root, UNC/remote share or injected quote is not
  // a safe installation location for the self-updating package.
  Result := (Length(S) >= 5) and (S[2] = ':') and (S[3] = '\') and
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

  // Old self-updating installs: preserve existing downloaded assets if any.
  FoldersPage.Values[0] := ExpandConstant('{localappdata}\AnimeCharacterSpinePet');
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
    MsgBox('程序与角色素材必须位于互不包含的独立文件夹。' +
      #13#10 + '这样软件升级不会覆盖角色素材。', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  ProgramFolder := P;
  ModelFolder := M;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Payload, Stub: String;
  Code: Integer;
begin
  if CurStep <> ssPostInstall then Exit;
  try
    if not ForceDirectories(ModelFolder) then
      RaiseException('无法创建素材文件夹：' + ModelFolder);
    ExtractTemporaryFile('AnimeCharacterSpinePet-win-Setup.exe');
    Payload := ExpandConstant('{tmp}\AnimeCharacterSpinePet-win-Setup.exe');

    // Install the genuine Velopack app in the chosen location. Suppress its
    // second wizard and first-launch action until registry config is written.
    if not Exec(Payload, '--silent --installto "' + ProgramFolder + '"',
      '', SW_HIDE, ewWaitUntilTerminated, Code) then
      RaiseException('启动原生安装程序失败，Windows 错误：' + IntToStr(Code));
    if Code <> 0 then
      RaiseException('原生安装程序退出代码：' + IntToStr(Code));

    Stub := AddBackslash(ProgramFolder) + 'SpinePet.exe';
    if not FileExists(Stub) then
      RaiseException('未找到新安装的 SpinePet.exe：' + Stub);

    // The app reads this exact HKCU key before initializing its static
    // ResourceDirectory. DO NOT alter/delete this key during auto-update.
    if not RegWriteStringValue(HKCU, 'Software\AnimeCharacterSpinePet',
      'ResourceDirectory', ModelFolder) then
      RaiseException('无法保存素材目录，请检查当前用户注册表写入权限。');

    if not Exec(Stub, '', ProgramFolder, SW_SHOWNORMAL,
      ewNoWait, Code) then
      MsgBox('程序安装成功，但无法自动启动。请在以下目录手动打开 SpinePet.exe：'
        + #13#10 + ProgramFolder, mbInformation, MB_OK);
  except
    MsgBox('安装未完整完成：' + GetExceptionMessage, mbError, MB_OK);
    RaiseException('安装失败：' + GetExceptionMessage);
  end;
end;

# 原生 Windows 桌面立绘 · 基于 My_SpinePet

**这里不是一个新的自研骨骼渲染器。** Windows 程序原样编译 [KAIDO-YONAGI/My_SpinePet](https://github.com/KAIDO-YONAGI/My_SpinePet) 的固定源代码提交（Spine C# 4.1、Direct3D 11、DirectComposition、WPF），由本站维护一个独立的 PowerShell 资源桥接层。原项目已支持桌面透明背景、拖拽、缩放、点击等功能。没有使用 Electron 截图抠图、按像素抽取白底或 `setShape` 剪切动画。

## 安装

在 [Native SpinePet Windows build](https://github.com/tyqittle/anime-character-archive/actions/workflows/native-spinepet-windows.yml) 中下载成功构建的 `anime-archive-native-spinepet-win-x64` Artifact，解压全部内容到可写目录（推荐个人文件夹，不要直接解压在 Program Files）。

首次安装运行 `Register-Bridge.ps1`（右键 **使用 PowerShell 运行**，或通过 PowerShell 执行 `powershell -ExecutionPolicy Bypass -File .\Register-Bridge.ps1`），把 `animecharacter://` 网站链接注册为本地资源导入入口。无需管理员权限。

在 [动态立绘网站](https://tyqittle.github.io/anime-character-archive/spine.html) 选择 **已验证的妮姬 Spine 4.1 模型**（例如 `c015`），点「放到桌面」。会从目录记录的固定源站下载对应 `.skel`、`.atlas` 和所有图集贴图，放到 `res/<角色名>/<皮肤码>/standing`，启动官方 `SpinePet.exe`。已有客户端运行时，重新启动会唤醒面板。**首次导入后在面板点击“扫描 / Scan”，选择该角色，再显示它。**

可先手动验证桥接脚本：
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Open-ArchiveCharacter.ps1 -ValidateOnly -CharacterId c015
powershell -NoProfile -ExecutionPolicy Bypass -File .\Open-ArchiveCharacter.ps1 -CharacterId c015
```

## 支持范围和边界

- 目前只支持 [网站目录](https://tyqittle.github.io/anime-character-archive/data/spine-characters.json) 中 **`gameId=nikke` 且 `spineVersion=4.1` 并已验证**、素材来源符合可信仓库结构的模型。**4.0/4.2/3.8 模型不会尝试强行加载**；其他游戏与 Cubism 模型还未集成。
- 桌面端不包含游戏素材。启动时按需从 [Nikke-db](https://github.com/Nikke-db/Nikke-db.github.io) 下载原始骨骼和贴图，需要能访问 GitHub 原始资源，且只应下载拥有合法使用权的内容。
- 角色默认由上游面板管理；尚未把“网页点击角色后，自动显示指定皮肤”集成到原生 UI。用户需要在面板中扫描并选中显示。
- 如果 Spine 4.1 的资源内容不满足上游解析器的要求，扫描会跳过，不能靠修改版本标签解决。
- 本次只承诺真实 **Windows CI 编译构建与桥接脚本验证**；真正的桌面透明画面、GPU 驱动兼容性仍需 Windows 10/11 实机查看。优先验证原生客户端自身，而非旧 Electron 版本。

## 工程结构

```text
native-desktop/
  Open-ArchiveCharacter.ps1   网站角色→验证来源/版本→下载→SpinePet 资源目录
  Register-Bridge.ps1         仅为当前用户注册 animecharacter://
  README.md                   使用与授权说明
.github/workflows/native-spinepet-windows.yml
```

GitHub Actions 使用固定上游提交 `6690e986b4da31dc89337794bcef1b45e6531303`，编译其真正的 .NET 9 Windows 原生程序（并非 Electron），并打包桥接脚本、上游完整许可证和源码 ZIP。更新上游版本时必须重新做许可证与构建检查。

## 开源与许可

**My_SpinePet** 是 KAIDO-YONAGI 等开发者的开源作品，许可证 **GPL-3.0-or-later**。Spine runtime 的代码与使用另有授权限制，上游文档要求使用者有自己的 Spine Editor 许可。编译出的包必须附带上游 LICENSE / NOTICE / THIRD_PARTY_NOTICES、固定源码版本，不能移除原作者声明。本站的桥接脚本也以 GPL-3.0-or-later 发布；没有修改上游的渲染引擎。本软件与游戏开发商、Spine 或上游网站无官方关系。

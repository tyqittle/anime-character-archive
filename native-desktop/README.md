# Windows 原生桌面立绘（基于开源 My_SpinePet）

本工程使用 [KAIDO-YONAGI/My_SpinePet](https://github.com/KAIDO-YONAGI/My_SpinePet) 已有的 Direct3D 11 + DirectComposition 原生 Spine 4.1 渲染器，不使用 Electron 白色透明窗口或截图轮廓抠图。上游固定源码版本：`6690e986b4da31dc89337794bcef1b45e6531303`，代码遵循 GPL-3.0-or-later；Spine 运行时还受独立许可约束。

## Chrome 提示“此文件包含危险内容”

**不要关闭安全浏览、关闭杀毒软件或强行恢复被拦截的 ZIP。** 该提示无法单凭截图判断是恶意内容还是误报，GitHub Actions 构建成功也不代表文件安全。

最初的发行包混合了自编译 EXE、动态资源下载 PowerShell 脚本、注册 Windows 协议的脚本和一键 CMD。为了减小额外权限和安全面，我们把它拆成三个独立产物，并在 Windows CI 中给基础程序生成文件哈希清单与安全检查报告。最新构建若仍被 Chrome 判危险，应继续定位被拦截的具体文件，而不是改名或绕过 Chrome。

## 下载和首次运行（最小化基础程序）

打开 [Native SpinePet Windows build](https://github.com/tyqittle/anime-character-archive/actions/workflows/native-spinepet-windows.yml)，找到最新成功的运行记录，在 Artifacts 中：

1. `native-spinepet-core-windows-x64`：**基础程序**。只包含原生渲染器及必要运行文件、GPL 署名、SHA-256 清单和安全检查报告；不包含网站协议注册、PowerShell 导入脚本或一键 CMD。解压所有文件，双击 `app/SpinePet.exe`。不需要管理员权限。
2. `native-spinepet-optional-website-bridge`：可选的网站角色导入及 Windows 协议注册脚本。**不推荐在 Chrome 已标危险、未完成安全排查时运行这些脚本。** 没有它也可以使用原生程序本身。
3. `native-spinepet-corresponding-source-GPL`：所编译上游代码的完整对应源码、桥接脚本源代码与许可。

首次验证请优先只运行基础程序；确认原生透明显示正常后，再考虑网站自动导入。

## 不使用任何脚本也能导入模型

My_SpinePet 原生面板支持 `Add` / `Scan` 和手动资源目录，资源按 `res/<角色名>/<皮肤码>/standing` 存放完整的 `.skel`、`.atlas` 和 atlas 引用的全部 PNG。仅使用合法取得并能验证来源的 Spine 4.1 资源。打开面板后扫描并选择角色。

当前网站桥接先仅支持已验证的妮姬 Spine 4.1，其他版本不能用改文件名的方式兼容。模型不会被打包进发行物。

## 可选网站协议集成

对脚本及发行物完成安全核验后，才把可选 Bridge ZIP 解压到与基础程序 `app/` 同一级目录。桥接目录包含 `Register-Bridge.ps1` 与 `Open-ArchiveCharacter.ps1`，会修改当前用户的 `HKCU\\Software\\Classes\\animecharacter` 注册表协议，并且按网站资源目录从固定来源下载 Spine 模型。可阅读源码后，自行决定是否启用。此功能不要求管理员权限。

## 风险与真实性

- 无商业代码签名，Windows 可能提示未知发布者；若是“危险内容/恶意软件”阻断，则需先排查，不能据此强行绕过。
- `BUILD-SECURITY-REPORT.txt` 会记录原生 EXE 签名状态、哈希及构建机是否具备可用的 Microsoft Defender 扫描能力；**缺失扫描不会被写成“无病毒”**。
- `SHA256SUMS.txt` 用于核对下载文件是否与本次 GitHub Actions 打包记录一致，不是独立的安全审计证明。
- 构建成功不等于 Windows 10/11 透明显示已实机验收。
- My_SpinePet 原作者、游戏素材权利人、Spine 许可证互相独立。源代码与许可请见本仓库和上游仓库。

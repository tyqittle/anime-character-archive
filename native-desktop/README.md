# 次元桌面立绘｜原生一键导入版

本项目基于 [KAIDO-YONAGI/My_SpinePet](https://github.com/KAIDO-YONAGI/My_SpinePet)（GPL-3.0-or-later）原生 Windows 客户端构建。我们保留它的 **Spine 4.1 / Direct3D 11 / DirectComposition** 渲染器，只增加网站角色协议、模型资源下载和自动显示的最小集成代码。没有截图抠图，不再依赖 Electron 的透明网页窗口。

## 使用（只安装一次，以后网页一点即可）

1. 打开 [Native SpinePet Windows build](https://github.com/tyqittle/anime-character-archive/actions/workflows/native-spinepet-windows.yml)，下载最新 **完整成功** 的构建记录里的 `native-spinepet-core-windows-x64`。
2. 将 ZIP **完整解压到个人文件夹**（不建议 Program Files 或其他需要管理员权限的位置）。进入 `app` 双击 `SpinePet.exe`。
3. 首次启动会弹出是否启用本站「放到桌面」一键导入的**明确授权提示**。选择 **是** 后才在当前用户 `HKCU\\Software\\Classes\\animecharacter` 注册链接协议，整个基础程序包不含注册脚本或 PowerShell。
4. 访问 [动态立绘网站](https://tyqittle.github.io/anime-character-archive/spine.html)，选择一个已验证 **妮姬 Spine 4.1** 模型，例如 **Anis: Sparkling Summer (c015)**。
5. 点击网站里的「放到桌面 ↗」。浏览器第一次可能提示是否启动外部程序，选择打开 SpinePet。客户端便会自行下载骨骼/图集/贴图、扫描并显示该角色。以后重复点击不需要手动 Add 或 Scan。

程序已经打开时再次点击网站按钮，会沿用 My_SpinePet 原有单实例机制唤醒程序并显示新角色，不另外启动第二个渲染器。

## 支持范围

目前支持《胜利女神：妮姬》**实际骨骼版本为 Spine 4.1** 的角色，包括目录曾错误标成 4.0 的模型。导入前客户端会使用上游真实 `.skel` 解析器核对版本，而不是依赖网站的 `spineVersion` / `versionUnverified` 标签。已确认 `c113_01` 的真实版本是 `4.1.20`，因此现在允许导入。真正的 Spine 3.8 / 4.0 / 4.2 和 Cubism Live2D 仍暂未支持；这些需要另外匹配版本的原生运行时，不会伪装兼容。下载来源严格限制在 `Nikke-db/Nikke-db.github.io` 的已知资源目录，不允许从网站链接直接传任意网址、本地路径或可执行文件。

角色资源按需下载到 `res/<角色名>/<皮肤码>/standing`，游戏素材**不随程序一起发布**。你需要保证有权使用所下载的游戏素材。

## 安全与许可

由于此前 Chrome 将混合 ZIP 标记为危险，我们不再在基础客户端混装 CMD/PowerShell 脚本。新的 Windows 下载产物只包含从固定上游源代码编译的原生程序、必要 .NET 文件、许可文件、构建哈希与说明文件。URL 协议只有在用户于程序内明确同意后才注册。

GitHub Actions 会对文件校验 SHA-256，并运行独立 ClamAV 已知特征扫描。**程序没有商业数字签名，扫描无命中不等于获得安全认证。若浏览器继续提示危险，不能关闭浏览器安全保护强行运行。**

代码按 GPL-3.0-or-later 分发，并附有固定提交的上游对应源码、修改补丁及重编译说明。Spine runtime、游戏资产另有许可要求。项目与游戏厂商或 My_SpinePet 作者不存在官方合作。

## 验收范围

Windows CI 会编译原生客户端并测试 c015 模型能被上游 Spine 4.1 解析，不能仅凭绿色构建标记宣称在你的 Windows 设备上实现完美透明渲染。首次安装仍建议先确认启动及桌面显示正常，随后再批量使用。

## 2026-10-22 二进制版本检测修复

用户截图中 `c113_01` 旧版报 `Native renderer currently supports verified NIKKE Spine 4.1 only`。这不是文件损坏：此前目录把它误标为 4.0、待验证，但直接读取源文件 `c113_01_00.skel` 的骨骼版本为 `4.1.20`。新版网页在点击「放到桌面」之前先读取真实骨骼版本；新版原生应用下载骨骼文件后使用其现有的 `SpineSkeletonCompatibility.EnsureSupported` 进行最终验证。两层检测均不再凭旧目录标签直接拒绝。真正的 Spine 4.0 会得到明确中文不兼容提示。

同时核对并更正了 `c113`、`c014`、`c016`、`c023` 的 4.1.20 标签。**这不代表目录剩余全部角色都完成了二进制核验；新增导入会逐个检查。**

用户升级步骤：完全退出旧版 `SpinePet.exe`，解压最新安全扫描通过的原生构建，双击新版 `app/SpinePet.exe`；网站 Ctrl+F5 刷新以避开旧缓存，选中 `c113_01` 并点击「放到桌面」。如旧安装目录仍被注册为外部协议启动目标，新版首次打开时允许更新链接注册。

## 屏幕上仍提示「Native renderer currently supports verified NIKKE Spine 4.1 only」

这个英文提示来自旧版程序或旧版协议处理器，并非 `c113_01` 骨骼本身不兼容。它的实际二进制版本已经验证为 Spine 4.1.20。仅刷新网站、修改目录标签都不会替换 Windows 上仍在运行的旧 EXE。

1. 先彻底关闭所有 `SpinePet.exe`，包括托盘程序（必要时在任务管理器结束旧实例）。它是单实例程序，旧进程还在时，双击新 EXE 可能只唤醒旧窗口。
2. 在仓库 [Native SpinePet Windows build](https://github.com/tyqittle/anime-character-archive/actions/workflows/native-spinepet-windows.yml) 中选择最新版**完整成功**的构建，同时确认 `security-audit` 作业通过，下载 `native-spinepet-core-windows-x64`。完整解压到固定目录；保留 `app` 与其他依赖文件。
3. **手动启动新解压目录的 `app/SpinePet.exe`**。当它检测到现有的旧 `animecharacter://` 链接时会明确询问是否将链接改到此新版程序。确认替换。拒绝就会继续调用旧处理器。
4. 可以运行 Windows PowerShell 的只读查询 `reg query "HKCU\Software\Classes\animecharacter\shell\open\command" /ve` 检查路径。应该是新目录下的 `SpinePet.exe "%1"`，不应该指向旧目录或 `powershell.exe`。不要用未经核对的注册表修改脚本进行修复。
5. 回到网站按 `Ctrl+F5` 刷新，选择 `c113_01`，点击「放到桌面」。

本仓库旧 `Open-ArchiveCharacter.ps1` 也已经改为读取实际骨骼版本，防止老式脚本再次凭 `spineVersion`/`versionUnverified` 误判。但新的安全发布包**不会附带 PowerShell 启动脚本**，一键导入首选原生 EXE。若浏览器或安全软件提示危险，不要关闭安全保护绕过，先核对下载来源与构建校验信息。

## 自动升级安装版（2026-10-22）

此前的 `native-spinepet-core-windows-x64` 是便携 ZIP，不能安全地自行覆盖正在使用的 EXE。新增基于开源 [Velopack](https://github.com/velopack/velopack) 1.2.161 的 `Setup.exe` 安装包。**旧的便携包需要最后改装一次 Setup；此后自动检查、下载并校验更新包，在用户确认后自动更新、重启。** Windows 安装版使用 `%LOCALAPPDATA%` 的稳定目录，不需要管理员权限。

下载 [GitHub Releases](https://github.com/tyqittle/anime-character-archive/releases) 最新 **SpinePet Desktop** 的 `*-Setup.exe`，安装后程序启动时自动检查更新；若更新可用则在后台下载，Velopack 校验更新包，安装前弹出确认提示。GitHub Actions 只有在独立安全审计通过后才会将更新包发布到 Releases。Windows 安全防护发出警告时不要强行绕过；没有商业代码签名，不宣称不存在安全风险。

重要：安装版的角色文件放在 `%LOCALAPPDATA%\SpinePet\ArchiveResources`，不会因版本切换被删掉。历史便携 ZIP 的 `res` 文件仍在旧目录；首次改用安装版时可能需再导入一次，以后的自动更新会保留文件。不要把下载的 ZIP 中的 `app` 目录直接复制到 Velopack 的 `current` 内，否则可能破坏更新机制。

桌面完整背景修复：原生 [My_SpinePet](https://github.com/KAIDO-YONAGI/My_SpinePet) 使用逐动画取样估算透明 GPU 表面的大小；背景动画或长裙动作超出预估就会裁切。新增 `Patch-RenderEnvelope.ps1` 使用每一帧实际 Spine 顶点更新表面边界，在越界时扩容而不对桌面截图抠图。**如果素材本身就只包含半张场景，无法凭扩容创造原始资源不存在的画面**，需要另行修复该套素材的场景图层。

原便携 ZIP 仍保留用于兼容与调试，但不支持未来自动更新。若要免去每次下载解压，必须使用新发布的 Velopack Setup 安装版。

## 安装时选择 D 盘／其他位置

Velopack 标准的 `AnimeCharacterSpinePet-win-Setup.exe` 是 **一键安装**，默认位于当前用户的 C 盘 LocalAppData，双击后不显示目录选择页面。这是安装器设计，并非软件忽略了你选择的目录。

本项目从新版本起**同时发布带安装位置选择界面的 MSI 安装包**（GitHub Releases 内文件名以 `.msi` 结尾），通过 Velopack 的 `--msi --instLocation Either` 构建。双击 MSI，选择适合的「仅为当前用户安装」，并在安装步骤里选择类似 `D:\Apps\AnimeCharacterSpinePet` 的目录。MSI 与原一键安装包使用同一套 Velopack 应用及更新协议，后续更新仍保持原安装路径；无需把 ZIP 反复解压覆盖。

当前版本也可以**不升级**直接用 Velopack 官方支持的安装选项。打开 PowerShell，在下载文件目录运行（文件名可能因浏览器重命名而不同）：

```powershell
& "$env:USERPROFILE\Downloads\AnimeCharacterSpinePet-win-Setup.exe" --installto "D:\Apps\AnimeCharacterSpinePet"
```

注意这是**自定义目录下的新安装**，不等于原来 C 盘程序的自动迁移。如果之前装过默认安装版，先保存现有配置和角色，退出旧应用；不要直接拖动 `current` 子目录、`Update.exe` 或删除 `%LOCALAPPDATA%\SpinePet`。Windows 的「已安装的应用」中可能出现重复安装，确认新路径正常运行后再卸载旧程序，并确认 `animecharacter://` 协议对应的是当前应用。若当前路径无法写入、系统要求提权，建议选择普通用户有写入权的 D 盘文件夹，不要选受保护的系统目录。

**角色文件与软件安装目录不是同一回事。** 当前游戏模型、配置、更新检查记录等持久数据仍可能存放在 `%LOCALAPPDATA%\SpinePet` 下，其中已下载的游戏模型在 `ArchiveResources`。选择 D 盘安装 MSI **不会自动搬走旧素材和数据**；避免误删角色资源。后续可以再独立提供资源库目录迁移功能。


## 双目录 EXE 安装程序（选择安装盘和角色素材盘）

如果想要正常的中文可视化安装界面，**不要再使用旧版的 `AnimeCharacterSpinePet-win-Setup.exe`**。请在 [Releases](https://github.com/tyqittle/anime-character-archive/releases) 中选择 **`AnimeCharacterSpinePet-ChooseFolders-Setup.exe`**。这个单独的 EXE 内嵌同一次构建的 Velopack 安装程序，由开源 Inno Setup 6 编译。GitHub Actions 会把完整 EXE 连同原先的安装包一起交给独立 ClamAV 检查，通过后才发布。

双目录选择界面有两项：
- **程序安装目录**：如 `D:\Apps\AnimeCharacterSpinePet`（Velopack 的可自动更新程序及版本缓存）。安装向导使用官方 `Setup.exe --installto`，而不是直接复制应用文件或修改 Update.exe。
- **角色素材目录**：如 `E:\AnimeAssets\Characters`，存储动态模型的 `.skel`、`.atlas`、PNG 贴图。软件运行时从当前用户 `HKCU\Software\AnimeCharacterSpinePet\ResourceDirectory` 读取该目录，不依赖安装包路径，也不被 Velopack 更新覆盖。

两目录必须是不同且不相互包含的本机盘符文件夹；不能使用盘符根目录、网络共享或受系统保护而当前用户无法写入的目录。可选同一盘的两个独立文件夹，也可跨 D/E 等磁盘。安装向导在真正调用 Velopack 前确认素材路径，并在安装成功后保存目录设置、启动 SpinePet。它不会删除或移动旧目录里的素材；建议保留卸载之前的模型备份。原先使用 `%LOCALAPPDATA%\SpinePet\ArchiveResources` 的素材可在选择页面沿用该目录，无需重新下载。

**重点：程序仍自动更新**。内层 Velopack Setup 负责安装及今后的更新；外层 Inno Setup 只是首次选择两个路径。每次自动更新只更换应用 `current` 版本目录，不改变选定的游戏素材文件夹，也不要求再次打开这个安装向导。原版 MSI / Velopack Setup.exe / Portable.zip 保留供其他安装方式使用。

如果选择的磁盘暂时不可访问，客户端会回退到原来持久化用户数据目录，避免启动时崩溃。请不要在游戏运行时断开用于放置素材的移动磁盘。首次安装未经商业签名，Windows 如显示安全拦截应先核对 GitHub 发布来源。

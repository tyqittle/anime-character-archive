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

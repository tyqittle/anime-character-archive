# 次元桌面立绘

Windows 客户端基于固定 GPL 上游 [My_SpinePet](https://github.com/KAIDO-YONAGI/My_SpinePet)，使用 Velopack 更新。新通用宿主以 WebView2 + DirectComposition 播放本站的 Spine 多版本与 Cubism 动态立绘；原生 Spine 4.1 手动导入和旧版 NIKKE / BD2 链接继续兼容。

## 安装与更新

已有安装版：打开程序的「检查更新」，下载后确认安装并重启。程序更新保留素材目录与配置。

首次安装或旧便携版：到 [GitHub Releases](https://github.com/tyqittle/anime-character-archive/releases/latest) 下载 **AnimeCharacterSpinePet-ChooseFolders-Setup.exe**。中文向导分别选择程序目录和角色素材目录。使用可写的本机文件夹，如 `D:\Apps\AnimeCharacterSpinePet` 与 `E:\AnimeAssets\Characters`；两者不能相互包含。沿用原素材目录可以保留已有文件，向导不删除或迁移旧素材。

标准一键安装包也保留，指定目录可用：

```powershell
& "$env:USERPROFILE\Downloads\AnimeCharacterSpinePet-win-Setup.exe" --installto "D:\Apps\AnimeCharacterSpinePet"
```

MSI 支持目录界面，Portable.zip 用于便携运行；便携版不能通过覆盖正在运行的 EXE 实现自动升级。不要把 ZIP 内容复制进 Velopack 的 `current` 目录。

首次启动只在明确同意后注册当前用户的 `animecharacter://` 协议。检测到旧路径时会询问是否替换。旧进程仍运行时应先从托盘退出，再启动新版，避免单实例机制唤醒旧应用。

## 使用

1. 打开客户端，或点客户端的「网页选角」。
2. 在 [动态立绘网站](https://tyqittle.github.io/anime-character-archive/spine.html) 选择角色，点击「放到桌面」并允许浏览器打开应用。
3. 角色右键菜单可切换动作、缩放、适应画面、启用语音、重试或隐藏；滚轮缩放，拖动平移。切换同一模型的动作保留视图。
4. 托盘「隐藏全部 / 显示全部」同时管理通用角色与旧原生角色。

新协议为 `animecharacter://open?host=webview2&game=...&id=...`。客户端只加载固定本站页面与确切目录身份，不接受任意 URL。网站当前可播放引擎的模型共用该路径，新增同引擎游戏不需要更新客户端白名单。源失效、缺文件或引擎尚不支持的模型会报告加载错误；目录收录不等于全部模型已逐个验收。

## 资源、运行时与兼容

WebView2 用户数据位于所选素材目录的 `.archive-webview2/`，自动更新不覆盖该目录。旧原生角色仍在原位置，配置与旧缓存键保留。首次使用通用宿主需要建立它自己的浏览器缓存；不会假称已有原生目录可以直接充当浏览器缓存。在线目录、首次素材和缺失运行时仍需要网络。

运行时已有则复用，缺少时调用包内的微软官方 WebView2 引导程序。构建时核对其 Authenticode 签名，应用调用前核对 SHA-256。源码依赖固定版本的 WebView2 SDK，Evergreen Runtime 独立更新。

旧 `animecharacter://open?id=c015` 与 BD2 原生链接继续使用真实骨骼 4.1 解析器，资源按完整路径匹配；不会凭旧目录的 4.0 标签拒绝实际为 4.1.20 的 `c113_01`。手动 Add / Scan 保留。旧资源校验修复只影响本站托管路径，不清空整个素材库。

选定素材盘暂时不可访问时保留该路径，不悄悄写回 C 盘。素材版权归各自权利人，程序不附带游戏模型。

## 维护与验证

- [通用桌面宿主架构](../docs/UNIVERSAL_DESKTOP.md)：身份、合成、输入区域、会话与存储边界。
- [原生渲染优化记录](../docs/DESKTOP_OPTIMIZATION.md)：原生 4.1 表面与采样优化、实际测试范围。
- `web/` 是有类型的宿主模块，`rendering/` 是摘要校验的原生覆盖模块，`build/` 是可独立执行的构建与回归脚本。

Windows 流程构建实际应用并执行协议/请求竞争、CompositionController 透明像素和输入区域、网站代表引擎播放、缩放/动作切换、原生 4.1 下半身命中、真实资源下载与双目录安装回归。全仓 Node / Python / 架构检查和独立 ClamAV 扫描通过后才进入更新源。测试结果是 Windows CI 证据，不能代替用户显卡帧率或逐模型人工验收。

源码产物包含固定上游、完整适配、依赖版本和重建说明。代码按 GPL-3.0-or-later 分发，Spine / Cubism / WebView2 及素材另有许可说明。应用本身没有商业代码签名；已知特征扫描不等于安全认证。

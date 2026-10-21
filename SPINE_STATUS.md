# Spine 动态播放器状态

- 项目：**Anime Character Archive（次元角色档案馆）**
- 页面：[`spine.html`](./spine.html)
- 动画索引：[`data/spine-characters.json`](./data/spine-characters.json)
- 当前动态索引 **819 条**：NIKKE **514**、蔚蓝档案回忆大厅 **179**、《为美好的世界献上祝福！Fantastic Days》**126**；另《棕色尘埃2》209 条独立索引，总计 **1028** 条。目录导入不代表全部通过播放验证。
- 客户端运行时：Esoteric Software Spine Web Player，按骨骼版本选择兼容的运行环境。
- 资源流程：读取索引 → 从第三方下载骨骼、Atlas、贴图 → 浏览器中渲染；部分下载结果可以进入浏览器 IndexedDB 缓存。
- 兼容性：播放器使用 `binaryUrl` / `jsonUrl` 与 `atlasUrl`，不要误改回不兼容的初始化参数。
- 本仓库保存动画预览素材，但**尚未全面镜像第三方 Spine 骨骼与贴图**；实际播放仍受到第三方资源可用性与版本匹配影响。
- 不使用外站 iframe，播放器页面属于本仓库静态网站。

检查方式：访问 [动态立绘页面](https://tyqittle.github.io/anime-character-archive/spine.html)，逐一试播并参考仓库中的 Spine 浏览器测试与诊断结果。

**不要把静态检查成功或索引数量视为所有 Spine 动画均已播放成功的证明。**

## 棕色尘埃2批量收录（2026-10-21）

- 原始资源库固定提交下共有 87 位角色、209 套角色 Spine 模型；全部都有对应骨骼、Atlas、贴图。
- 动态页面使用 `data/spine-bd2-characters.json` 而不是原先仅五套的 pilot 目录。
- 209/209 套已使用 Chromium 逐套运行并生成专属 WebP 缩略图，素材地址在 `assets/animation-previews/`；详见 `data/bd2-preview-audit.json`。
- 自动化成功只证明模型可被加载并渲染，不等同于所有动作和皮肤都通过人工精细检查。
- 游戏原始骨骼和贴图仍由第三方 GitHub 源站按需加载，并未打包进本站。

## NIKKE 批量模型导入（2026-10-21）

- 上游 `l2d.json` 是不完整手工目录；扫描上游 Git 树而不是依赖其索引，发现 514 套角色编号模型，均有骨骼、Atlas 与至少一张 PNG，同步对应资源基址到 `data/spine-characters.json`。
- 原先 NIKKE 102 条，首轮补 109 条，递归树扫描额外再补 303 条，合计 **514 条**。
- 新条目 412 条尚未全部通过 Chromium 逐条动画帧预览验证；任何失败都不能用别的角色/皮肤贴图代替。
- CI 使用 40 个分片增量生成，并在发布后写入 `data/nikke-preview-audit.json`；仅成功的动画帧才进入 `assets/animation-previews/`。
- 未核对真实名称的角色/皮肤以编号表示，不宣称已经完成命名；数据仍依赖第三方源站的骨骼/贴图，尚未本地镜像。
- 扫描及排除记录详见 `data/nikke-import-audit.json`。

## 其他游戏 Spine 动态资源扩充（2026-10-21）

- **蔚蓝档案**：交叉核对 Schale-Archive 的 Spine_Lobbies/Spr 文件树，新增148套骨骼、Atlas及纹理齐全的回忆大厅模型，保留原有31套，共179套；尚未完成新增模型的逐一播放验收。
- **为美好的世界献上祝福！Fantastic Days**：导入126套 Spine 3.8.95 JSON 骨骼战斗动画，覆盖67个角色名称；资源来自 HaiKonofanDesu/konofan-assets-jp-sortet 固定提交 869daaf357ba3622b4a792350b258499cdb78468，索引另有完整图集路径。这是**战斗小人动画**，不是全身原画立绘。
- 播放器新增 3.8 JSON 骨骼加载分支（源文件扩展名 txt），并保留原本 3.8/4.x 骨骼版本自动识别。
- 新索引与真实预览是两项独立验证。自动渲染只为当前模型生成专属 WebP 和 SHA-256 记录，失败项不能用其他角色/皮肤图片代替；原始文件仍从外部源站下载。

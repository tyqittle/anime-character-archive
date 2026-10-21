# Spine 动态播放器状态

- 项目：**Anime Character Archive（次元角色档案馆）**
- 页面：[`spine.html`](./spine.html)
- 动画索引：[`data/spine-characters.json`](./data/spine-characters.json)
- 当前索引：**133 条**（NIKKE **102** 条、蔚蓝档案 **31** 条；不代表全部通过播放验证）。
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

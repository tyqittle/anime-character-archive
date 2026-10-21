# 次元角色档案馆 · Anime Character Archive

一个持续扩充的多游戏角色立绘与 Spine 动态素材图鉴。项目使用 **GitHub Pages** 部署，静态立绘及其轻量缩略图保存在本仓库；部分 Spine 动画在访问时从第三方素材源读取。

- **在线网站**：https://tyqittle.github.io/anime-character-archive/
- **角色图鉴**：https://tyqittle.github.io/anime-character-archive/characters.html
- **动态立绘**：https://tyqittle.github.io/anime-character-archive/spine.html
- **GitHub 仓库**：https://github.com/tyqittle/anime-character-archive

## 项目结构

| 路径 | 用途 |
| --- | --- |
| `index.html`、`gallery.html` | 入口页面，跳转到角色图鉴 |
| `characters.html` | 多游戏静态立绘图鉴：按游戏与角色分类、搜索、筛选、收藏、大图浏览 |
| `spine.html` | Spine 动态角色浏览与播放 |
| `data/characters.json` | 静态立绘记录、游戏分类、原图尺寸和素材来源 |
| `data/spine-characters.json` | 原有 NIKKE / 蔚蓝档案 Spine 索引 |
| `data/spine-bd2-characters.json` | 棕色尘埃2共 87 位角色、209 套全身动态服装 |
| `data/spine-bd2-pilot.json` | 历史首批五套试播记录 |
| `assets/portraits/` | 已收录的本地高清立绘（PNG / WebP） |
| `assets/thumbs/` | 角色列表使用的轻量 WebP 缩略图 |
| `assets/animation-previews/` | 动态立绘预览素材 |
| `scripts/` | 素材导入、缩略图生成、动画渲染与检查工具 |
| `tests/smoke.mjs` | 基本数据和网页脚本结构检查 |
| `.github/workflows/` | 自动导入、检查、浏览器测试及诊断工作流 |

## 当前静态立绘收录

截至 2026-10-21，索引包含 **540 条静态立绘记录，覆盖 9 款游戏**：

| 游戏 | 立绘条目 |
| --- | ---: |
| 蔚蓝档案 | 164 |
| 明日方舟 | 150 |
| 胜利女神：妮姬（NIKKE） | 129 |
| 绝区零 | 36 |
| 鸣潮 | 22 |
| 重返未来：1999 | 21 |
| 原神 | 8 |
| 崩坏：星穹铁道 | 7 |
| 少女前线2：追放 | 3 |
| **合计** | **540** |

静态记录的图片使用仓库内相对路径；目录卡片加载压缩缩略图，详情视图加载完整原图。角色分类由 `gameId` 和 `characterKey` 自动组织，同一角色的不同外观可以是不同记录。**索引条数不等于已逐张人工审核的独立角色数。**

## 动态立绘

`data/spine-characters.json` 当前包含 **545 条 Spine 索引**：NIKKE 514 条模型目录、蔚蓝档案 31 条。它们是待播放的动画资源索引，**不能据此推断全部动画已通过实际播放验证**。Spine 骨骼、Atlas 和贴图可能需要访问第三方来源；部分下载数据会缓存到浏览器 IndexedDB，本站并未全面镜像这些第三方动画文件。 为避免重新下载已缓存的动画包，播放器内部保留历史 IndexedDB 数据库名称作为兼容标识；它不是旧仓库网址，不应随仓库更名直接清除。

### 动态立绘播放器：观赏模式（2026-10-21）

参考 [Spine 官方 Web Player](https://esotericsoftware.com/spine-player)、[Spine Viewer（PixiJS）](https://github.com/sksketer/Spine-Viewer) 和 [BD2-L2D-Viewer](https://github.com/Jelosus2/BD2-L2D-Viewer) 的交互方式，增强站内播放器，而非搬运第三方网站：保留 Spine 官方骨骼渲染，但关闭内置底部播放控制栏；选择角色卡片或下拉框条目即可自动播放，上方动作、缩放和全屏功能保留；同时提供顶部的动作快速切换、一键适应画面、50%～350% 缩放、鼠标和触屏拖拽、移动端双指缩放及舞台全屏。鼠标在角色画面上时直接滚轮即可放大缩小（无需 Ctrl/⌘），在画面外仍然正常滚动网页；双击画面可重置。

画面缩放与移动仅调整 Canvas 在浏览器中的显示层，不篡改骨骼坐标、Atlas UV 或播放器原生的动画自动适配。Spine 3.8 与 4.x 通过按版本隔离、缓存播放器运行时进行无刷新切换；切换角色时只更换画布，不会重载整个网页，筛选条件、滚动位置和选中状态保持不变。角色资源仍在用户播放时从第三方源按需加载，不能将加载索引数量等同于已验证成功播放的动画数量。

### 棕色尘埃2：87 位角色、209 套全身动态立绘

已从 [Brown-Dust-2-Assets](https://github.com/Zormolo/Brown-Dust-2-Assets) 的固定提交 `94a3ac97b8fab7ee054e0826de7d912de0a233ef` 扫描并收录该仓库 `assets/spine/character/` 下的全部 **209 套角色骨骼**，覆盖 **87 位角色**。每套都具有同名 `.skel`、`.atlas`、`.png` 文件。完整模型索引保存在 `data/spine-bd2-characters.json`，用户可通过「游戏 → 角色 → 服装」筛选，点击即可自动播放。

已使用 GitHub Actions 的 12 个并行 Chromium 分片逐套载入骨骼动画，**209/209 套成功渲染对应人物预览**，并生成 **209 张一一对应的 WebP 缩略图**保存至 `assets/animation-previews/`（约 1.1 MB）。失败清单和核验数记录在 `data/bd2-preview-audit.json`。预览生成器为 `scripts/generate_bd2_bulk_previews.mjs`，发布验证脚本为 `scripts/merge_bd2_bulk_previews.mjs`。这属于批量自动渲染验证，并不代表对每一个动作和贴图细节都逐张人工审美审核。

《棕色尘埃2》使用已经校正的 Straight Alpha 贴图混合模式，避免脸、手和腿部的白色边缘伪影。**原始模型骨骼/Atlas/贴图仍从来源 GitHub 按需加载**，本仓库存放完整索引及实际模型截图，而不是将数百 MB 的第三方版权素材整包转存。当前 209 条与 NIKKE 514 条、蔚蓝档案 31 条合计为 **754 条动态索引**，其中蔚蓝档案主要为回忆大厅动画而非全身角色立绘。

[更多说明：SPINE_STATUS.md](./SPINE_STATUS.md)

### NIKKE：514 套角色及皮肤 Spine 源目录（2026-10-21）

上游 [Nikke-db](https://github.com/Nikke-db/Nikke-db.github.io) 的手工维护 `js/json/l2d.json` 只有 267 条，不能作为完整角色目录。已对其 Git `l2d/` 资源树进行**递归文件级检查**，找到 **514 个**符合角色编码命名且都至少有同模型 `.skel`、`.atlas` 和 PNG 贴图的目录；其中 211 个在原始清单中，另外 303 个仅存在于资源树。此前网站原有 NIKKE 102 条，现有 **514 条 NIKKE 动态索引**，其中仍存在未核对的名称和皮肤标识。缺乏可信名字时显示角色编码，而不是杜撰角色名。

- 逐一列出已发现的模型编号与核验范围：`data/nikke-import-audit.json`
- 可重复执行的目录扫描导入：`node scripts/import_nikke_dynamic.mjs`
- 只为真正能够加载的对应模型生成本地 WebP 预览：`scripts/render_spine_previews.mjs`（40 片并行增量渲染，失败项不会被其他模型贴图代替）
- 渲染之后的成功/失败统计：`data/nikke-preview-audit.json`（仅在渲染流水线成功发布后存在）

**注意：514 条是源目录具有骨骼、Atlas、PNG 三类文件的数量，并不意味着 514 条已通过浏览器播放、动作/贴图验证。** 骨骼和贴图仍按需取自源站，并未完整镜像到本仓库。静态图鉴目前 NIKKE 仍为 129 条静态图片记录，不等同于 514 套动态模型。

## 部署与本地调试

网站为纯静态文件，可通过 GitHub Pages 发布，无需 Vercel 或后端服务。仓库已包含 `.nojekyll`。GitHub 仓库名为 `anime-character-archive`，因此 Pages 项目站点路径为 `/anime-character-archive/`。如果日后再次更名，请同步检查文档与部署监测脚本中的站点路径。

可选的本地查看方式：

```bash
python -m http.server 8000
# 打开 http://localhost:8000/
```

Windows 也可运行 `start-local.bat`，或者执行 `python start_site.py`。本地启动详细说明见 [LOCAL_START.md](./LOCAL_START.md)。

### 质量检查

```bash
node tests/smoke.mjs
```

真实浏览器中另有静态立绘弹窗与 Spine 动画专项测试。结构测试、图片解码通过，不代表每个角色的美术质量、版权许可或所有外部动画资源均经人工验证。

## 素材与版权

角色名称、角色形象及游戏美术归相应权利人所有。部分资源来自第三方社区维护的公开档案；**可访问的图片不等于获得再分发授权**。每条记录尽量保留 `source` 和 `originalImage` 字段供追溯，公开使用前应核实授权。

站内中文品牌名称保留为**次元角色档案馆**，与新仓库英文名 **Anime Character Archive** 对应。

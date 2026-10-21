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
| `data/spine-characters.json` | 动态 Spine 资源与角色索引 |
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

`data/spine-characters.json` 当前包含 **133 条 Spine 索引**：NIKKE 102 条、蔚蓝档案 31 条。它们是待播放的动画资源索引，**不能据此推断全部动画已通过实际播放验证**。Spine 骨骼、Atlas 和贴图可能需要访问第三方来源；部分下载数据会缓存到浏览器 IndexedDB，本站并未全面镜像这些第三方动画文件。

[更多说明：SPINE_STATUS.md](./SPINE_STATUS.md)

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

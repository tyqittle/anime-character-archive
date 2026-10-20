# 次元角色档案馆 · Anime Character Archive

一个部署在 GitHub Pages 的静态 NIKKE 角色图库与 Spine 动态播放器。主站只展示角色资料及动态立绘，不再承载原「寒潮王座」剧情 CG / 素材编辑器。

**在线访问**：https://tyqittle.github.io/winter-cg-archive/

## 页面与数据

| 路径 | 用途 |
| --- | --- |
| `index.html` | GitHub Pages 首页，重定向至角色图鉴 |
| `characters.html` | 静态角色图鉴、搜索、筛选、收藏 |
| `spine.html` | Spine 动态角色播放器、浏览器缓存、导入本地文件 |
| `gallery.html` | 兼容旧链接，重定向至角色图鉴 |
| `data/characters.json` | 97 条**候选**全身立绘记录；不包含头像专用记录 |
| `data/spine-characters.json` | 62 条 Spine 角色动画来源索引 |
| `assets/portraits/*.js` | 12 个独立保存的 PNG 立绘封装文件，目前未接入新版角色页面 |
| `tests/smoke.mjs` | 结构与数据完整性测试 |
| `.github/workflows/verify.yml` | 每次 push / PR 自动运行结构检查 |

## 数据与资源边界

- **97 个静态候选**不等于 97 个已逐张目视核实的完整立绘，部分图片仍可能失效或不完整。
- **62 个 Spine 索引**不等于 62 个都已验证成功播放。页面从第三方源下载动画的 `.skel`、`.atlas` 与贴图；下载后可缓存在用户浏览器的 IndexedDB 中。
- `assets/portraits/` 中有 12 个保存于本仓库的立绘文件，但新版页面目前优先使用 `data/characters.json` 中的外部图片地址。不可把有文件误写为已经在网页调用。
- 原有头像索引、旧 CG 索引及 10 张旧 CG 图片已从当前分支删除。旧 Git 历史仍可追溯。
- 游戏角色、美术和动画版权归各权利人；第三方文件存在不等于拥有转存或再分发许可。公开使用需核实授权。

## 部署

本仓库是纯静态项目，GitHub Pages 选择 `main` 分支的 `/(root)` 即可，不需要 Vercel、Node 服务端或构建产物。保留 `.nojekyll`。

本地可选：`python -m http.server 8000` 后访问 `http://localhost:8000/`；也可使用 `start-local.bat` / `start_site.py`。普通访问无需下载。

## 质量检查

安装 Node.js 22+ 后运行：

```bash
node tests/smoke.mjs
```

此测试验证文件和索引结构、静态页面入口以及播放器初始化代码，**不代替**浏览器播放测试、网络可达性检查和逐张图片人工审核。

## 下一步

1. 人工审核 97 条候选静态立绘：只保留真正全身、清晰且加载正常的图片。
2. 验证 Spine 角色版本、动画动作和资源完整性，记录可播放状态。
3. 确认授权后将 12 个打包立绘接入角色卡片；未经授权不批量复制第三方素材。

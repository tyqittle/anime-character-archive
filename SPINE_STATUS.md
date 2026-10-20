# 独立动态角色播放器（当前开发状态）

入口：[`spine.html`](./spine.html)，独立画廊：[`gallery.html`](./gallery.html)。

## 已实现
- 原生独立 HTML / CSS / JavaScript 界面，不使用 iframe，也不嵌入 Nikke-DB 网站。
- 使用 Esoteric Software 官方 Spine Web Player 4.0 / 4.1 / 4.2；页面负责加载骨骼与图集并渲染。
- `data/spine-characters.json` 收录 30 个在 Nikke-db 官方社区索引中列出的角色/版本，提供独立的 `.skel` 和 `.atlas` 路径。
- 动画角色切换、官方演示、运行时错误提示、备用资源镜像、本地文件导入。
- 从 `gallery.html` 的已收录角色资料卡进入 `spine.html?id=<id>`。
- 支持在浏览器中导入本地资源，并选择是否保存到浏览器 IndexedDB。保存后可在同一浏览器直接再次播放，资源不会上传第三方服务器。浏览器清除网站数据会删除缓存。

## 未完成 / 真实限制
- 提供骨骼、atlas 和 atlas 引用贴图的浏览器端访问检测，以及 30 秒播放加载超时。
- **尚未在真实浏览器验证 NIKKE 动画完成渲染**：编写与 JavaScript 语法检查通过，不等于线上播放成功。
- Spine runtime 仍由 unpkg 加载；NIKKE 骨骼/图集/纹理由第三方 GitHub raw 或 nikke-db-legacy 提供。此实现**独立渲染界面，但并非离线、自托管资源网站**。
- 本地缓存功能要求浏览器允许 IndexedDB，且离线播放仍然需要 Spine JavaScript/CSS 运行时事先可用；不应误称全站脱离网络。
- 要变成完全独立、可靠且可离线的产品，必须在取得相应权利后把动画资源与获准分发的 Spine runtime 资产一并托管，并测试动作切换、贴图、跨域和内存回收。
- 素材为第三方游戏美术；找到公开 URL 不代表获得公开镜像或再分发许可。
- 本项目还没有实际部署为可访问的网址。若用本地文件直接打开，`fetch('./data/...')` 可能受到 `file://` 限制；使用本地静态服务器（例如 `python -m http.server 8000`）预览。

## 文件命名
`<id>/<id>_00.skel`、`<id>/<id>_00.atlas`、atlas 第一行定义的贴图 PNG。带皮肤后缀的 id 需要使用正确的 stem，不能盲目拼接。

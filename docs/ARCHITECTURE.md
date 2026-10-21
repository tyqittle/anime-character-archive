# 次元角色档案馆 · 功能模块架构

## 整体约束

继续使用 GitHub Pages 静态托管，**无需新增构建工具、Node 服务器或额外部署服务**。HTML、样式、角色索引、动画运行时和下载/缓存逻辑分离；保留现有页面 URL、人物资源及原有浏览器存储标识。

```text
characters.html                    # 静态图鉴 HTML（无业务 JS）
spine.html                         # 动态剧场 HTML（无业务 JS）
azurlane-stage.html                # 同源隔离的 Cubism / Pixi iframe（纯页面）
assets/
  archive-shell.css                # 共享设计系统
  gallery-base.css                 # 图鉴基础 CSS
  gallery-theme.css                # 图鉴主题 CSS
  gallery-redesign.css             # 图鉴交互响应式样式
  spine-base.css                   # 剧场基础 CSS
  spine-theme.css                  # 剧场主题 CSS
  spine-theater-layout.css         # 单屏剧场响应式布局
  live2d-stage.css                 # Cubism 子窗口样式
  js/gallery/
    state.js                       # 页面状态、收藏及旧 key 迁移
    catalog.js                     # 筛选、分类、角色列表
    viewer.js                      # 完整原图弹窗、收藏 UI
    events.js                      # 事件代理、触屏/键盘、预热
    bootstrap.js                   # 目录加载、初始化、深链接
  js/live2d/
    state-and-viewport.js          # 画布坐标、尺寸适应、帧率状态
    model-loader.js                # 动作按需加载、旧模型取消、播放
    bootstrap.js                   # 消息/手势监听、Pixi 初始化
  js/spine/
    state.js                       # 播放状态
    viewer-controls.js             # 缩放、拖动、动作/全屏工具栏
    catalog.js                     # 五款游戏目录和角色卡片
    spine-runtime.js               # Spine 3.8/4.x 运行时及渲染器
    spine-assets.js                # 骨骼图集下载、版本侦测、取消
    live2d-bridge.js               # Live2D iframe、加载过渡和消息
    playback.js                    # 动态角色自动播放与缓存路径
    local-tools.js                 # 高级资源诊断、本地资源导入
    bootstrap.js                   # 初始化入口、索引汇总
data/                               # 原有结构化索引与核验信息
scripts/                            # 资源导入与批量预览/浏览器工具
tests/smoke.mjs                     # 各模块语法和内容一致性测试
```

## 模块执行顺序和接口边界

为了不破坏已部署的静态网站，本阶段采用 `<script defer src>`：浏览器可并行请求代码文件，**按 HTML 所列顺序**执行，不引入打包器；保留原经典脚本的共享全局词法环境和事件处理回调。它是**功能文件模块化，不是完整的 ES Module 隔离**。不要随意更改加载顺序、在不同模块重复声明顶层 `let/const`，或将游戏目录解析塞回 HTML。

- `state.js` 第一，`bootstrap.js` 最后，后者启动应用。
- 静态图鉴：`catalog` 只负责记录、筛选和列表；`viewer` 管理详情；`events` 处理输入/手势；`bootstrap` 加载目录。
- 动态剧场：`spine-assets` 负责下载/校验，`spine-runtime` 负责特定骨骼版本和渲染，`live2d-bridge` 与子页通过 `anime-archive-azurlane-v1` 通道通信，`playback` 协调加载与缓存，`catalog` 管理切换。
- 原资源索引 `data/*.json` 保持独立，原始素材及 CDN 地址不在重构中迁移。静态图鉴原图仍用本地素材路径。
- `indexedDB` 数据库及旧 `localStorage` 收藏 key 保留，避免旧缓存/收藏失效。

## 修改、运行和验证

开发可用 `python -m http.server 8000` 启动静态站。运行 `node tests/smoke.mjs` 验证角色和皮肤目录、预览文件路径、页面 DOM 标识以及各 JS 模块是否可被解析；再运行现有 Playwright 浏览器脚本验证真实 Spine/Live2D 播放、自动切换及静态原图弹窗。

今后添加新游戏时，优先修改对应 `data/` 索引与 `assets/js/spine/catalog.js` 的筛选逻辑；新增动画格式时才动运行时和资源层。本次以**兼容性优先的第一阶段拆分**为界，进一步迁移到带显式 `import/export` 的隔离模块须配套接口回归测试，不在未经验证时大改浏览器存储。

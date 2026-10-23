# 项目架构与维护入口

本文描述当前实现；新增和修改代码遵循 [架构规范](ARCHITECTURE_RULES.md)，已知债务与迁移顺序见 [架构评审](ARCHITECTURE_REVIEW_2026-10-23.md)。

站点继续使用 GitHub Pages；无需服务端或前端打包器。页面 URL、模型 ID、收藏与缓存键保持兼容。

## 边界

- **数据注册**：`data/animation-catalogs.json` 只登记目录；模型来源、引擎、皮肤和预览状态保留在各目录 JSON 中。
- **浏览器**：`assets/js/shared/catalog-registry.js` 是无 DOM 的显式服务。剧场 bootstrap 读取注册表，目录 UI 由模型数据补充新分组。Spine/Cubism 仍隔离渲染。
- **内容处理**：`catalog_registry.py/mjs` 读取同一注册表；`preview_policy.py` 校验同模型路径/尺寸/摘要；`preview_frame_pipeline.py` 只负责图像处理；`preview_repository.py` 只负责校验、状态转换与文件发布。
- **CI**：`preview-pipeline.yml` 统一规划待处理 ID、分片采集、转码、校验和发布。游戏命名工作流仅保留手动兼容入口。`deploy-content.yml` 在内容发布成功后显式请求 Pages 构建，核验实际部署提交。
- **桌面**：Electron 在 `desktop/`；原生应用适配在 `native-desktop/`。Windows YAML 编排步骤，构建实现与验证脚本位于 `native-desktop/build/`。

## 预览数据流

```mermaid
flowchart TD
 R["目录注册表"] --> Q["缺失预览队列"]
 Q --> C["Spine / Cubism 真实渲染"]
 C --> V["统一图像校验与转码"]
 V --> P["与最新源标识比较"]
 P --> A["原子更新文件和目录"]
```

新截图统一 360×420；历史 480×360 截图保留并校验摘要。新增预览只来自对应模型，不允许借用其他角色或皮肤。网络或渲染失败保留在缺失队列，并记录统一错误类型。

发布时使用截图报告中的来源标识与最新目录比较；模型来源更新后，旧帧不得覆盖新记录。所有分片成功完成后才进入发布步骤；模型级失败有报告，不冒充成功。

## Atlas 坐标与实际贴图尺寸

部分源导出包保留原 Atlas 像素坐标，却对 PNG 做过缩放。源适配器通过模型数据 `atlasCoordinateSpace: "declared"` 明确启用 `assets/js/shared/spine-atlas-coordinates.js`，按每页声明尺寸换算 Region 和 Mesh 的 UV；GPU 图像和原始素材不被修改。未启用的模型保留原生坐标语义，不能仅凭尺寸不同推断来源一定经过缩放。

该策略属于资源解释契约，进入浏览器、Node 与 Python 共用的来源标识；改变策略后旧预览失效并由共同流水线重新采集。已有下载包仍可使用，在播放时应用新适配。覆盖四种旋转、裁切偏移、不同轴缩放、非活动皮肤、关联网格、重复更新和一像素边缘扩展。

## 取景与渲染会话

`shared/portrait-framing.js` 通过显式像素/矩形输入计算可见内容和相机范围，Spine/Cubism 各自处理绘制回调和坐标转换。一个模型会话拥有稳定取景；动作切换保留用户缩放和平移。旧版 Spine 的停止/释放由运行时适配负责，Live2D 模拟和绘制共用 Application ticker。具体行为与验收见 [取景与生命周期](PORTRAIT_VIEW_LIFECYCLE.md)。

## Live2D 动作与来源覆盖

`shared/cubism-motion-policy.js` 统一枚举命名/匿名动作组、待机选择、源循环标志、优先级、有限等待及会话取消。引擎适配传入 MotionManager 与当前会话判定；共享策略不访问 DOM，不按游戏 ID 分支。视口先读取有效网格的实际范围，避免把 MOC 画布尺寸误当裁切框。网页明确绘制剧场底色，桌面保持透明黑色清屏。

`data/live2d-source-scopes.json` 声明固定来源范围；`scripts/live2d_sources.mjs` 共同执行来源覆盖、文件引用校验和受控导入。已有模型 ID、素材地址和有效预览保持兼容。见 [本轮共性修复与覆盖记录](LIVE2D_COMMON_REPAIR.md)。

## 内容上线

预览、静态扩充以及手动兼容流程成功后，通过 `workflow_run` 触发共同的站点发布。机器人 push 本身不会触发 Pages 分支构建，因此不能省略这条依赖。

`request_pages_build.cjs` 使用现有 main 根目录 Pages 配置，请求构建并等待包含目标提交的实际成功结果。旧构建、失败或超时都不能视为上线。切换 Pages Source 时，应同时迁移这份契约与回归测试。

## 新增游戏

1. 选择已有 Spine/Cubism 资源适配；准备有来源与版本标识的目录 JSON。
2. 在注册表添加目录条目。共享加载器和队列自动读取，分组可从记录的 `collectionName/game` 取得。
3. 新来源若超出 Cubism 白名单，在源适配器添加经审核的来源规则及拒绝越界 URL 的测试；不能放开任意地址来绕过验证。
4. 运行 `npm test`、`npm run check`、`npm run test:python`。
5. 通过统一预览工作流生成真实截图，并通过实际浏览器播放回归。不要复制一份游戏专属截图或发布流程。

## 开发命令

```sh
python -m pip install -r requirements-dev.txt
python start_site.py
npm test
npm run check
npm run test:python
python scripts/preview_pipeline.py plan
python scripts/preview_pipeline.py convert
python scripts/preview_pipeline.py publish
```

采集命令为 `node scripts/repair_missing_previews.mjs SHARD COUNT`，需要固定版本的 playwright-core、pngjs 和 Chromium。普通单元测试不依赖浏览器或外网。

## 分阶段迁移

经典脚本的共享全局环境仍是明确的兼容边界。后续按“存储、播放会话、语音、视图”逐个迁移至显式接口，再切换入口为 ES Modules；不能同时重写所有渲染器和存储，以免丢失用户收藏或已下载资源。

完整问题清单和未完成债务见 [本次架构评审](ARCHITECTURE_REVIEW_2026-10-23.md)。根目录 AGENTS 和 `tests/check_architecture.mjs` 是持续约束，不能只改文档不运行检查。

## 原生渲染维护边界

Windows 原生 Spine 4.1 宿主的持续维护模块位于 `native-desktop/rendering/`。输入快照、三角形覆盖与表面容量检查为纯 C# 服务；四个上游渲染/输入模块通过固定摘要清单安装。构建适配先核对全部原始输入，拒绝源变化或新类型冲突，成功后记录实际安装源摘要。剩余兼容钩子仍有唯一锚点检查，不能宣称全部原生适配均已去除补丁。完整重建输入包含在 GPL 源码产物中。性能数据、回归与兼容范围见 [桌宠优化记录](DESKTOP_OPTIMIZATION.md)。

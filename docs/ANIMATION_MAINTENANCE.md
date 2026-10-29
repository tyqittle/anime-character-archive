# 动态图鉴日常维护

在仓库根目录执行（需要 Node、Python/Pillow 和 Chrome；CI 环境按现有工作流安装依赖）：

```powershell
npm run maintain:animation -- --catalog games-wave6
```

首次导入或刷新来源索引：

```powershell
npm run maintain:animation -- --catalog games-wave6 --import-sources --refresh-metadata
```

默认只启动 1 个采集进程，资源缓存自动复用。命令自行启动并关闭本地服务，不依赖当前预览网页端口。先检查代表模型和机器负载，再决定是否显式增加 `--jobs`，不要直接在日常使用的电脑上开多路采集。

本地采集与来源预检使用共同的浏览器启动策略，默认保留 Chrome 的硬件渲染选择。启动时只在空白页核对 WebGL 渲染器；无法核验或检测到 SwiftShader、llvmpipe 等 CPU 渲染器时立即停止，不会继续下载和批量渲染模型。日志记录实际渲染器。无 GPU 的 GitHub Actions 环境仍显式使用软件渲染；本地确需软件渲染时必须明确设置 `ARCHIVE_BROWSER_RENDERER=software` 并保持单路。硬件渲染和单路不能保证固定的 CPU 上限，发现持续高负载应停止任务。

修复渲染代码后，可添加 `--recapture 模型ID` 定点重采已有预览，参数可重复。ID 必须属于选中的目录；重采失败会报告失败，不会因为旧图片还存在就记成成功。

流程固定为：源索引导入（可选）→代表模型真实播放检查→只计划缺失/失效预览→原生模型采集→共同转换和来源校验→仅重试失败项一次→更新覆盖报告。仍有缺失时返回失败并列出 ID，不把部分成功记成图鉴完整。报告、工作日志和断点位于 `tmp/animation-maintenance/<目录 ID>/`。

中断后重新执行同一命令。每个模型完成即写断点；只有来源身份、渲染代码、PNG 摘要均相同才复用成功项。队列和并发数变化会建立新的批次，避免混用旧报告。已经发布且有效的预览直接跳过。原始资源缓存保留在 `tmp/hosted-spine/`，不进入 Git。

共同采集使用 `variant=exact` 保留指定的区域模型变体，并核对 Live2D 子页面实际渲染 ID；正常浏览仍沿用默认去重与旧链接跳转。不存在的模型 ID 直接报错，不能输出零条成功来掩盖错误队列。

新来源只需补全适配器、范围配置和代表 ID；采集、裁切、发布仍走共同流水线。代表模型应包含：普通立绘、换装/独立面部层、大纹理、特殊取景/图集。先核对透明度格式、五官、完整人物、待机与动作，再批量采集。`preflightIds` 在来源配置中声明，禁止再为每个游戏复制采集工作流。

来源可通过 `catalog` 覆盖配置文件的默认目录，因此 `games-wave7` 与旧目录使用同一维护命令但独立选择导入范围和代表检查。固定 Git 树的 `spine-portrait-tree` 适配器遍历整个声明目录、验证未截断树及每个 Git blob；二进制骨骼由固定版本/摘要的官方运行时只读解析。新游戏不需要另建下载器或发布器。

《失落之剑》使用 `npm run maintain:animation -- --catalog games-wave7`。其原始 LobbyUnit 导出含 11 套前后层组合，必须整套采集；仅截图前层会缺身体部件。来源站点跨域失败时不要用本地拦截伪装线上可用，应先找到可直连的固定源并做无资源缓存的浏览器检查。CI 的托管来源按配置逐源检查，某一源失败不会跳过其他源。

固定树的 Cubism 来源也使用同一入口，例如 `npm run maintain:animation -- --catalog games-wave8 --import-sources`。`sourceTreeSnapshot` 指定已冻结的完整源目录；设置文件按 Git blob 摘要校验和缓存，重复导入复用有效缓存。来源代表通过共同 `test_cubism_source_browser.mjs` 检查实际子模型、动态帧、缩放、动作和返回待机；可用 `--catalog games-wave8 --id <已声明代表 ID>` 单独诊断。不能用托管源的刷新参数更新固定提交，须先审查并更新提交与源树。明确标为独立特效的 `auxiliarySettings` 仍验证引用并出现在审计中，但不能计为角色／皮肤；空角色范围或辅助项路径错误不会通过覆盖检查。

发现特殊造型或透明、破碎效果时，先对照同一服装的官方参考图，再判定是否是渲染错误；不能仅凭画风特殊就排除模型。真实视觉错误仍保留为来源缺项，不与非角色特效混为一类，也不能放宽严格源审计。

本地命令修改目录和预览，不执行 Git 推送。发布前仍运行 `npm test`、`npm run test:python`、`npm run check`、`npm run audit:repo`，以及与变更对应的真实浏览器回归；使用 `catalog_compatibility.mjs --base-ref <远程基线> --verify-previews` 核验旧记录。推送后核对同一提交的 Pages 部署结果。

浏览器验证的自动 push 运行按分支保留最新版本，过期自动检查取消；手动运行使用独立并发组。全量 Spine 浏览器检查同时最多 4 个分片，避免旧版 10 分片挤占部署队列。素材发布和 Pages 发布仍按原串行契约执行。

已有来源身份发生变化时，导入器会明确给出受影响 ID；经核对后用 `import_hosted_spine.mjs --scope <来源> --update-existing <ID>` 逐项更新，再运行共同维护命令重建失效预览。自动维护不会批量放行来源替换。

声明图集坐标的旧源若只有边缘越界，先记录固定版本、页尺寸、旋转及区域坐标；仅已核对的 0–2 像素差异可由 `atlasEdgeExtrusionByModel` 映射到模型的 `atlasEdgeExtrusion`。同步运行时、来源身份与对应预览，不能全局放宽边界或修改原图。真实浏览器验证使用 `node scripts/test_spine_atlas_coordinates_browser.mjs`，通过 `MODULE_TEST_BASE_URL` 可核验本地或已部署页面。

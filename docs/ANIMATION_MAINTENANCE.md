# 动态图鉴日常维护

在仓库根目录执行（需要 Node、Python/Pillow 和 Chrome；CI 环境按现有工作流安装依赖）：

```powershell
npm run maintain:animation -- --catalog games-wave6
```

首次导入或刷新来源索引：

```powershell
npm run maintain:animation -- --catalog games-wave6 --import-sources --refresh-metadata
```

默认使用 2 个采集进程，可用 `--jobs 4`；资源缓存自动复用。命令自行启动并关闭本地服务，不依赖当前预览网页端口。

修复渲染代码后，可添加 `--recapture 模型ID` 定点重采已有预览，参数可重复。ID 必须属于选中的目录；重采失败会报告失败，不会因为旧图片还存在就记成成功。

流程固定为：源索引导入（可选）→代表模型真实播放检查→只计划缺失/失效预览→原生模型采集→共同转换和来源校验→仅重试失败项一次→更新覆盖报告。仍有缺失时返回失败并列出 ID，不把部分成功记成图鉴完整。报告、工作日志和断点位于 `tmp/animation-maintenance/<目录 ID>/`。

中断后重新执行同一命令。每个模型完成即写断点；只有来源身份、渲染代码、PNG 摘要均相同才复用成功项。队列和并发数变化会建立新的批次，避免混用旧报告。已经发布且有效的预览直接跳过。原始资源缓存保留在 `tmp/hosted-spine/`，不进入 Git。

新来源只需补全适配器、范围配置和代表 ID；采集、裁切、发布仍走共同流水线。代表模型应包含：普通立绘、换装/独立面部层、大纹理、特殊取景/图集。先核对透明度格式、五官、完整人物、待机与动作，再批量采集。`preflightIds` 在来源配置中声明，禁止再为每个游戏复制采集工作流。

本地命令修改目录和预览，不执行 Git 推送。发布前仍运行 `npm test`、`npm run test:python`、`npm run check`、`npm run audit:repo`，以及与变更对应的真实浏览器回归；使用 `catalog_compatibility.mjs --base-ref <远程基线> --verify-previews` 核验旧记录。推送后核对同一提交的 Pages 部署结果。

已有来源身份发生变化时，导入器会明确给出受影响 ID；经核对后用 `import_hosted_spine.mjs --scope <来源> --update-existing <ID>` 逐项更新，再运行共同维护命令重建失效预览。自动维护不会批量放行来源替换。

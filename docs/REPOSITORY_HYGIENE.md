# 仓库卫生与清理记录

检查日期：2026-10-23。检查基线：`be349d7993765245dba48b3e02f04166f21793dc`。

## 检查结论

基线共有 6211 个跟踪文件。`assets/` 约 862.6 MiB，主要是索引仍在使用的原图、缩略图和动态预览，不是可以批量删除的临时缓存。没有发现已跟踪的 node_modules、Python 字节码、安装包或临时构建输出目录。

主要维护负担是已被统一流水线替代的多套截图、裁切、转码和发布实现。它们不再被工作流调用，但仍可被误执行，其中部分不使用当前来源标识检查。仅按文件名含有 debug、pilot 或 build 判定废弃会误删有效工具。

## 本轮移除与收敛

| 类型 | 处理 | 原因 / 替代入口 |
| --- | --- | --- |
| 11 个旧预览脚本 | 删除 | 无有效调用方或仅被旧脚本调用；统一为 preview-pipeline.yml 与 preview_pipeline.py |
| 3 个旧预览审计快照 | 删除 | 当前共同发布器已在 data/preview-audits/ 生成对应目录报告，避免两套结果混淆 |
| 2 个孤立静态素材文件 | 删除 | 忌炎原图和缩略图均未被当前目录、页面或脚本引用；没有删除任何静态目录条目 |
| 历史 recovery 页面 | 改为轻量跳转 | 保留原网址及 query/hash，把访问转到当前 spine.html，移除约 42 KB 的旧播放器副本 |
| 旧文档操作入口 | 更新 | README 与 SPINE_STATUS 不再指导运行已退役脚本或旧 40 分片流程 |

删除清单：

- `scripts/apply_spine_previews.py`
- `scripts/capture_newgame_previews.mjs`
- `scripts/convert_azurlane_previews.py`
- `scripts/convert_newgame_previews.py`
- `scripts/generate_bd2_bulk_previews.mjs`
- `scripts/generate_bd2_spine_previews.mjs`
- `scripts/merge_azurlane_previews.py`
- `scripts/merge_bd2_bulk_previews.mjs`
- `scripts/preview_capture_queue.mjs`
- `scripts/render_azurlane_previews.mjs`
- `scripts/render_spine_previews.mjs`
- `data/arknights-illust-preview-audit.json`
- `data/highquality-live2d-preview-audit.json`
- `data/more-live2d-preview-audit.json`
- `assets/portraits/wutheringwaves-jiyan.webp`
- `assets/thumbs/wutheringwaves-jiyan.webp`

删除文件合计 466,160 字节；历史页面从 42,927 字节收敛为小型跳转页。新增规则、只读审计和说明会占少量文本空间，本次重点是减少错误入口与重复实现，不以节省大量容量为验收目标。

## 明确保留

- `data/spine-bd2-pilot.json`：真实浏览器回归使用的五模型固定测试集，不是运行时主目录。
- `assets/thumbs/.thumb-build-state.json`：缩略图构建的摘要状态，用于增量跳过，不是无用文件；删除会导致重新检查或生成。
- 旧命名的预览工作流：它们是手动兼容委托，执行共同流水线，不再持有独立实现。
- `merge_newgame_previews.py`、`merge_repair_previews.py`：小型兼容 CLI，逻辑委托共同服务。
- 被现有工作流引用的 debug / diagnose 工具：仍有故障定位用途。
- 来源与历史审计、架构评审和构建验证脚本：用于追溯，不能只因日期旧而删除；旧批次统计不能冒充当前覆盖率。
- 不同资源身份下字节相同的图片：Git 已按相同 blob 内容存储；路径仍可能对应不同目录记录，本轮不做身份合并。

## 持续规则

`.gitignore` 排除依赖、Python 缓存和临时输出；根 build 是生成目录，`native-desktop/build/` 是受跟踪的源脚本，两者必须区分。

只读检查：

```sh
npm run audit:repo
```

实现位于 `scripts/audit_repository_hygiene.mjs`，仅扫描 git 跟踪文件，不删除文件、不修改目录和审计。CI 对明确的生成目录/字节码入库报错，孤立素材只列为候选。静态引用分析不完全理解运行时拼接路径，因此不能把候选清单直接喂给批量删除命令。

退役一个入口时必须检查工作流、页面、脚本导入、测试、文档和外部 URL 兼容；同步移除无调用者的内部依赖，并说明替代入口。历史记录由 Git 保留，不再建立 backup、old、recovery 的完整实现副本。仍有用途的兼容入口保持薄委托或跳转。

删除当前分支的文件不会清除 Git 历史里的旧对象，也不会清除用户浏览器缓存、桌面已下载资源或 Actions 缓存。本轮不重写历史、不删除发布安装包；如果未来要减少首次完整克隆体积，应另行评估大资源存储与历史迁移。

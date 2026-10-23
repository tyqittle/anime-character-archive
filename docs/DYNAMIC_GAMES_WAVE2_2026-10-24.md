# 第三批动态立绘扩充 · 2026-10-24

本轮新增《桃色旅团》17 套、7 Sexy Sins Tadaima 常规站姿 6 套，共 2 款游戏、23 套动态立绘。全部通过真实浏览器截图采集，并经统一预览流程生成对应模型的 WebP。

来源固定为 [Eikanya/spine-models](https://github.com/Eikanya/spine-models/tree/d0ef626d5d9a38f419226cf03f7a97331f7d28fe)。模型仍按需读取固定版本的原文件；只提交索引与真实预览。

桃色旅团的 23 套源候选中，经预览检查排除 6 套偏幼态设计，收录 17 套。7 Sexy Sins Tadaima 仅选择常规 Stand 立绘；7 个候选中 6 个通过核验，Sloth Stand 遇到源站 SSL 传输失败，本轮未索引。Wrath 预览首轮超时，单次重试后完成。来源失败没有改写为成功，见 `data/spine-source-audit-sexy-sins-stand.json`。

共享导入器支持 JSON 骨骼、内容为 JSON 的 `.skel`、含空格的源文件名及显式稳定 ID。保留固定源 Git blob 校验、纹理完整性和范围限制。没有新增游戏专属播放器或预览工作流。

复现：

```sh
python -X utf8 scripts/import_spine_source.py --scope momoiro
python -X utf8 scripts/import_spine_source.py --scope sexy-sins-stand
python -X utf8 scripts/preview_pipeline.py plan --catalog games-wave2
node scripts/repair_missing_previews.mjs 0 1
python -X utf8 scripts/preview_pipeline.py convert
python -X utf8 scripts/preview_pipeline.py publish --catalog games-wave2 --incoming tmp/repair-output/webps
```

源文件配置见 `data/spine-source-scopes.json`；来源审计、预览审计和代表模型双帧运动/切换/缩放检查分别在 `data/spine-source-audit-momoiro.json`、`data/preview-audits/games-wave2.json` 和 `data/games-wave2-browser-audit.json`。重复导入桃色旅团未新增条目。验证通过 141 项 JavaScript 测试、38 项 Python 测试及架构/冒烟检查；未宣称逐个动作均经人工查看。

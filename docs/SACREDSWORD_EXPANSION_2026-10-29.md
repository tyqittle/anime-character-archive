# Sacred Sword Princesses 动态立绘补齐

本轮从 1 套扩充到 13 套常规动态立绘模型，新增 12 套及 112 个原始动作；全部 13 套有真实预览。模型数包含外观和导出变体，不作为独立角色总数。来源中的 CG 和事件场景不属于本次常规立绘范围。

## 固定来源及覆盖

- 仓库：`Eikanya/Live2d-model`
- 提交：`7e446cbd95ec352cdb0f73c079e4d075d7d528ac`
- 目录：`Sacred Sword princesses`
- 完整目录树：`c26d7b08d7f667dee4f99a2c46732b00ea6ecd62`，1152 个文件与子目录条目，未截断。
- 常规模型范围：`char2d_live2d_*/res/*.moc`，13 套；1 份原始设置、12 个缺少设置但保留骨骼、纹理与动作的原生包。
- 源审计：[sacredswordprincesses-full-inventory.json](../data/sacredswordprincesses-full-inventory.json)。缺项、失败均为 0，严格范围检查通过。固定旧来源不代表当前游戏全集已核对。

原全目录审计中的其他 15 份 CG／事件或根目录设置仍在 `excludedSourceSettings` 中逐路径保留，并明确标注不属于常规原生立绘范围；不是把它们改为成功模型。

新增为 Isara、Carlafena、Madierda、Nasadiya、Nasadiya 女王形态、Daan、Shalula、Fina、Runa、Mitis 和源代码 028、029。后两套暂时保留源代码，不猜测人物名称或合并身份。

## 导入与兼容

共同源适配器为缺清单包读取显式映射，逐项验证文件引用，并核对新增 MOC 原始字节的 Git blob 摘要。生成的加载清单只引用同包原生文件，保留全部纹理槽和动作；没有重绘纹理或合成动作。120 字节的原始空白纹理槽按原索引保留，不能因图片小而丢掉后续纹理。

原有 `ss-char2d_live2d_001` 的 URL、身份、原清单、动作与预览保持不变。12 个新模型使用同源、准确 ID 及摘要绑定的本地清单，浏览器来源规则拒绝跨角色、CG ID、外部地址和路径穿越。名称、女王外观分组和来源信息通过数据配置提供，不向渲染器加入游戏名称分支。

重复导入后完整目录 SHA-256 保持 `338afece01d7b90877a894f11c79f3d4e879d7d01744ffa13cb615a50ab3d5cd`。共同预览流水线单路 GPU 采集 12 套、转换通过 12 套、拒绝 0 套、剩余 0 套；[预览审计](../data/preview-audits/mature-followup.json)单独记录状态。

## 验证

- 270 项 Node 测试、45 项 Python 测试及架构检查通过。
- 以 `328366ed` 为基线，6031 条旧模型的严格兼容和预览摘要检查通过；新增 12 条，没有受保护字段变更。
- 6 套代表模型验证实际子模型 ID、原生动态像素、缩放、手动动作、自动恢复待机和显式返回待机。12 套新模型逐项原生渲染并检查预览。
- 旧碧蓝航线与绯色回响的模块隔离浏览器回归通过，覆盖缓存禁用、目录失败、语音回调异常、过期请求和宿主消息异常。
- 父入口、iframe URL 与相关子脚本使用一致版本 `20261029-live2d-native-bundles-v15`。

原始日志和截图位于 `tmp/ssp-*.log`、`tmp/cubism-source-browser/mature-followup/`、`tmp/animation-maintenance/mature-followup/`，不进入 Git。已知第七史诗源站对 GitHub 检查机的 403 与本轮来源无关，仍保留原诊断。

复现：`npm run maintain:animation -- --catalog mature-followup --import-sources`。导入、代表检查、增量预览与审计继续使用共同入口。

《最后的起源》的检索结果目前是私有底层数据的浏览器项目或标为半成品的 Unity 转换器，没有本轮可验收的原生立绘全集，未加入网站，也未用静态图补数。

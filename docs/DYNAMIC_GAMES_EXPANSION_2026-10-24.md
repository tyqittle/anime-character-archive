# 动态立绘游戏扩容 · 2026-10-24

在现有线上目录基础上增加四款游戏、84 套动态模型。偏成熟风格的内容优先选取《天命之子》常规角色服装及 Venus Scramble 女神立绘；MementoMori 补充水彩风动态原画。未将战斗小人或静态立绘算作本次新增模型。

| 新游戏 | 索引 | 来源与范围 |
| --- | ---: | --- |
| 天命之子 | 14 | 精选莫娜、丽莎、希尔德、巴托里及同角色不同服装；保留精确源编号 |
| Venus Scramble | 17 | 固定来源的 18 个模型配置中，17 个资源完整；另一个缺贴图，未导入 |
| 机动战队 | 4 | 莱拉、玛蒂尔达、斯洛卡伊、辛西娅；日文动作配置别名不重复计数 |
| MementoMori | 49 | 来源仓库 `model/` 中全部 49 个完整模型配置；缺乏可靠名字时显示源编号 |

《天命之子》的完整源目录并未全部收录。选定的 14 套不含幼态变体、CG 场景或浴场图；这一选择不能推导为对源仓库其他内容的审核。Venus Scramble 的 `player_unit_00005` 缺少 `model.2048/texture_00.png`，原始失败保存在来源审计中。

来源固定为：

- [Eikanya/Live2d-model](https://github.com/Eikanya/Live2d-model/tree/7e446cbd95ec352cdb0f73c079e4d075d7d528ac)：天命之子、Venus Scramble、机动战队。
- [SerenityS/memo_live2d](https://github.com/SerenityS/memo_live2d/tree/e4f1d58abe3610d4179c404ecf5de7865baeff62)：MementoMori。
- 天命之子英文名称与服装标题参考 Live2D-DCG 的 `static/json/childs.json`；模型与服装 ID 不改写、不按相似名称合并。

## 接入和复现

四款游戏统一登记在 `data/animation-catalogs.json`，模型在 `data/live2d-expanded-games.json`。浏览器自动生成游戏筛选项，无需新增专属页面或截图工作流。

复用 `scripts/live2d_sources.mjs`：显式支持 Cubism2 的小写资源字段，同时保持 Cubism3 的既有契约；逐一验证 MOC、贴图、动作、物理及姿态引用。配置文件通过源文件树的 Git blob SHA-1 校验，单模型失败不会阻止其他完整模型导入，原始失败仍返回非零退出码和诊断。重复导入保留稳定 ID 和同模型已核验预览。

```sh
node scripts/live2d_sources.mjs --scope destinychild --import destinychild --output tmp/destinychild-source-audit.json
node scripts/live2d_sources.mjs --scope ironsaga --import ironsaga --output tmp/ironsaga-source-audit.json
node scripts/live2d_sources.mjs --scope mementomori --import mementomori --output tmp/mementomori-source-audit.json
node scripts/live2d_sources.mjs --scope venusscramble --import venusscramble --output tmp/venusscramble-source-audit.json
```

最后一条会明确报告已知缺图并返回非零退出码；它不表示 17 套完整模型没有导入，更不表示源范围完整。来源报告见 `data/expanded-games-source-audit.json`。

截图继续走 `preview_pipeline.py plan → repair_missing_previews.mjs → preview_pipeline.py convert → publish`。共同采集器支持 Windows Chrome，并排除覆盖画布的两枚侧栏折叠按钮。每张 WebP 与确切模型来源绑定，尺寸、摘要和失败记录由共同发布器生成。最新统计见 `data/preview-audits/expanded-games.json`。

## 导入时修复的兼容问题

MementoMori 的 Unity 导出文件名带 `.anim`，部分文件还存在零时长、空曲线却声明循环的 `Idle_Expression` 动作。共享动作策略优先选择实际 `Idle.anim`；零时长动作按非循环静态姿态处理，避免 Cubism 的时间回绕循环减去零而卡死。正常时长动作继续保留源循环属性，既有命名动作组的优先顺序保持兼容。新增了真实文件命名顺序与零时长回归用例。

源码和数据核验、自动渲染、动作交互与人工视觉查看是不同证据。本次未宣称逐个动作都经过人工审美审核，第三方素材仍按需读取。


## 第二批：继续扩展成熟风格游戏

新增 **绯色回响 21 套**、**Sacred Sword Princesses 1 套**，两款游戏均完成逐模型真实预览采集；连同第一批四款，合计新增 **6 款游戏、106 套模型**。绯色回响精选范围原有 26 套候选，其中 4 套缺骨骼/图集被拒绝，另 1 套经真实截图查看发现人物过小并作明确质量排除，未以其他人物配图替代。Sacred Sword Princesses 仅选常规角色服装，不导入 CG 场景。

来源固定提交、失败和质量排除见 `data/spine-source-scopes.json`、`data/spine-source-audit-echocalypse.json`、`data/sacredsword-source-audit.json`；共同预览结果见 `data/preview-audits/mature-spine-expansion.json` 与 `data/preview-audits/mature-followup.json`。代表模型的双帧运动、动作和缩放检查保存在 `data/mature-followup-browser-audit.json`。Spine 来源导入复现命令：`python -X utf8 scripts/import_spine_source.py --scope echocalypse`；已知缺失会被明确报告并返回非零退出码。

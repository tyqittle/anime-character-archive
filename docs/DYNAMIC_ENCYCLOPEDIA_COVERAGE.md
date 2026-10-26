# 动态立绘图鉴覆盖与缺项

用户范围：每款游戏的全部动态角色立绘及全部皮肤，不用静态图片补数，不以精选样本代替完整图鉴。

下表中的模型数与源配置数不是角色总数。公开资源仓库可能落后于游戏、含重复配置或场景；尚无一款因本报告而被认定为游戏全集完整。

| 游戏 ID | 已索引角色立绘 | 对应来源的预览元数据 | 已核对源配置 / 源中已索引配置 |
| --- | ---: | ---: | --- |
| nikke | 514 | 514 | 尚未核对完整来源 |
| bluearchive | 179 | 179 | 尚未核对完整来源 |
| konosuba | 61 | 61 | 61 / 61 |
| azurlane | 242 | 242 | 尚未核对完整来源 |
| browndust2 | 209 | 209 | 尚未核对完整来源 |
| arknights | 92 | 92 | 尚未核对完整来源 |
| girlsfrontline | 297 | 297 | 297 / 297 |
| touhoucannonball | 84 | 84 | 84 / 84 |
| girlscafegun | 273 | 273 | 273 / 273 |
| girldimension | 102 | 102 | 112 / 102 |
| sinsevendeadlysins | 94 | 94 | 94 / 94 |
| maidslife | 10 | 10 | 10 / 10 |
| tokyonecro | 397 | 397 | 397 / 397 |
| lovecube | 6 | 6 | 20 / 6 |
| foxhimezero | 5 | 5 | 5 / 5 |
| daibloscore | 127 | 127 | 尚未核对完整来源 |
| destinychild | 973 | 973 | 979 / 973 |
| venusscramble | 17 | 17 | 18 / 17 |
| ironsaga | 4 | 4 | 4 / 4 |
| mementomori | 49 | 49 | 49 / 49 |
| echocalypse | 336 | 334 | 344 / 336 |
| sacredswordprincesses | 1 | 1 | 16 / 1 |
| momoiro | 17 | 17 | 23 / 17 |
| sexysins | 6 | 6 | 7 / 6 |
| gunsgirlz | 18 | 18 | 尚未核对完整来源 |
| arkorder | 15 | 15 | 尚未核对完整来源 |
| gemstory | 14 | 14 | 尚未核对完整来源 |
| warshipgirls | 3 | 3 | 尚未核对完整来源 |
| ruinsseeker | 23 | 23 | 尚未核对完整来源 |
| kagurareimeiki | 13 | 13 | 尚未核对完整来源 |
| epicseven | 568 | 568 | 793 / 568 |
| shadowverse | 297 | 297 | 394 / 297 |
| unknownbride | 18 | 18 | 尚未核对完整来源 |
| lostsword | 134 | 134 | 149 / 134 |
| reverse1999 | 348 | 348 | 350 / 348 |

完整缺项路径、源缺失和原始错误见 [覆盖数据](../data/dynamic-encyclopedia-coverage.json)。预览状态与源目录覆盖是两项独立验收。

复现：先执行 `node scripts/live2d_sources.mjs --inventory-only --whole-directory --output data/live2d-full-inventory.json`，再执行 `node scripts/dynamic_encyclopedia_coverage.mjs`。

现有精选范围和无法获得的资源仍属于待办，不因完成某一批导入就关闭整个图鉴补全目标。

# Live2D 共性问题修复与来源覆盖

日期：2026-10-23

## 已复现的问题

1. 当前固定版本的 Cubism 渲染库读入了动作的 `Meta.Loop`，却没有把它设置到运动对象的循环状态。少女咖啡枪的 1 秒、2 秒待机，以及少女前线 17.1 秒待机，源循环标志为 true、运行时却为 false。
2. 原来仅将字面量 idle 识别为待机；匿名动作组中的 stand、daiji、breath 播完可能没有后续动作。命名动作组原来只提供第 0 项。NORMAL 优先级还会拒绝打断同优先级动作。
3. MOC 声明的画布大小没有包含全部有效网格。少女咖啡枪示例的声明高度为 1500，网格延伸到约 1725；原先的首次缩放已经裁切下部，随后像素取景无法恢复没有画进画布的部分。
4. Fox Hime Zero 的白名单与已导入来源范围固定为 ruri_miko 单目录。上游同一固定版本实际存在五套匹配模型，涉及 Mori 和瑠璃。

少女前线两个样本在 CI 中的原始背景像素是透明的，CSS 为剧场深色，未在该环境复现截图白底。现在网页模式直接清屏为 RGB(20,34,56)，不再依赖透明网页表面合成；桌面模式继续清屏为透明黑色。两个模式的实际 WebGL 像素分别验收。角色衣服、头发和素材自带白色场景像素不会被删除。

## 共同实现

- `assets/js/shared/cubism-motion-policy.js` 使用显式 MotionManager 和会话回调，统一动作枚举、待机选择、源循环标志、打断优先级、20 秒有限等待、过期请求与释放。策略没有 DOM 或游戏 ID 分支。
- 待机使用一个不暴露到动作菜单的同源别名组，避免匿名组随机选到情绪/互动动作。所有具名组内动作都可选择；仅完整定义相同的重复项去重，保留不同音频和淡入设置。
- 先对当前有效网格做局部坐标范围合并，再绘制并做一次像素取景。缩放/动作切换保留用户画面；适应画面才重新计算。网页与桌面采用不同的清屏透明度与颜色，防止半透明表面残色。
- 原始素材、模型 ID、保存的素材包和有效预览继续使用。没有伪造缺失肢体。少女咖啡枪示例在修正取景后仍止于大腿，底部已留出边距；这个源模型的剩余范围限制不能靠放大解决。
- 无预设动作的模型明确显示没有预设动作，仍可缩放、拖动。预览截图成功不等于源文件包含动画。

## 收录与持续更新

`data/live2d-source-scopes.json` 是固定来源范围的共同登记处。`scripts/live2d_sources.mjs` 扫描完整目录并拒绝截断结果，区分源设置、索引设置、未索引候选和索引悬空。空范围不能通过完整性认证。可导入范围还校验模型、全部贴图、动作、物理和姿态文件引用，以及路径边界；导入保留已有 ID 与精确模型预览。

Fox Hime Zero 已从 1 套增加到该来源的 5 套，新增 4 张精确模型预览由共同预览流水线生成。五套是模型/造型数量，涉及两个角色，并非五个角色。这里的 5/5 是固定来源范围覆盖，不能用于声称游戏所有历史资源均完整。

复现命令：

```sh
npm run audit:live2d
node scripts/live2d_sources.mjs --scope foxhimezero --import foxhimezero --dry-run
node scripts/live2d_sources.mjs --scope foxhimezero --import foxhimezero
```

默认审计只读，JSON 报告写入系统临时目录或显式 --output 路径。非 dry-run 导入需要显式 --import，且只能使用已声明身份适配的范围；不会自动把所有未核验文件塞进角色目录。

## 本轮十个来源的范围审计

[真实来源审计与导入幂等验证](https://github.com/tyqittle/anime-character-archive/actions/runs/39953007975)的 source-coverage 任务保存了完整候选路径报告。

| 游戏 | 范围内源设置 | 已匹配索引设置 | 未索引候选 |
| --- | ---: | ---: | ---: |
| foxhimezero | 5 | 5 | 0 |
| girlsfrontline | 297 | 297 | 0 |
| girlscafegun | 273 | 64 | 209 |
| konosuba | 61 | 61 | 0 |
| girldimension | 112 | 102 | 10 |
| sinsevendeadlysins | 94 | 94 | 0 |
| tokyonecro | 397 | 62 | 335 |
| maidslife | 10 | 10 | 0 |
| lovecube | 6 | 6 | 0 |
| touhoucannonball | 84 | 84 | 0 |

少女咖啡枪、少女次元和凍京 NECRO 的候选尚需区分重复、质量筛选、资源完整性与其他场景。本轮未把这些候选计成已收录角色，也未宣称这三个范围完整。

## 行为验收与实际边界

- [共同策略与来源测试](https://github.com/tyqittle/anime-character-archive/actions/runs/39954056303)覆盖循环 true/false、匿名/具名组、多动作与重复定义、手动打断、过期失败、超时与释放、源文件缺失/越界/身份变化和重复导入。
- [跨游戏真实浏览器回归](https://github.com/tyqittle/anime-character-archive/actions/runs/39954056163)的 cubism-behavior 任务覆盖 11 个模型：10 个有预设动作的样本用真实 Cubism 更新与绘制推进超过两轮源时长，仍持续播放；airborne 示例源中没有预设动作，单独记录该能力。
- 同一任务验证具名/匿名动作选择、放大后换动作、源循环标志、网页清屏像素，以及桌面清屏 RGBA(0,0,0,0)。使用真实碧蓝航线 login 片段临时设置原生单次播放模式，验证结束后恢复待机；这一项不将原文件改写为非循环。
- [碧蓝航线六套模型及互动语音](https://github.com/tyqittle/anime-character-archive/actions/runs/39954056238)、[棕色尘埃2](https://github.com/tyqittle/anime-character-archive/actions/runs/39954056166)、[明日方舟](https://github.com/tyqittle/anime-character-archive/actions/runs/39954056154)与[既有 Spine/UI/取景回归](https://github.com/tyqittle/anime-character-archive/actions/runs/39954056224)通过。
- CI 使用软件 WebGL；这些结果证明功能与回归范围，不是用户显卡的实测帧率，也不代表逐个动作都经过人工视觉审查。

# 重返未来：1999 动态立绘导入

- 原始资源：`myssal/Reverse-1999-CN-Asset`，固定提交 `45e75248ba3b25053fd32e63ab13c2f9f54dd9df`，完整 `live2d/roles` 目录；冻结树 `aa535d5011e4279a41a222e7d387aad77c2487fa`。
- 源中 350 份 Cubism 设置：348 套角色／外观模型通过本轮验收，另 2 份只有独立项链光效，不按角色或皮肤计数。全部 350 份设置及引用均逐项核验，348 套模型均有对应的原生浏览器截图和合格预览。
- 来源审计为 `data/reverse1999-full-inventory.json`；预览验收为 `data/preview-audits/games-wave8.json`。模型数、对应预览数、已检查源设置数分别统计，不以目录完整度宣称当前游戏全集完整。
- 3 套原始设置把遮罩或噪声排在人物贴图前，造成颜色错乱／人物近乎全黑。固定版本 Cubism Core 解析原始 MOC 后确认仅使用纹理槽 0、1；来源适配器声明明确的原顺序与修正顺序，保留全部原始文件引用，生成带摘要的本地设置。葛天外观 02、远旅外观 04、回声谣「为魂灵歌」修复后均经目视核验。审计及内核摘要见 `data/reverse1999-texture-audit.json`，没有修改通用渲染器或替换人物贴图。
- 回声谣「为魂灵歌」的破碎、幽灵纹理曾被误判为渲染缺陷；对照官方宣传图后确认是原画设计，已恢复，并删除这次误判产生的排除逻辑。核验依据：[官方衣着发布](https://www.bilibili.com/opus/1249629326911995913)、[宣传图](https://img2-tc.tapimg.com/moment/etag/FgY50HcZnzgz4n-Ki9Gf9C_PZKKF_20260917151236.jpg/_tap_ugc.jpg)。后续不能仅凭特殊画风下结论。
- 中文角色名来自固定版本的社区资料镜像，逐编号或无歧义源名称匹配；出处、源提交及路径保存在 `data/reverse1999-names.json`。11 份尚未确认姓名的配置保留源编号；服装名称除经官方资料确认者外使用源外观编号。不同 ID、MOC 和源目录仍分别保留。
- 本轮以精美、成熟风格角色及其换装为重点，沿用完整游戏图鉴范围；普通非成人化角色、男性和非人角色不会被冒充为新的成人女性皮肤。仅按原生动态立绘核验，不把单独的游戏粒子／Unity 特效列作新立绘。

复现来源导入：

```powershell
node scripts/live2d_sources.mjs --scope reverse1999-portraits --import reverse1999-portraits --source-tree data/source-snapshots/reverse1999-roles-aa535d5011e4279a.json --output data/reverse1999-full-inventory.json
npm run maintain:animation -- --catalog games-wave8
```

共同维护入口负责源代表检查、缺失项采集、重试、转换、预览来源核验和覆盖报告；设置缓存按 Git blob 摘要复用。本地默认单路硬件渲染，检测到 CPU 渲染则停止。新来源和故障修正均通过数据及源适配器声明，不复制游戏专属流水线。

本记录描述来源与本地验收契约；网站上线以同一提交的 Pages 部署和线上实际播放检查为准。

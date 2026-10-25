# 托管来源的完整动态立绘导入

入口：`node scripts/import_hosted_spine.mjs`。范围在 `data/hosted-spine-source-scopes.json`；可用 `--scope epicseven` 或 `--scope shadowverse` 单独执行。新增目录通过共同 `data/animation-catalogs.json` 注册，沿用现有播放器和预览流水线。

这些原站没有不可变的素材 Git 版本，因此不把工具仓库的提交号冒充成素材版本。导入器保存完整元数据快照和 SHA-256，再逐项校验真实 JSON 骨骼、图集中的每页 PNG、尺寸和非零时间动画。每份资源的 SHA-256 写入 `resourceIntegrity`，浏览器也核验实际下载字节。源站文件变化时显示来源版本错误，不继续使用旧预览或旧缓存。

默认复用上一次快照和已校验的本地源文件，重复执行保留稳定 ID、现有预览和其他游戏。`--refresh-metadata` 重新读取完整索引；`--refresh-assets` 重新下载素材。已有 ID 的素材变化必须逐项传入 `--update-existing ID`，通过共同合并契约后才可更新。源文件缓存位于忽略的 `tmp/hosted-spine/`，不是网站发布内容。

《第七史诗》按原站 `unit`、`npc`、`special` 枚举全部角色、服装和剧情角色配置，排除不属于角色立绘的神器和战斗怪物。没有时间动画的配置写入 `staticSources`，不冒充动态立绘；缺文件、源站失败和不支持的格式保留在 `failures`。身体与正常面部拆层的模型按源查看器约定组合 `default` 与 `normal`，保留眨眼和嘴部，表情替换层不会全部叠加。

《影之诗》枚举所有分组中的全部主战者 ID，保留联动、故事、异装和周年版本。原索引 `01` 与素材编号 `1` 归为同一来源身份，不能把零填充编号当成缺失素材或额外皮肤。

离场特效骨骼只从人物取景计算中排除，原动画及特效仍完整保留；没有改贴图或删除白色衣服。个别源图集的 CR／重复 CRLF 换行、同一 PNG 的补充页和附件名尾空格经过有明确输入校验的兼容：合并页要求页头一致、区域不冲突，路径修正只接受唯一匹配，解释规则参与资源与预览身份。

来源范围完整不等于当前游戏全部版本完整；原站未公开的角色或皮肤仍不在可确认范围。来源审计见 `data/hosted-spine-source-audit-*.json`，完整图鉴覆盖报告区分来源配置、动态条目、静态配置、失败和真实预览。

## 预览与验证

日常维护入口已统一为 `npm run maintain:animation -- --catalog games-wave6`，包括代表模型预检、缺失项采集、断点续跑、失败重试、转换、来源核验与覆盖报告。完整用法见 [维护步骤](ANIMATION_MAINTENANCE.md)。

影之诗 PNG 使用直通透明度，目录显式声明 `premultipliedAlpha: false`；原始像素存在大量透明但 RGB 非零的区域，按预乘透明度显示会出现白块。第七史诗保持其源查看器使用的预乘透明度。影之诗早期模型还需组合 `default` 与 `skin_01` 才能解析待机眨眼引用的面部；导入器依据实际附件引用判断，预检会拒绝缺失附件。

两款托管来源声明 `downloadPolicy`：单个素材 90 秒、整个会话 120 秒。底层请求按显式预算等待完整响应体，不再把大贴图截为 12 秒；切换角色仍立即取消旧请求。未声明的旧目录和 Live2D 运行时下载保留原时限。该策略只影响传输，不改变素材及预览身份。

统一 `repair_missing_previews.mjs` 支持 `ARCHIVE_PREVIEW_BASE_URL`、`ARCHIVE_PREVIEW_ROOT`、`ARCHIVE_PREVIEW_PENDING`。可设置 `ARCHIVE_PREVIEW_SOURCE_CACHE=tmp/hosted-spine/index.json`，让浏览器读取已经下载且摘要一致的原始素材；仍使用真实骨骼、原贴图和原生运行时渲染，不代入静态图片或其他角色。捕获时隐藏页面工具条，随后使用共同 `preview_pipeline.py convert` 与 `publish --catalog games-wave6` 校验和发布。

`test_hosted_spine_browser.mjs` 对原始资源直接验证画面运动、正常面部层、异装、切换动作后缩放保持，以及主动回待机；CI 不依赖本地缓存。旧模型不声明新增字段时保持原身份、缓存键和皮肤选择方式，继续执行共同模块隔离与剧场界面回归。

CI 将原站访问与原生渲染分成两步：`source_asset_cache.mjs --preflight` 从原站读取代表模型，逐字节核验锁定摘要，并检查实际网站 Origin 的跨域响应；随后浏览器使用本次下载的原始字节缓存验证画面及操作。原站 HTTP、跨域或摘要失败仍会阻断，不用其他模型或静态图替代。这样可明确区分云端浏览器被原站风控拒绝与播放器本身出错。本地另外已完成两款游戏代表模型的无缓存直连播放检查。

原站与实现依据：[E7 Codex](https://e7codex.com/)、[E7 Codex 查看器固定源码](https://github.com/Aikiooo/e7codex/blob/d3ad601ce8575563b87c29a10ae71352dd4f1dac/site/viewer.html)、[SVGDB](https://svgdb.me/)。角色素材权利归原游戏权利人。

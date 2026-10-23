# 可持续维护评审（2026-10-23）

评审基线：`a9ce7d78535eb3837bcca1c1ecaf7d5b1e9af33d`。覆盖浏览器端、数据目录、导入/预览工具、持续集成，以及 Electron 与原生 Windows 客户端边界。

## 主要发现与本轮处理

| 优先级 | 问题及影响 | 本轮处理 |
| --- | --- | --- |
| 高 | 浏览器、Python 队列和通用截图工具分别维护目录清单；新游戏容易只接入一处 | `data/animation-catalogs.json` 成为共同注册表；浏览器与 Node 共用注册校验，Python 读取同一数据 |
| 高 | 按游戏复制截图/发布工作流，公共修复不能同时生效 | 默认自动入口统一为 `preview-pipeline.yml`；原命名入口保留为手动委托 |
| 高 | 截图开始后源目录可能更新，相同 ID 的旧帧会被误绑定 | 截图报告记录实际源标识；发布读取最新 main，对不匹配的帧拒绝覆盖 |
| 高 | 渲染、转码和发布逻辑散落；状态与 SHA 校验不一致 | 共用捕获器、图像策略及 `preview_repository.py`；旧发布 CLI 仅委托公共服务 |
| 中 | Windows YAML 混入约两万字符的实现/验证代码，难以独立阅读 | 七个步骤抽到 `native-desktop/build/`，工作流保留编排与权限 |
| 中 | 大量测试断言代码字符串，重命名容易误报，关键行为却未覆盖 | 增加注册表实际行为、源变更竞争和 YAML 拓扑测试；保留旧集成断言作辅助 |
| 中 | 历史架构文档只描述拆文件，未约束后续扩展 | 根目录 AGENTS、架构边界检查和新游戏接入步骤纳入常规 CI |

## 仍然存在的技术债

- 剧场、图鉴与 Cubism 页面仍使用经典脚本，共享全局状态；本轮新增的注册服务有显式边界，但没有把整站宣称为 ES Modules。
- `catalog.js` 仍混合卡片、缓存数据库和历史名称数据；语音映射仍内嵌在 JS。后续应分别迁入存储服务和数据文件，并以行为回归逐步替换入口。
- `tests/smoke.mjs` 仍较大，含历史源码断言；需按目录契约、页面契约和桌面发布契约逐步拆分。
- 原生桌面仍通过补丁适配固定上游。可持续方向是维护小型固定版本适配层或可复现的上游分支，不能继续无限叠加无锚点 Replace。
- 历史一次性诊断/导入工具保留以复现实验；不应成为新增游戏的默认入口。

这是一轮建立约束并迁移默认流程的重构，不是把所有旧代码重新命名后宣称已经消除技术债。

## 回归中额外修正

浏览器目录测试仍要求展示 209 个 BD2 条目和 242 个碧蓝航线条目，混淆了源资源总数与去重后的皮肤总数。测试现从共同注册表和同一套身份规则计算完整期望目录，同时继续检查分页、图片解码和深链接；没有通过降低固定阈值来掩盖遗漏。

## 后续迁移验收顺序

1. 先把 IndexedDB 与本地包操作从 catalog.js 抽成可注入存储服务，保留旧数据库/收藏键，验证事务提交、取消和损坏缓存恢复。
2. 再隔离播放会话状态与渲染适配器，最后迁移入口为 ES Modules；一次只迁移一个边界，保留真实浏览器回归。
3. 将语音、名称等大块内嵌映射迁往数据文件；来源与皮肤身份规则单独测试。
4. 拆分历史 smoke，统一样式覆盖入口，避免多个补丁样式表持续叠加。
5. 原生下载进一步统一流式响应体上限、取消与总预算；目前若干大小检查发生在完整接收之后。源代码包也应直接记录实际补丁工作树和构建输入，避免仅依赖上游 HEAD 加重建说明。

这些项仍是明确未完成的债务，不因目录重排或 CI 通过而自动消失。

## 本轮验收证据

| 验收 | 结果 |
| --- | --- |
| [基础检查](https://github.com/tyqittle/anime-character-archive/actions/runs/39896144871) | 54 项 Node 行为测试、29 项 Python 测试通过，包含完整 plan → convert → publish CLI 和源版本变更拒绝用例 |
| [真实图鉴浏览器回归](https://github.com/tyqittle/anime-character-archive/actions/runs/39894841783) | 全目录身份、去重、分页、图片解码和链接通过 |
| [碧蓝航线播放](https://github.com/tyqittle/anime-character-archive/actions/runs/39896144785) / [其他游戏播放](https://github.com/tyqittle/anime-character-archive/actions/runs/39896144761) | 真实浏览器播放检查通过 |
| [原生 Windows 完整构建](https://github.com/tyqittle/anime-character-archive/actions/runs/39894156322) | 七段构建脚本抽取后的实际构建、BD2 语音与资源、安装器、安全扫描和发布检查通过 |
| [统一预览流水线](https://github.com/tyqittle/anime-character-archive/actions/runs/39896144807) | 8 个分片和合并发布成功；126 项队列中 99 张合格预览入库，25 项渲染失败、2 项质量拒绝均保留诊断 |

运行中还修正了单字符模型文件名被旧校验误拒绝的问题，并让采集器使用页面明确的错误状态结束等待。少女前线妖精模型已在真实采集中恢复出图。流水线成功表示编排、验证和结果发布完成，不代表所有外部源资源均可播放。

## 部署边界仍待闭环

当前预览发布使用仓库 `GITHUB_TOKEN` 写回 main，不能依赖该次 push 自动触发 Pages 分支构建。[GitHub 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#troubleshooting-publishing-from-a-branch)明确这一限制。

应将静态数据和预览发布后的部署收敛到显式的 Pages artifact 发布链，并验证所部署的 commit SHA。当前连接没有 Pages 管理权限，无法核实或切换站点 Source 设置；本轮没有把未经验证的部署迁移加入默认流程。后续代码提交可能顺带部署新数据，但不应把这种偶然触发当作长期更新机制。

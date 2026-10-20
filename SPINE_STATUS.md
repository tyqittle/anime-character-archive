# Spine 动态播放器状态

- 页面：[`spine.html`](./spine.html)
- 动画索引：[`data/spine-characters.json`](./data/spine-characters.json)
- 当前索引条数：**62**（不是 62 个已通过播放验证的动画）。
- 客户端运行时：Esoteric Software Spine Web Player，按角色尝试使用 4.0 / 4.1 / 4.2。
- 资源流程：读取索引 → 下载第三方骨骼、Atlas、贴图 → 浏览器本地渲染，部分成功资源可存入 IndexedDB。
- 兼容性：播放器使用 `binaryUrl`/`jsonUrl` 与 `atlasUrl` 参数；避免改回无效的 `skeleton`/`atlas` 初始化参数。
- 目前尚未把第三方 Spine 二进制动画文件批量保存到本仓库。
- 不使用外站 iframe，仍依赖外部文件可用性及 Spine 版本匹配。
- 验证方法：访问 `spine.html`，先尝试官方示例，再逐个试播角色，检查控制台和页面的错误输出。

不要把自动化静态检查通过当成动态模型播放成功。

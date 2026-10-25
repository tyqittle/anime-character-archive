# 失落之剑动态立绘导入

- 原始资源：`SomeNiceDude/Lost-Sword-Gallery`，提交 `bdb1149251a36c477fbf018f37e7fbe5e70746d9`，完整 `AssetAddressable/Prefabs/LobbyUnit/` 目录。
- 完整 Git 树快照和逐模型源审计：`data/hosted-spine-source-audit-lostsword.json`；不是对当前游戏版本完整度的承诺。
- 发现 149 套角色/服装导出；本次成人角色范围收录 134 套，15 项范围外候选及原因逐项记录。原始骨骼中的表情/部件配置不按新服装重复计数。
- 134 套均有对应原生模型的浏览器截图和合格 WebP 预览；没有借用静态图或其他皮肤。包括 11 套完整前后层组合。
- 每份原始骨骼、图集和纹理均验证固定提交的 Git blob，并声明浏览器 SHA-256 锁。二进制 Spine 4.1 骨骼由固定版本及 SHA-256 的官方运行时解析动作。
- 调研中的另一个在线查看器响应了重复的 `Access-Control-Allow-Origin`，因此未作为生产素材源；最终代表检查直接连接原始 Git 资源，不使用资源缓存替代跨域验证。

复现导入：`node scripts/import_hosted_spine.mjs --scope lostsword`。

补齐或修复预览：`npm run maintain:animation -- --catalog games-wave7`。该目录与旧目录隔离选源，沿用共同的断点采集、转换、发布及来源身份检查。

本地验证：250 项 Node 测试、45 项 Python 测试、架构/冒烟检查通过。与 `4e72ed5` 对比，旧 5549 条记录未删除、未改变受保护来源或丢失预览。无缓存的新来源代表播放/动作/缩放/待机检查通过；旧游戏模块隔离及剧场完整操作流程通过。天狼星 `al-tianlangxing_5` 的专项复测在加载阶段超时，未计为本轮通过。

本记录描述本地验收；网站上线以对应提交的 Pages 部署及线上浏览器复测为准。

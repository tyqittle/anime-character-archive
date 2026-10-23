# Daiblos Core 动态立绘坐标修复记录

日期：2026-10-23。源资源固定在 `bungaku-moe/DaiblosCoreAssets@3c672a0f11cc70fee35432b1a28522d7d74068c2`。

## 根因与范围

首轮目录中的 125 套模型有 63 套的实际 PNG 尺寸与 Atlas 声明尺寸不同。原始 Atlas 坐标仍对应导出画布，源纹理经过等比或单轴缩放；运行时直接使用实际图像尺寸作为坐标分母，会从错误位置采样。即使所有坐标都落在 0..1 内，仍可能拼出错误人物。

| 模型 | Atlas 声明 | 实际 PNG | 旧行为 |
| --- | --- | --- | --- |
| Alps03（对照） | 4096×3500 | 4096×3500 | 尺寸一致，保持原结果 |
| Alps05 | 4096×2412 | 4096×2048 | 27 个区域、74 个当前附件出现越界 |
| Pelorovis03 | 4096×3836 | 2048×1918 | 227 个区域、231 个当前附件出现越界 |

只检测画面非空或像素连通性不能证明纹理映射正确；前一轮只标记了一个疑似模型，明显低估了问题。

## 共同修复

- 新增无 DOM 的 `ArchiveSpineAtlasCoordinates`，输入为已加载 Atlas、原 Atlas 文本、骨骼、运行时与显式坐标策略。
- 源模型通过 `atlasCoordinateSpace: "declared"` 启用声明坐标；没有策略的模型沿用原生行为，不按游戏名称切换算法。
- 每页独立换算 Region UV 和 Mesh 的裁切/偏移位移，保留 0/90/180/270 旋转语义；覆盖非活动皮肤及后续关联网格。
- 原图及 GPU 图像尺寸不变。已有浏览器缓存包在播放时应用适配，无须重新下载整套素材。
- 一像素尾部扩边按源格式约定保留，较大的越界仍拒绝；不靠任意裁切或钳制坐标掩盖问题。
- 坐标解释策略进入 JS / Python 共同来源标识，使旧规则生成的预览失效并重新采集。

## 已取得的证据

- [初始坐标 A/B](https://github.com/tyqittle/anime-character-archive/actions/runs/39936671105)：Alps05、Pelorovis03 修正后截图恢复完整人物，正常 Alps03 保持正确。
- [生产适配与恢复候选 A/B](https://github.com/tyqittle/anime-character-archive/actions/runs/39937828047)：通过共享适配恢复 Alps04、Hades03，并分别检查旧纹理坐标与声明坐标。所有帧保留为 Actions artifact。
- [125 套完整回归](https://github.com/tyqittle/anime-character-archive/actions/runs/39938146501)：125/125 可加载，63 套发生坐标尺寸适配；区域及当前附件越界检查均为 0。每套保留真实 Canvas 帧，仍标为 rendered-unverified，不能据此声称逐张人工确认了每个动作。

## 恢复与仍排除的资源

Alps04、Hades03 经声明坐标截图审查后恢复，当前目录 127 套。保持原 ID，并由同一预览流水线生成对应新帧。

- Meteor05：源骨骼引用了对应 Atlas 中缺失的附件，继续排除。
- Atum03a：切换声明坐标后仍只渲染极小场景，未恢复，不能因为 UV 未越界就标记可用。

不借用其他皮肤的图片，不通过删除大量模型掩盖通用兼容问题。来源检查、坐标检查、实际播放、动作覆盖与人工视觉审查分别记录。

## 防回归

单元测试覆盖相同尺寸、等比/单轴缩放、四向旋转与裁切偏移、多页声明、重复应用、非活动附件、关联网格、一像素扩边及较大越界拒绝。策略变更必须使旧预览失效。

另修复了旧旋转测试的假 Atlas 对象、浏览器测试遗漏 rotate 标志、图鉴模块顺序断言遗漏侧栏模块，以及导入器的逗号语法错误。维护入口现在执行 Node --check，避免有副作用的导入脚本因语法错误长期无人察觉。

## 最终目录验收

- [127 套完整浏览器回归](https://github.com/tyqittle/anime-character-archive/actions/runs/39938670715)：127/127 可加载并留存对应 Canvas 帧，65 套执行尺寸换算，区域和当前附件越界模型数均为 0。此结果不等于对每个动作的逐帧人工检查。
- [基础检查](https://github.com/tyqittle/anime-character-archive/actions/runs/39938670703)：102 项 Node 测试、33 项 Python 测试通过，包括维护脚本语法与旧预览失效回归。
- [其他 Spine 播放、目录与交互回归](https://github.com/tyqittle/anime-character-archive/actions/runs/39938146466)通过；更新源提交的 [Pages 部署](https://github.com/tyqittle/anime-character-archive/actions/runs/39938671889)通过。

- [统一预览发布](https://github.com/tyqittle/anime-character-archive/actions/runs/39938670743)：Daiblos Core 新采集并发布 127 张，当前 127/127 有来源策略一致的合格预览，缺失、拒绝及本轮失败均为 0；入库提交 `cc6676470c1d338e9426ddc881b9064a7f291e77`。

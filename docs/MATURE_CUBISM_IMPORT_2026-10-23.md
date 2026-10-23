# 成熟画风 Live2D 接入（2026-10-23）

沿用 `data/live2d-mature.json` 与共同 Cubism/预览流水线，无新增游戏专属处理工作流。

- 《LOVE³ -Love Cube-》：官方表明角色全为成年人，新增三位女性各两套常规 clothed `*_w` 模型，共 6 组 Cubism3、高清纹理和物理配置。该公开来源没有附带 motion3 动作，不能声称拥有完整动作。
- 《Fox Hime Zero》：成年角色瑠璃的巫女造型 1 组，附带 moc3、2 张纹理和多项 motion3 动作。
- 资源来自 `Eikanya/Live2d-model@7e446cbd95ec352cdb0f73c079e4d075d7d528ac`，只保留资源 URL 与来源，不镜像游戏模型；版权仍归游戏权利人。
- 已核对 model3/moc3/纹理/physics/motions 的源文件关系；尚未运行真实浏览器、预览和 Windows 端到端验证，标记为 `indexed-unverified`。
- 不引入明确成人场景 `adult/`、其他未确认造型。后续只允许真实模型帧通过统一 `preview-pipeline.yml` 发布。

# Windows 动态立绘桌面端透明渲染调研与重构方案

日期：2026-10-22  
状态：调研结论；未开始重构；**不得把 CI 通过当成 Windows 实机透明效果验收**。

## 1. 问题与证据

当前独立桌面端是 Electron 38 + 远程 `spine.html?desktop=1&id=...`。在用户的 Windows 10 截图中，角色本身显示出来，周围却是不透明白色区域。放大 BrowserWindow 只会放大白板；截图分析后经 `setShape` 改变窗口轮廓会导致动态残影、边缘裁切，不应继续使用。

曾有「透明渲染诊断」显示 HTML / body / stage / player 的 CSS 背景透明，但 `renderer: null`、`canvas: null`，截图样本 Alpha=255。**这不能单独证明 WebGL、Chromium 或 DWM 哪一层导致白色**，因为窗口截图可能合成过背景，且当时没有确认 Canvas 结点/iframe/模型当前状态；应当通过独立复现实验排查，不再猜。

Electron 官方透明窗口说明：`frame:false`、`transparent:true` 能得到透明窗口，但透明窗口的点击穿透和缩放存在限制，开发者工具打开时可能变不透明。Windows 系统上还有既往硬件加速/驱动透明问题。Windows 10 的 Electron #48592 报告了从 39.0.0-beta.3 开始的全白回归；本项目使用的是 38.x，**不能仅凭此 issue 将根因直接判定为同一个 bug**。

## 2. 参考开源项目与官方资料

| 参考 | 实际方案 | 对我们的意义 |
| --- | --- | --- |
| [My_SpinePet](https://github.com/KAIDO-YONAGI/My_SpinePet) | C# Spine 4.1 runtime + Direct3D 11 + DirectComposition，WPF 设置面板 | **首要原生 Spine 架构参考**；它不使用 Web 页面合成角色 |
| [NativeGraphicsDevice.cs](https://github.com/KAIDO-YONAGI/My_SpinePet/blob/main/SpinePet/src/SpinePet/Rendering/Native/NativeGraphicsDevice.cs) | `CreateSwapChainForComposition` + `AlphaMode.Premultiplied` + `ClearRenderTargetView(...RGBA 0,0,0,0)` | 骨骼模型真正保留每像素 Alpha 并交给 DWM |
| [NativeCompositionWindow.cs](https://github.com/KAIDO-YONAGI/My_SpinePet/blob/main/SpinePet/src/SpinePet/Rendering/Native/NativeCompositionWindow.cs) | Win32 原生 HWND + `WS_EX_NOREDIRECTIONBITMAP` + 透明/不激活/工具窗口属性 | 原生窗口和透明画面合成 |
| [NativeInputWindow.cs](https://github.com/KAIDO-YONAGI/My_SpinePet/blob/main/SpinePet/src/SpinePet/Rendering/Native/NativeInputWindow.cs) | 单独的输入窗口，在其中配置命中区域 | 人物可点击，其余区域不拦截桌面鼠标 |
| [VPet](https://github.com/LorisYounger/VPet) | WPF 桌面宠物、动作和交互体系 | 参考桌宠行为、托盘、状态、交互，不直接解决我们 Spine 渲染 |
| [l2dpet](https://github.com/jinsc123654/l2dpet) | C++ / Cubism Native，透明窗口、互动，独立设置面板 | 参考 Live2D 的原生显示与输入分离 |
| [Cubism 官方平台支持](https://docs.live2d.com/en/cubism-sdk-manual/platform/) | Cubism SDK for Native 支持 Windows + DirectX 11 | Live2D 原生渲染有官方 SDK 支撑 |
| [Microsoft DirectComposition](https://learn.microsoft.com/en-us/windows/win32/directcomp/bitmap-surfaces) | 将带透明通道的 GPU 图像交给桌面窗口管理器合成 | 原生合成有清晰规范 |
| [Electron 透明窗口文档](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles/) | Electron 透明窗有限制 | 网页透明不等于 Windows 层成功透明 |
| [Electron issue #40515](https://github.com/electron/electron/issues/40515) / [#48592](https://github.com/electron/electron/issues/48592) | 设备/版本相关的透明窗口异常 | 解释为何仅改 CSS 或 GPU 开关无法保证所有 Windows 10 机器可用 |

**许可证限制**：My_SpinePet 自身遵循 GPL-3.0-or-later，不得不顾许可直接复制代码。Spine runtime 另有 Spine Editor / runtime 许可证要求；Live2D Cubism SDK 和游戏资源也各自有授权条件。正式整合前检查使用与再分发许可。参考：
- https://us.esotericsoftware.com/spine-editor-license
- https://github.com/EsotericSoftware/spine-runtimes
- https://www.live2d.com/en/terms/live2d-proprietary-software-license-agreement/

## 3. 正确的绘制管线（最重要）

```text
动画资源 (.skel/.atlas/.png 或 .moc3/.model3.json)
                │
          对应版本原生运行时
                │
     Direct3D 11 带 Alpha 的离屏/交换链
      清屏 RGBA=(0,0,0,0)
      BGRA8 + Premultiplied Alpha
                │
          DirectComposition
                │
         Windows DWM / 桌面
```

- 不要把透明像素预先填成白色或做颜色键抠图。
- 不要用 `capturePage` / 像素采样 / `setShape` 每 430 毫秒“重建视觉轮廓”，它必然有动画同步问题。
- **绘制与输入分离**：视觉窗口只负责显示（画面按 Alpha 由 Windows 合成）；另一个输入层基于模型真实几何或轻量命中区域决定何时接收鼠标。即使命中区域略有延迟，也不影响视觉。
- 画布不是无穷大：每个角色的绘制表面应随骨骼极值和当前缩放分配合适边界/安全余量；角色移动改变视觉变换或窗口锚点，避免平移骨骼后超过画布被裁剪。对多屏幕用虚拟屏幕坐标。

## 4. 适配我们现有立绘仓库

保持当前网站作为选角、搜索、预览、资源管理入口；**将桌面渲染从 Electron 网页播放器解耦**。

```text
网站选中角色 / 「放到桌面」
        │ 角色 ID / URL 交换
        ▼
Windows 桌面宿主（托盘/设置/协议）
        ├─ 资源解析与缓存（模型、动作、语音）
        ├─ Spine adapter（按资源的 3.8/4.0/4.1/4.2 版本选择）
        ├─ Cubism adapter（Native SDK DirectX 11）
        ├─ GPU 透明合成（DirectComposition）
        ├─ 独立鼠标命中/拖动/缩放
        └─ 音频事件与状态持久化
```

重点：My_SpinePet 的**Spine 4.1**原生渲染不能直接无损加载所有其他骨骼版本。我们的网站当前有 3.8、4.0、4.1、4.2 版本，因此不能直接套用单版本工程并宣称全角色兼容。

## 5. 验证流程（按顺序；禁止跳关）

### A. 最小透明实验（不加载任何游戏资源）

1. Electron 透明窗只画一个半透明彩色圆，纯 HTML/CSS。Windows 10 真实桌面截图检查背景。
2. Electron 透明窗使用 WebGL 只画一个半透明三角形，检查窗口的每像素 Alpha。
3. 仅当以上用例都正确，再加载原来的 `spine.html`；逐一检查 Canvas 的 `getContextAttributes().alpha`、清屏 Alpha、iframe/DOM 与 `premultipliedAlpha`，不要把 `capturePage` 读出的 Alpha 当作最终显示证明。
4. 在 Windows 10 / 11、不同 GPU 驱动、DPI 缩放上分别验证，保留屏幕实拍截图和 GPU/系统信息。

**若 1 或 2 在用户机器上失败，就不再继续试图用 CSS 修复 Electron**。只用 Electron 保留网站/管理工具，不承载桌面角色。

### B. 原生渲染 PoC（优先）

1. 创建纯 Win32 + Direct3D 11 + DirectComposition 演示；先画透明背景上的一个会动的三角形或贴图，确保 Windows 10 没白板。
2. 接入一个授权示例 Spine 模型；严格核对其导出版本与 runtime 版本，再验证空闲动画、透明边缘、60 FPS（以正常设备为目标而非承诺）。
3. 拖动时角色可到屏幕任意位置，空白区域可点到桌面图标；**不出现视觉抠图、残影**。
4. 用相同窗口合成器接入一个 Cubism Native 官方示例模型。
5. 上述成功后，才开始迁移我们的网站目录、语音与动作。

### C. 成品验收

- 黑色、白色、视频壁纸等背景下，角色边缘均正确且无白底/白边。
- 每帧角色轮廓与动作同步；快速摇摆、拖动/缩放时不得出现前一帧残影。
- 桌面图标和普通应用不会被大片透明窗口阻挡。
- 窗口可见位置、鼠标点击/拖动与实际人物位置一致；窗口在屏幕边缘不会凭空消失。
- Spine 多版本与 Cubism 按明确支持列表单独测试，声音有来源映射且点击后正常触发。
- Windows 10 和 11 实机通过后再发布稳定安装包；GitHub Actions 绿勾仅代表 CI 与打包成功。

## 6. 决策

**推荐路线：保留网站与资源库，采用 Windows 原生桌面渲染宿主。首选 Direct3D 11 + DirectComposition；My_SpinePet 只作架构参考，不能无条件直接复制 GPL 代码。** 现有 Electron v0.3.x 可保留为历史验证分支，但不应继续将截图抠图或大窗口补丁作为最终交付。

风险主要在多版本 Spine 运行时、Live2D Cubism SDK 和素材的合法使用、用户设备的 GPU 环境；这三项要先做能力探针及原生 PoC，不能以“安装包成功生成”掩盖。


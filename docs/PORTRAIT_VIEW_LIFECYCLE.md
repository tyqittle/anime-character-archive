# 立绘取景与渲染会话

## 问题与边界

动作菜单原来调用 resetViewerTransform；SpinePlayer 又会按每个动作重新计算视口，即使保留缩放数值，人物的实际大小仍会变化。骨骼动作范围还包含透明留白、远处特效，导致不同模型初始大小和位置差异过大。

vendored Spine 3.8 只有 stopRendering，没有 dispose。旧 clearPlayer 的可选 dispose 调用没有停止它的 requestAnimationFrame。pause 也只是停止动作时间，仍不断绘制。连续换角色会遗留渲染工作和 WebGL 资源。Live2D 原有独立共享 ticker 与 Application ticker；新实现让 Application 单独拥有模型更新与绘制。

## 实现契约

- `shared/portrait-framing.js` 接收像素数组、矩形和视口尺寸，输出可见边界与相机矩形；没有 DOM、游戏 ID 或网络依赖。
- 首次绘制后在绘制回调内缩小到最长边 384 像素做一次可见内容检测，排除透明/固定背景及孤立噪点。以可见场景的整体范围居中，不推断人体、不裁掉场景背景。无法采样时保留原有动画或模型边界。
- Spine 使用世界坐标相机，Live2D 使用模型局部坐标；保持原图与原始资源身份。默认约占可用宽度 90% 或高度 88%，宽场景由宽度约束，竖立绘由高度约束。
- 同一模型切换动作保留缩放、平移和基准取景。Spine 适配同时兼容 3.8 返回矩形和 4.x 写入输出矩形的 API，跳过重复的 100 姿态同步扫描。
- 新模型建立新取景；适应画面或双击才重新检测当前动作。手动操作取消未完成的自动取景，避免迟到结果覆盖用户缩放。
- Spine 3.8 的运行时适配提供幂等 dispose，先阻止已排队的帧，再释放图集、渲染器并主动释放 WebGL 上下文；隐藏页面跳过绘制。Spine 4.x 保留原生 dispose。
- Live2D 关闭模型 autoUpdate，以 Application ticker 的 deltaMS 更新，暂停页面同时停止模拟和绘制。缩放与动作选择不重置局部取景。
- 清晰度仍按屏幕 DPR 提供画布；纹理锐化不额外强制 1.5 倍超采样。

## 验证

`test_portrait_framing.mjs` 覆盖非零原点、透明留白、孤立粒子、横竖视口、坐标映射、连续相机更新和动作保留；`test_spine_lifecycle.mjs` 验证已经排队的旧帧、重复释放与隐藏恢复。

`test_portrait_view_browser.mjs` 加载真实 Daiblos Core、蔚蓝档案与棕色尘埃2，检查实际可见范围、居中、换动作和侧栏尺寸变化，检查退休会话不再绘制；现有 Live2D 浏览器测试验证模型更新时钟、可见取景和动作保留。

GitHub Actions 使用软件 WebGL 验证行为，不代表 RTX 5060 Ti 的实测 FPS。这个修复不承诺所有大型场景在任意浏览器上达到固定帧率。不同模型内容的长宽比及场景背景仍然不同；统一的是取景规则，不强行把所有人物拉成相同尺寸。

## 本次验收记录（2026-10-23）

行为修复提交：`d78b3d47fc5e75119d52f9047b604556d277fb8e`。后续版本提升仅更新缓存入口和维护记录。

- [Node/Python 与架构检查](https://github.com/tyqittle/anime-character-archive/actions/runs/39945599326)：112 个 Node、33 个 Python 测试通过。
- [真实画布取景与会话回归](https://github.com/tyqittle/anime-character-archive/actions/runs/39945599398)：Cinnabar03b、Alps04、Alps05、Hades03、蔚蓝档案 ch0145 和棕色尘埃2 Diana 六个针对样本通过；同一任务还通过既有选角、UV 与十套真实模型动画回归。
- [Live2D](https://github.com/tyqittle/anime-character-archive/actions/runs/39945599387)：六套模型动画、动作保留、单时钟更新、互动语音和静音通过。
- [明日方舟](https://github.com/tyqittle/anime-character-archive/actions/runs/39945599482)与[棕色尘埃2](https://github.com/tyqittle/anime-character-archive/actions/runs/39945599393)原有浏览器回归通过。
- [实际 Pages 部署](https://github.com/tyqittle/anime-character-archive/actions/runs/39945599241)的 deploy 任务成功。

六个针对样本的初始可见范围中心落在画布宽、高的 48.4%–50.3% 之间；可见范围相对 90%/88% 目标占比约 99.4%–103.8%，差异包括动画移动与边缘采样。相同页面连续换角色后，五个退休会话均已释放，观察期间绘制计数没有再增加。

3.8 的加载屏和角色共用 SceneRenderer，不能挂在每次 renderer.end 上采样；最终取景在 drawFrame 返回后执行。4.x 使用角色绘制后的 config.draw。浏览器取证同样在完整角色帧后复制 WebGL 画布，避免元素截图把两侧浮动按钮计入边界。四套 Daiblos 场景输出图已检查，未借用其他模型资源。

适应画面还会读取当前姿态的几何边界，以重新找回已移动到旧视口外的动作，再进行一次像素取景。动作菜单不会触发这一过程。保存的素材包与资源来源标识保持兼容，不需要重新下载全部素材。

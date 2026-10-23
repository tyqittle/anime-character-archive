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

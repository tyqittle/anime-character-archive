# 次元桌面立绘（Windows）v0.3.1

本项目复用线上动态立绘播放器，支持 Spine / Cubism Live2D，桌面背景应由动画自身的 Alpha 透明通道合成，不经过人物截图、分割、白色背景抠图或 `setShape` 动态轮廓裁切。

## 安装

1. 打开 [Desktop Windows build](https://github.com/tyqittle/anime-character-archive/actions/workflows/desktop-windows.yml)。
2. 选择构建成功且包含 `v0.3.1` 修改的工作流记录，下载 `anime-character-desktop-windows` Artifact。
3. 解压后运行 `次元桌面立绘 Setup 0.3.1.exe`，覆盖旧版。便携版可直接运行，但网站一键打开需要协议注册，优先使用安装版。
4. 在 [网站动态立绘页面](https://tyqittle.github.io/anime-character-archive/spine.html) 选择角色，点击「放到桌面 ↗」。

安装包没有数字签名。若构建尚未成功，不要安装之前的 v0.3.0 截图轮廓方案。

## 透明渲染

**v0.3.1 移除了整个截图抠图流水线**。旧版 0.3.0 每隔约 430 毫秒重建 Windows 原生窗口形状，导致人物移动时出现残影、缺口与硬边；现在只保留 Spine/Live2D 自身的透明画布，角色逐帧正常渲染。

部分 Windows 10 / ANGLE D3D11 驱动组合会错误地把透明窗口合成成不透明背景。因此 Windows 10 上新版默认尝试**兼容透明模式**（软件合成）；右键角色或系统托盘可取消「兼容透明模式」，自动重启并恢复 GPU 路径。若软件合成模式完全不支持 WebGL，会自动恢复 GPU 模式。兼容模式可能降低动画帧率，尤其在高分辨率大画布上。Windows 11 默认保留 GPU 加速。

与旧版不同，v0.3.1 不会让系统周期性“抠图”角色，也不再通过窗口截图推断人物轮廓。若某台设备仍显示白底，需要查看「透明渲染诊断」中的 WebGL 和硬件合成信息，不应重新引入实时抠图。

## 操作

- 桌面画布覆盖主显示器可视区域（各边 1 像素安全距离），没有固定小播放器框；角色可以在画布内拖动及缩放。
- 空白区域默认通过鼠标穿透交还给 Windows；角色附近允许交互，命中区域仍是粗略估计，而非像素级。
- 托盘菜单支持切换角色、开关声音、置顶、强制穿透、重新载入以及退出。
- 网页播放依赖原有 CDN 及在线模型资源，不支持完全离线。

## 开发测试

```powershell
cd desktop
npm install
npm run check
npm test
npm start
```

`npm run dist` 可在 Windows 构建安装版和便携版。GitHub Actions 会运行 JS 语法测试、单元测试，再构建并上传 EXE。

自动测试不等同于 Windows 图形桌面实机验证，尤其不能证明所有显卡都支持兼容透明模式；部分 Live2D/Spine 模型需要 WebGL，软件模式可能受限。

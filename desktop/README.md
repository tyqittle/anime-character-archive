# 次元桌面立绘（Windows）

这是网站的 Electron 桌面客户端，直接复用在线 Spine / Cubism 播放器；**并非离线版**。

## 安装和使用

在仓库的 [Desktop Windows build](https://github.com/tyqittle/anime-character-archive/actions/workflows/desktop-windows.yml) 中找到成功的构建记录，展开 **Artifacts**，获取 `anime-character-desktop-windows` 并解压。包含 Windows 安装器和便携版（只有构建成功时才存在）。

建议使用 **安装器**，因为 Windows 的 `animecharacter://` 协议需要注册。装好后，打开 [动态立绘网站](https://tyqittle.github.io/anime-character-archive/spine.html)，选择角色，按「放到桌面 ↗」。第一次可能需要允许浏览器启动外部应用。

桌面模式现在使用几乎覆盖主屏幕、完全位于屏幕内的大透明画布。左键拖动人物即可在画布里自由移动，不再移动小矩形窗口；右键人物可打开菜单。透明空白区域默认鼠标穿透，不影响普通桌面点击。托盘菜单可以切换角色、启用鼠标穿透、切换置顶、关闭点击语音、隐藏或退出。开启鼠标穿透后无法右键角色，但仍可从系统托盘恢复交互。角色及语音等偏好会自动保存。大透明画布固定覆盖主显示器，窗口尺寸不再手动调整；角色在画布内移动。

如果在 Windows 电脑上自行运行源码：

```powershell
git clone https://github.com/tyqittle/anime-character-archive.git
cd anime-character-archive/desktop
npm install
npm test
npm start
```

构建：

```powershell
npm run dist
```

输出位于 `desktop/dist/`。安装包未签名，部分系统可能显示发布者未知。

## 已知限制

1. 需要在线访问 GitHub Pages、Spine / Cubism 运行时、游戏模型及其源站。网络故障或原站失效可能导致模型加载失败。
2. 已提供 Spine 透明渲染参数及 Live2D iframe 背景透明，但某些旧版渲染器或模型仍可能显示背景，需要实机确认。
3. 点击语音仅支持已经找到有效音频映射的角色；不能保证所有模型都有声音，角色动作与音效均受源素材限制。
4. 默认启用空白区域自动穿透，人物附近的命中区域为保守估算，并非像素级轮廓；人物附近少量透明区域仍可能接管鼠标。托盘里的「强制鼠标穿透」可以完全关闭角色互动。
5. 工作流配置和 JavaScript 语法检查不等于 Windows 实机验收；需要成功的构建日志和实际运行测试后才能将其视为完全验证。

## 自动化质量检查

Windows 构建工作流依次运行 JavaScript 语法检查、桌面客户端单元测试、配置验证以及 Electron Builder 打包。构建产物保留 14 天。

游戏素材版权归原权利方，请仅在拥有合法授权的范围内使用。

## 0.2.0 说明

- 修复旧版本人物在 440×650 窗口内拖出边界就被裁切的问题：默认渲染区域改为主显示器内部（四周留 1 像素边距）。
- 默认让透明空白区域透传鼠标事件，仅人物附近恢复点击互动。此方案基于区域估算，而非逐像素透明度命中。
- Spine 和 Live2D 现在使用各自的画布内人物移动能力，避免拖动整个桌面大窗口。
- 扩大画布会增加 WebGL 绘制面积和显存消耗，建议实机观察帧率；尤其在 4K 和高 DPI 显示器上。

## 0.2.2 Windows 10 白屏修复

- 取消旧版将整个透明窗口延伸到显示器外侧的方案。Windows 10 上 Electron 的透明窗口在越过屏幕边界时可能变成整块不透明白色（[electron/electron#48592](https://github.com/electron/electron/issues/48592)）。
- 桌面画布现在紧贴主显示器内部边界（每边留 1 像素），角色仍可在其中移动。这个方案不会渲染到屏幕外，但已大幅增加相对旧版 440×650 窗口的活动空间。
- 新增客户端右键或托盘菜单里的「透明渲染诊断」，显示 HTML 背景、WebGL Alpha 实际值与桌面截图像素样本，便于判断是否仍存在显卡合成问题。
- 明确限制：屏幕之外没有可见内容，不可能在物理显示边界外绘制人物；角色在可视范围内移动即可。

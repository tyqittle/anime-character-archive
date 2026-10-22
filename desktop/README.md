# 次元桌面立绘（Windows）

这是网站的 Electron 桌面客户端，直接复用在线 Spine / Cubism 播放器；**并非离线版**。

## 安装和使用

在仓库的 [Desktop Windows build](https://github.com/tyqittle/anime-character-archive/actions/workflows/desktop-windows.yml) 中找到成功的构建记录，展开 **Artifacts**，获取 `anime-character-desktop-windows` 并解压。包含 Windows 安装器和便携版（只有构建成功时才存在）。

建议使用 **安装器**，因为 Windows 的 `animecharacter://` 协议需要注册。装好后，打开 [动态立绘网站](https://tyqittle.github.io/anime-character-archive/spine.html)，选择角色，按「放到桌面 ↗」。第一次可能需要允许浏览器启动外部应用。

桌面窗口上沿小把手可以拖动；右键角色可打开菜单。托盘菜单可以切换角色、启用鼠标穿透、切换置顶、关闭点击语音、隐藏或退出。开启鼠标穿透后无法右键角色，但仍可从系统托盘恢复交互。窗口位置、尺寸、角色及偏好会自动保存。

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
4. 鼠标穿透针对整个矩形窗口，不是人物像素轮廓级别。
5. 工作流配置和 JavaScript 语法检查不等于 Windows 实机验收；需要成功的构建日志和实际运行测试后才能将其视为完全验证。

## 自动化质量检查

Windows 构建工作流依次运行 JavaScript 语法检查、桌面客户端单元测试、配置验证以及 Electron Builder 打包。构建产物保留 14 天。

游戏素材版权归原权利方，请仅在拥有合法授权的范围内使用。

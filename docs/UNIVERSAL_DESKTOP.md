# 通用桌面宿主

网站目录与桌面宿主通过角色身份连接。适配范围是本站当前注册目录与网页支持的引擎，不接受任意第三方网页地址，也不保证源文件损坏或来源失效的模型可播放。

## 边界

- `ArchiveWebSelection` 解析 `animecharacter://open?host=webview2&game=...&id=...`，验证长度、唯一参数与控制字符。身份不是文件路径；协议不允许传入下载地址。
- `NativeUniversalDesktop` 拥有当前宿主、加载取消、持久状态与用户配置路径。旧 NIKKE / BD2 协议继续进入原生 4.1 导入路径。
- `ArchiveWebViewHost` 在 STA UI 线程创建 CompositionController，验证固定站点、页面、会话和目录身份。角色就绪还必须收到有可见像素的输入轮廓。关闭时释放控制器、输入窗口及 D3D / DirectComposition 对象。
- `ArchiveWebComposition` 只负责 GPU 合成 visual 的所有权。画面由 WebView2 直接提交透明合成，不用截图绘制窗口。
- `desktop-webview-bridge.js` 是网页引擎与宿主之间的适配边界；目录仍由共同注册表加载，动作仍由已有播放器执行。Spine 与 Cubism iframe 在完整绘制后报告状态。
- `desktop-alpha-mask.js` 是无 DOM 的输入区域服务。每 100ms 至多读取最长边 320 像素的低分辨率 Alpha，合并矩形并限制为 768 个区域。该掩模仅控制命中，不修改显示像素或删除白色服装。
- 原生输入窗口沿用 Win32 区域去重。角色右键菜单提供动作、缩放、适应画面、语音、重试和隐藏。

新增使用已有引擎的游戏只更新目录和来源适配，不增加客户端游戏白名单。新增引擎先实现网页运行时及其渲染完成钩子，再扩展代表模型回归。

## 存储与升级

WebView2 用户数据放在用户选定素材目录的 `.archive-webview2/`，位于自动更新替换的程序目录之外。网页原有 IndexedDB 名称与资源身份规则保留。角色视图按游戏与 ID 保存；动作切换不触发重新取景。旧原生模型、配置与收藏不清空。

新宿主首次使用需要下载其浏览器缓存，不会把已有原生目录冒充浏览器缓存。在线目录与首次素材请求仍依赖网络；这不是全站离线包。

程序依赖固定版本的 Microsoft.Web.WebView2 SDK 与 Evergreen Runtime。Windows 已有运行时则复用；缺少时使用包内微软官方、构建时核验 Authenticode 的引导程序。程序启动前核对其 SHA-256 收据。取消角色加载不终止正在安装的共享运行时任务。安装器仍使用现有 Velopack 更新源和双目录向导。

## 验证与发布

Windows 流程先构建实际应用，核验官方运行时依赖，再运行协议、请求领取竞争、真实 CompositionController 透明像素与 Win32 输入区域测试，以及网站代表模型的持续绘制、缩放和动作切换回归。原有原生 4.1、BD2 全身命中、双目录安装和独立扫描继续执行。结果保存在 `native-desktop-regression-results`。

网站启动按钮只能在该协议的二进制通过测试并发布后启用。发布报告必须写明具体版本和实际测试范围；架构覆盖不等于逐个模型已人工验收。

官方 API：[CompositionController](https://learn.microsoft.com/dotnet/api/microsoft.web.webview2.core.corewebview2compositioncontroller)、[Runtime 分发](https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution)。

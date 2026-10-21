# 可选：本地启动

**在线使用**：https://tyqittle.github.io/anime-character-archive/ ，无需下载、安装或本地服务器。

项目仓库：https://github.com/tyqittle/anime-character-archive

如果需要在本机调试：

1. 从新仓库下载 ZIP，解压全部文件。
2. Windows 可双击 `start-local.bat`（需要 Python 3）；也可在仓库根目录运行 `python start_site.py`。
3. 浏览器打开启动器输出的地址。首页为角色图鉴，`/spine.html` 为动态立绘播放器。
4. 关闭终端即可停止服务器。

只检查索引和项目结构时，安装 Node.js 22+ 后运行 `node tests/smoke.mjs`。

> 请使用新仓库名 `anime-character-archive` 对应的在线路径。旧仓库地址不再作为文档中的正式入口。

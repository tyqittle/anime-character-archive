# 可选：本地启动

**普通使用直接打开** https://tyqittle.github.io/winter-cg-archive/ ，不需要下载、安装或本地服务器。

需要在本机调试时：
1. 下载仓库 ZIP 并解压全部文件。
2. Windows 可以双击 `start-local.bat`（需要 Python 3），或者在项目目录运行 `python start_site.py`。
3. 浏览器打开启动器给出的网址；首页为角色图鉴，`/spine.html` 为动态播放器。
4. 关闭终端即可停止服务器。

若只需检查索引和项目结构，可安装 Node.js 22+ 后执行 `node tests/smoke.mjs`。

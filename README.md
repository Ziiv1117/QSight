# QSight · 质界智检

QSight: A Trustworthy Multi-View Industrial Inspection System，面向多品种、小批量制造场景的多视角工业缺陷识别系统。

## 当前可运行范围

已有 React 前端、FastAPI 本地 API、SQLite 自动建表、工件和质检任务创建/查询、文件图像导入及记录追溯。部分页面仍使用静态演示数据，不能作为真实检测结果。相机、算法推理、报告导出和模型激活尚未接入，`algorithms/` 目前是占位目录。

当前启动无需模型权重、GPU、CUDA、Docker、外部数据库或 API 密钥。SQLite 随 Python 提供。首次安装依赖需要联网；依赖安装完毕后，可以用下方手动命令离线启动，跳过安装步骤。

## 环境与依赖

| 工具 | 项目基线 | 用途 |
| --- | --- | --- |
| Node.js | 24.x，本机验证 24.18.0 | 前端构建与运行 |
| npm | 11.x，本机验证 11.16.0 | 按 package-lock.json 安装 |
| Python | 3.12.x，本机验证 3.12.10 | 后端及内置 SQLite |
| 浏览器 | 支持现代 JavaScript 的浏览器 | 访问前端 |

安装 Node.js 和 Python 时加入 PATH，安装后重新打开终端。`.nvmrc`、`.python-version` 记录验证版本，供已有版本管理器使用；它们不会自动安装运行环境。

前端依赖由 `frontend/package.json` 声明，`frontend/package-lock.json` 锁定完整依赖树，必须一起提交。使用 `npm ci`，不要删除锁文件重新解析。后端运行依赖在 `backend/requirements.txt`，测试依赖在 `backend/requirements-dev.txt`；直接依赖已固定版本，间接依赖仍由 pip 解析。

## Windows 一键启动

在仓库根目录双击 `start-qsight.bat`，或运行：

```powershell
.\start-qsight.bat
```

入口调用 `scripts/start-local.ps1`：检查环境及 8000/4173 端口，创建 `backend/.venv`，同步后端依赖，执行前端 `npm ci` 和构建，启动 API、等待数据库就绪，再打开前端预览。

- 页面：http://127.0.0.1:4173
- API 文档：http://127.0.0.1:8000/docs
- 健康检查：http://127.0.0.1:8000/api/v1/health
- 后端启动日志：`backend/runtime/api.stdout.log` 和 `api.stderr.log`

保持启动终端运行，使用 Ctrl+C 停止，脚本会清理自己启动的后端进程。避免直接强制结束终端；若残留服务占用端口，请确认所属进程后手动停止，再启动。此入口用于本地预览，不是生产部署服务。

## 手动启动（适合 Agent 和开发）

以下两个终端都从仓库根目录开始；不要在同一个被服务占用的终端继续输入命令。

终端 A，Windows PowerShell：

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

终端 B，Windows PowerShell：

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run dev -- --strictPort
```

打开 http://127.0.0.1:5173。前端 `/api` 请求由 Vite 代理到本地 8000 端口。分别在两个终端按 Ctrl+C 停止。

macOS / Linux 可使用相同的手动流程，将 `python` 改为 `python3`、虚拟环境解释器改为 `backend/.venv/bin/python`、`npm.cmd` 改为 `npm`。跨平台流程尚未在本项目实机验证，Windows 一键脚本仅支持 Windows。

## 环境配置（可选，默认即可启动）

默认无需创建 `.env`。需要改变数据位置时，将 `backend/.env.example` 复制为 `backend/.env`，取消需要的行的注释并填写本机绝对路径。一键脚本会自动加载；手动启动需在 uvicorn 命令末尾增加 `--env-file backend/.env`。应用本身不自动读取 `.env`；已存在的进程环境变量优先。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| QSIGHT_RUNTIME_DIR | 仓库下 backend/runtime | 运行数据根目录 |
| QSIGHT_DB_PATH | 运行数据目录/qsight.sqlite3 | SQLite 文件路径 |
| QSIGHT_IMAGE_DIR | 运行数据目录/images | 导入图像目录 |

数据库和图像目录会自动创建，无需手动执行 SQL。相对路径按启动工作目录解析，所以建议使用绝对路径。修改位置不会自动迁移原有数据。单文件上传限制当前为 20 MiB，是代码常量，尚无环境变量开关。

前端目前没有必填环境变量。API 代理地址定义在 `frontend/vite.config.ts`；改后端端口时要同步修改其中的开发/预览代理目标。不要在前端环境变量中存放密钥。

## 验证与协作者 Agent 指令

请协作者将以下指令交给 Agent：

> 先读取根目录 AGENTS.md 和 README.md。检查 Node.js 24、npm 11、Python 3.12，按 README 安装依赖并启动前后端。不得假设算法已接入，不改写业务代码，不执行 git push。验证健康接口中 data.service 为 qsight-backend、data.database 为 ready，再检查浏览器能打开页面且 API 请求成功。运行下方构建和后端测试；报告实际访问地址及失败原因。端口冲突时先确认现有进程归属，不要直接杀死无关进程。

在根目录执行：

```powershell
npm.cmd --prefix frontend run build
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
Push-Location backend
.\.venv\Scripts\python.exe -m pytest tests -q
Pop-Location
```

现有集成测试使用临时目录，覆盖健康检查、创建工件/质检、导入两视角图片与查询记录，不会写入默认业务数据库。浏览器验收可创建测试工件并导入测试图片，再到记录追溯查看；这些手动操作会持久化到所配置的数据目录。

API 契约位于 `contracts/openapi/qsight-v1.json`，接口变动后可在根目录运行 `backend/.venv/Scripts/python.exe backend/scripts/export_openapi.py` 重新导出。

## 常见问题

- 找不到 Python/Node/npm：安装上述版本，重新打开终端，再检查 `python --version`、`node --version`、`npm.cmd --version`。
- 旧虚拟环境版本错误：先停止服务，将 `backend/.venv` 重命名留存，再用 Python 3.12 创建新环境；不要复制他人的 `.venv` 或 `node_modules`。
- 依赖下载失败：检查 npm/PyPI 网络或代理后重试，保留锁文件，不要通过随意升级依赖绕过问题。
- 端口占用：停止已确认属于本项目的旧实例，或按上面的代理说明协调端口。
- 页面能打开但 API 失败：检查 8000 端口健康接口、后端日志和 Vite 代理；不要直接双击 `frontend/dist/index.html`。
- 数据写入失败：确认运行目录可写、磁盘空间足够；变更数据路径后重新启动。

## 提交内容

提交源码、启动脚本、README、AGENTS、依赖清单和前端锁文件，以及脱敏契约。`.gitignore` 排除虚拟环境、node_modules、构建产物、IDE 配置、测试缓存、`.env` 和默认运行数据，但保留 `.env.example`。自定义到仓库内其他目录的业务数据需要另行排除；真实图片、数据库、模型权重和密钥不能提交。

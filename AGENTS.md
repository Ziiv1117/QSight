# QSight 项目开发约定与架构

## 1. 项目目标

QSight（质界智检）是一个本地优先、可离线运行的多视角工业缺陷识别系统。

系统以“质检任务（inspection）”作为数据与追溯单元，以自动化状态机作为正式运行方式。人工创建任务仅用于调试、返修复检和临时补检；正式生产应由扫码、工件到位、PLC 或 MES 事件触发任务创建。

完整业务链路：

```text
工件触发
→ 创建并绑定质检任务
→ 采集或导入多视角图像
→ 图像完整性与质量检查
→ 异常推理和像素级定位
→ 多视角证据融合
→ 正常 / 异常 / 需要复核三态决策
→ 自动放行、拦截、补拍或人工复核
→ 报告生成与全流程追溯
```

任何图像读取、设备、推理、存储或版本校验失败都不得默认判定为正常。

## 2. 当前事实边界

- `frontend/` 已存在 React + TypeScript + Vite + Ant Design 前端，包含工作台、新建质检、多视角查看、诊断、人工复核、追溯、报告和模型管理页面。
- 当前前端主要代码仍集中在 `frontend/src/App.tsx`，业务数据和状态大多为本地静态数据或 React 内存状态。
- 当前已有 FastAPI 后端、SQLite 持久化、工件/质检创建查询和文件图像导入；真实推理、相机控制、报告导出和模型激活尚未接入。
- `start-qsight.bat` 调用 `scripts/start-local.ps1`，同步依赖、构建前端、启动后端并打开前端预览。
- 协作者或 Agent 首次接手先阅读 `README.md`，按其中的环境、启动和验收步骤操作；不要为未接入的算法安装猜测的依赖。
- 用户稍后提供算法代码。在看到算法实际目录、依赖、输入输出和权重格式前，不得假设其接口，也不得重写算法实现。
- 当前前端使用六视角，计划书中的赛事算法基线使用五视角。视角数量必须作为产品/采集配方配置，不得继续在新代码中硬编码为固定值。

## 3. 总体架构

第一版采用本地模块化单体，不拆微服务：

```text
React 前端
    │ 本地 REST API / OpenAPI 契约
    ▼
FastAPI 本地后端
    ├── 质检任务与状态机
    ├── 采集控制与补拍策略
    ├── 推理编排与算法适配
    ├── 三态决策
    ├── 人工复核
    ├── 报告生成
    ├── 模型版本管理
    └── 审计与系统事件
         ├── SQLite：结构化业务数据
         ├── 本地文件系统：原图、异常图、报告和模型产物
         ├── 相机/旋转台等设备适配器
         └── PyTorch → ONNX → TensorRT 推理适配器
```

依赖方向必须保持单向：

```text
API → Application Services → Domain
                         ↑
Repositories / Device / Inference / Storage Adapters
```

领域层不得直接依赖 FastAPI、SQLite、相机 SDK、PyTorch、ONNX Runtime 或 TensorRT。

## 4. 仓库目录

```text
QSight/
├── AGENTS.md
├── frontend/
│   └── src/
│       ├── app/                  # 路由、Provider、应用启动和全局配置
│       ├── api/                  # OpenAPI 客户端、请求封装、轮询和错误映射
│       ├── components/           # 跨业务复用的展示组件
│       ├── features/
│       │   ├── inspections/      # 创建、采集、推理、补拍和人工复核
│       │   ├── history/          # 历史查询与追溯
│       │   ├── reports/          # 报告查看与导出
│       │   └── models/           # 模型版本、激活和回滚
│       ├── hooks/                # 通用 React hooks
│       ├── pages/                # 路由页面组合层
│       ├── stores/               # 跨页面客户端状态；服务端状态优先由请求层管理
│       ├── types/                # 前端专用类型；接口类型优先从契约生成
│       └── utils/                # 无业务副作用的工具函数
├── backend/
│   ├── app/
│   │   ├── api/v1/               # FastAPI 路由和 HTTP DTO
│   │   ├── core/                 # 配置、日志、错误码、生命周期和安全设置
│   │   ├── domain/               # 实体、值对象、状态机和仓储/适配器接口
│   │   ├── services/             # 创建、采集、推理、复核、报告等用例编排
│   │   ├── repositories/         # SQLite 仓储实现
│   │   ├── adapters/
│   │   │   ├── acquisition/      # 文件、相机和旋转台适配器
│   │   │   ├── inference/        # 算法、PyTorch、ONNX、TensorRT 适配器
│   │   │   ├── storage/          # 原图、异常图和模型产物存储
│   │   │   └── reporting/        # HTML/PDF 报告实现
│   │   └── db/migrations/        # SQLite schema 迁移
│   ├── tests/
│   │   ├── unit/                 # 领域、状态机和服务单元测试
│   │   └── integration/          # API、SQLite、文件与算法适配测试
│   └── runtime/                  # 本地运行数据，不提交业务图片和报告
│       ├── images/
│       ├── masks/
│       └── reports/
├── contracts/
│   ├── openapi/                  # OpenAPI 源文件或导出结果
│   └── examples/                 # 已脱敏的请求/响应样例
└── algorithms/                   # 用户提供的算法代码；接入前先审计结构和依赖
```

现有前端暂不整体搬迁。后续修改某个功能时，再将对应代码从 `App.tsx` 逐步迁入上述目录，禁止一次性重写全部前端。

## 5. 前端边界

- 页面和组件不得直接访问 SQLite、本地业务文件、相机 SDK 或算法模型。
- 所有业务数据经 `frontend/src/api/` 调用本地后端。
- 前端不得自行计算最终质检结论；只展示后端返回的模型结论、原因码和人工覆盖结论。
- 路由参数中的 inspection ID 是页面数据来源，不得继续依赖单个全局固定任务编号。
- 长任务必须使用 `request_id/job_id` 和状态轮询，不得用固定 `setTimeout` 假装推理完成。
- 加载、空数据、超时、设备离线、推理失败、存储失败、需要补拍和需要人工复核必须有独立界面状态。
- 原始模型结论和人工覆盖结论必须同时展示和保留。
- 列表使用后端分页、过滤和排序；报告和 CSV/PDF 由后端生成或提供下载地址。

## 6. 后端模块与状态机

一次质检使用以下主状态：

```text
CREATED
→ CAPTURING
→ READY
→ INFERENCING
→ DECIDED | RECAPTURE_REQUIRED | REVIEW_REQUIRED
→ CLOSED

任意阶段可进入 FAILED，但 FAILED 不得隐式跳转为 PASSED。
```

核心服务：

- `InspectionService`：创建任务、校验状态并编排流程。
- `AcquisitionService`：绑定工件、视角、设备和采集元数据。
- `InferenceService`：选择模型版本、调用推理适配器并保存结构化证据。
- `DecisionService`：输出正常、异常或复核三态以及原因码。
- `ReinspectionService`：执行有限次数补拍，次数超限后转人工复核。
- `ReviewService`：保存模型原结论和人工覆盖结论。
- `ReportService`：生成可追溯 HTML/PDF 报告。
- `ModelRegistryService`：登记、兼容性检查、激活和回滚模型版本。
- `AuditService`：追加记录设备、推理、动作、错误和用户操作事件。

## 7. 第一版 API 边界

基础接口按版本放在 `/api/v1`：

```text
POST /workpieces
POST /inspections
POST /inspections/{id}/capture
POST /inspections/{id}/infer
POST /inspections/{id}/recapture
POST /inspections/{id}/review
GET  /inspections/{id}
GET  /inspections
GET  /models
POST /models/activate
GET  /reports/{inspection_id}
```

统一响应至少包含：

- `request_id`
- `inspection_state`
- `data`
- `error_code`
- `message`

同步接口可以直接返回结果；采集、推理和报告生成等长任务返回 job 标识并由前端轮询。错误码必须区分参数、状态、设备、模型、存储和权限问题。

## 8. 数据与存储

SQLite 首版核心表：

- `products`
- `batches`
- `workpieces`
- `inspections`
- `inspection_views`
- `reviews`
- `model_versions`
- `system_events`

原图、异常图、报告和大型模型文件存本地文件系统，SQLite 只保存相对路径、SHA256、版本和结构化元数据。

文件写入先写临时文件并原子替换，成功后再提交数据库事务。禁止把真实工件图、模型权重、运行报告、数据库文件、密钥或企业数据提交到 Git。

## 9. 算法接入边界

用户提供算法后，先完成以下只读审计：

1. 运行环境、Python/PyTorch/CUDA 版本和第三方许可证。
2. 模型入口、checkpoint、配置、预处理和后处理。
3. 输入的视角数量、尺寸、顺序和缺失视角处理。
4. 输出的工件分数、视角分数、异常图和阈值含义。
5. CPU/GPU、显存、延迟、并发和异常行为。
6. 可复现命令、固定测试向量和产物 hash。

算法代码通过 `backend/app/adapters/inference/` 接入，后端业务层只依赖统一协议，不直接依赖某个模型目录。

目标推理协议应能逐步容纳：

```text
输入：inspection_id、images、view_ids、view_mask、model_version、metadata
输出：view_scores、anomaly_maps、quality_scores、view_weights、
      group_score、conflict、uncertainty、decision、reason_codes、runtime
```

在算法实际接口确认前，上述字段只是产品侧目标契约，不得伪造模型已经输出这些结果。

## 10. 开发顺序

1. 冻结视角配置和 OpenAPI 数据契约。
2. 实现 FastAPI 启动、配置、统一错误和健康检查。
3. 建立 SQLite 迁移、仓储和本地文件存储。
4. 打通“创建工件→创建质检→查询任务”的真实链路。
5. 将当前前端静态数据逐项替换为 API 数据。
6. 审计算法并实现推理适配器。
7. 打通采集/导入→推理→三态决策→补拍/复核→报告闭环。
8. 完成模型激活/回滚、审计、测试和一键启动整合。

每一步都必须保持现有可运行链路，不得为了目录整洁进行无关的大规模重构。

## 11. 仓库操作规则

- 没有用户明确命令，绝对不执行 `git push`。
- 修改代码前先理解当前项目结构和相关调用链。
- 每次只完成当前任务，不主动扩展无关功能。
- 不改动无关文件，不覆盖用户已有修改。
- 使用最小可行代码完成目标，禁止补丁式、重复式和相互绕过的实现。
- 新功能优先补充与风险相称的单元测试或集成测试。
- 所有界面状态必须来源明确；未接入的能力不得在代码、日志或展示材料中表述为已完成。
- 不提交密钥、企业数据、真实工件图片、模型权重、数据库和运行产物。


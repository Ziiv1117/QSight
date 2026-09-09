import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  DeploymentUnitOutlined,
  EyeOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LeftOutlined,
  MenuOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  ScanOutlined,
  ZoomInOutlined,
} from "@ant-design/icons";
import {
  Button,
  ConfigProvider,
  Drawer,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  createInspection,
  createWorkpiece,
  listInspections,
  QSightApiError,
  type InspectionState,
  type InspectionSummary,
} from "./api/client";

type ReviewDecision = "DEFECT" | "PASS" | "RECAPTURE";

type ReviewRecord = {
  decision: ReviewDecision;
  defectType: string;
  severity: string;
  note: string;
};

type ViewData = {
  id: string;
  name: string;
  englishName: string;
  camera: string;
  col: number;
  row: number;
  observation: string;
  needsReview?: boolean;
};

type InspectionContextValue = {
  taskId: string;
  setTaskId: (taskId: string) => void;
  review: ReviewRecord;
  setReview: (review: ReviewRecord) => void;
};

const TASK_ID = "QS-2026-0827-006";

const VIEWS: ViewData[] = [
  {
    id: "V-01",
    name: "正面",
    englishName: "FRONT",
    camera: "CAM-A",
    col: 0,
    row: 0,
    observation: "主孔与安装面完整入镜",
  },
  {
    id: "V-02",
    name: "左侧",
    englishName: "LEFT",
    camera: "CAM-B",
    col: 1,
    row: 0,
    observation: "上沿局部结构需复核",
    needsReview: true,
  },
  {
    id: "V-03",
    name: "右侧",
    englishName: "RIGHT",
    camera: "CAM-C",
    col: 2,
    row: 0,
    observation: "对应上沿区域可交叉比对",
  },
  {
    id: "V-04",
    name: "后面",
    englishName: "REAR",
    camera: "CAM-D",
    col: 0,
    row: 1,
    observation: "后侧加强筋与孔位可见",
  },
  {
    id: "V-05",
    name: "上面",
    englishName: "TOP",
    camera: "CAM-E",
    col: 1,
    row: 1,
    observation: "俯视轮廓用于位置校验",
  },
  {
    id: "V-06",
    name: "底面",
    englishName: "BOTTOM",
    camera: "CAM-F",
    col: 2,
    row: 1,
    observation: "底面孔位与轮廓完整",
  },
];

const InspectionContext = createContext<InspectionContextValue | null>(null);

function useInspection() {
  const context = useContext(InspectionContext);
  if (!context) throw new Error("InspectionContext is not available");
  return context;
}

function InspectionProvider({ children }: { children: ReactNode }) {
  const [taskId, setTaskIdState] = useState(
    () => window.sessionStorage.getItem("qsight.activeInspectionId") ?? TASK_ID,
  );
  const [review, setReview] = useState<ReviewRecord>({
    decision: "DEFECT",
    defectType: "EDGE_DAMAGE",
    severity: "MEDIUM",
    note: "上沿局部形态异常，建议拦截后复查实物。",
  });

  const setTaskId = (nextTaskId: string) => {
    window.sessionStorage.setItem("qsight.activeInspectionId", nextTaskId);
    setTaskIdState(nextTaskId);
  };

  return (
    <InspectionContext.Provider value={{ taskId, setTaskId, review, setReview }}>
      {children}
    </InspectionContext.Provider>
  );
}

const navItems = [
  { to: "/dashboard", label: "工作台", icon: <AppstoreOutlined /> },
  { to: "/inspections/new", label: "新建质检", icon: <PlusOutlined /> },
  { to: "/history", label: "记录追溯", icon: <HistoryOutlined /> },
  { to: "/models", label: "模型管理", icon: <DeploymentUnitOutlined /> },
];

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#245f69",
          colorText: "#171a1e",
          colorBorder: "#d4d8d3",
          borderRadius: 6,
          fontFamily:
            '"Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", sans-serif',
          controlHeight: 40,
        },
      }}
    >
      <InspectionProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/inspections/new" element={<NewInspectionPage />} />
              <Route
                path="/inspections/:id/capture"
                element={<CapturePage />}
              />
              <Route
                path="/inspections/:id/result"
                element={<ResultPage />}
              />
              <Route
                path="/inspections/:id/review"
                element={<ReviewPage />}
              />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/reports/:id" element={<ReportPage />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </InspectionProvider>
    </ConfigProvider>
  );
}

function AppShell() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  const currentLabel = useMemo(() => {
    if (location.pathname.includes("/capture")) return "六视角采集";
    if (location.pathname.includes("/result")) return "诊断结论";
    if (location.pathname.includes("/review")) return "人工复核";
    if (location.pathname.includes("/reports")) return "质检报告";
    return (
      navItems.find((item) => location.pathname.startsWith(item.to))?.label ??
      "质界智检"
    );
  }, [location.pathname]);

  const sidebar = (
    <div className="sidebar-inner">
      <NavLink to="/dashboard" className="brand" onClick={() => setMobileOpen(false)}>
        <span className="brand-mark" aria-hidden="true">
          Q
        </span>
        <span>
          <strong>质界智检</strong>
          <small>TRUSTED MULTI-VIEW</small>
        </span>
      </NavLink>

      <nav className="side-nav" aria-label="主导航">
        <p className="nav-eyebrow">WORKSPACE / 01</p>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <img
          className="company-logo"
          src="/images/qvalivision-logo.png"
          alt="质界智检公司标志"
        />
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">{sidebar}</aside>
      <Drawer
        className="mobile-drawer"
        placement="left"
        width={260}
        open={mobileOpen}
        closable={false}
        onClose={() => setMobileOpen(false)}
      >
        {sidebar}
      </Drawer>

      <div className="workspace">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu"
            aria-label="打开导航"
            onClick={() => setMobileOpen(true)}
          >
            <MenuOutlined />
          </button>
          <div className="topbar-title">
            <span>QS /</span> {currentLabel}
          </div>
          <div className="mode-badges" aria-label="系统运行状态">
            <span className="badge badge-primary">LOCAL NODE</span>
            <span className="badge">本地文件回放</span>
            <span className="badge badge-offline">
              <i /> 设备链路未连接
            </span>
          </div>
        </header>
        <div className="calibration-strip" aria-hidden="true">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
        <div className="content-area">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action && <div className="page-action">{action}</div>}
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const { taskId } = useInspection();

  return (
    <main className="page page-enter">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">OPERATOR DESK / 质检控制台</p>
          <h1>质界智检</h1>
          <p className="hero-tagline">
            六视角协同检测 · 像素级异常定位 · 工件级可信判断 · 全流程质量追溯
          </p>
          <p className="hero-description">
            使用同一铸件的正、侧、后、上、底六个视角，完成从图像回放到人工复核与报告归档的质检闭环。
          </p>
          <div className="hero-actions">
            <Button
              type="primary"
              size="large"
              icon={<ScanOutlined />}
              onClick={() => navigate(`/inspections/${taskId}/capture`)}
            >
              打开当前任务
            </Button>
            <Button size="large" onClick={() => navigate("/inspections/new")}>
              新建质检
            </Button>
          </div>
        </div>
        <div className="hero-specimen" aria-label="当前零件正面图">
          <PartView view={VIEWS[0]} quiet />
          <div className="specimen-label">
            <span>SPECIMEN</span>
            <strong>PUMP-HOUSING / A17</strong>
            <small>FILE REPLAY · 6 VIEWS</small>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel current-task">
          <div className="panel-head">
            <div>
              <p className="eyebrow">CURRENT RUN</p>
              <h2>当前质检任务</h2>
            </div>
            <span className="status-pill review">等待复核</span>
          </div>
          <dl className="task-facts">
            <div>
              <dt>工件编号</dt>
              <dd>{taskId}</dd>
            </div>
            <div>
              <dt>零件型号</dt>
              <dd>PUMP-HOUSING-A17</dd>
            </div>
            <div>
              <dt>输入来源</dt>
              <dd>本地六视角样例图</dd>
            </div>
            <div>
              <dt>真实推理</dt>
              <dd>未接入</dd>
            </div>
          </dl>
          <button
            type="button"
            className="text-action"
            onClick={() => navigate(`/inspections/${taskId}/result`)}
          >
            查看诊断页 <ArrowRightOutlined />
          </button>
        </article>

        <article className="panel workflow-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">SYSTEM STATUS</p>
              <h2>运行环境</h2>
            </div>
          </div>
          <div className="boundary-list">
            <div>
              <CheckCircleFilled />
              <span>
                <b>工作流</b> 六视角浏览、人工复核与报告归档已启用
              </span>
            </div>
            <div className="muted">
              <CloseCircleFilled />
              <span>
                <b>外部服务</b> 相机、推理服务、持久化数据库与 PDF 服务未连接
              </span>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

function NewInspectionPage() {
  const navigate = useNavigate();
  const { setTaskId } = useInspection();
  const [creating, setCreating] = useState(false);
  const suggestedSerial = useMemo(
    () => `WP-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`,
    [],
  );

  const createTask = async (values: {
    product: string;
    batch: string;
    serial: string;
    model: string;
  }) => {
    setCreating(true);
    try {
      const workpiece = await createWorkpiece({
        product_code: values.product,
        product_name: values.product,
        product_revision: "A",
        batch_code: values.batch,
        batch_source: "本地质检节点",
        serial_no: values.serial,
      });
      const inspection = await createInspection({
        workpiece_id: workpiece.workpiece_id,
        model_version_id: values.model,
        view_recipe: "SIX-VIEW-STANDARD",
        expected_view_count: VIEWS.length,
      });
      setTaskId(inspection.id);
      message.success("质检任务已保存到本地数据库");
      navigate(`/inspections/${inspection.id}/capture`);
    } catch (error) {
      message.error(
        error instanceof QSightApiError
          ? error.message
          : "质检任务创建失败，请检查本地服务",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="page page-enter narrow-page">
      <PageHeading
        eyebrow="INSPECTION / CREATE"
        title="新建质检任务"
        description="填写工件与批次信息。任务将保存到本地 SQLite，并进入多视角图像导入阶段。"
      />
      <section className="panel form-panel">
        <div className="form-index">FORM / 01</div>
        <Form
          layout="vertical"
          requiredMark={false}
          initialValues={{
            product: "PUMP-HOUSING-A17",
            batch: "BATCH-20260827-A",
            serial: suggestedSerial,
            model: "QS-REPLAY-RULESET",
          }}
          onFinish={createTask}
        >
          <div className="form-grid">
            <Form.Item label="零件型号" name="product">
              <Select
                options={[
                  { value: "PUMP-HOUSING-A17", label: "PUMP-HOUSING-A17" },
                  { value: "FLANGE-M08", label: "FLANGE-M08" },
                ]}
              />
            </Form.Item>
            <Form.Item label="生产批次" name="batch">
              <Input />
            </Form.Item>
            <Form.Item label="工件编号" name="serial">
              <Input />
            </Form.Item>
            <Form.Item label="检测配置" name="model">
              <Select
                options={[
                  { value: "QS-REPLAY-RULESET", label: "QS Replay Ruleset · 文件回放规则" },
                ]}
              />
            </Form.Item>
          </div>
          <div className="form-note">
            <SafetyCertificateOutlined />
            创建后进入本地图像导入流程；相机和推理适配器尚未接入。
          </div>
          <div className="form-actions">
            <Button onClick={() => navigate("/dashboard")}>取消</Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<ArrowRightOutlined />}
              loading={creating}
            >
              创建并进入六视角
            </Button>
          </div>
        </Form>
      </section>
    </main>
  );
}

function FlowRail({ current }: { current: 1 | 2 | 3 | 4 }) {
  const stages = ["创建任务", "六视角回放", "诊断与复核", "报告归档"];
  return (
    <div className="flow-rail" aria-label={`当前流程阶段：${stages[current - 1]}`}>
      {stages.map((stage, index) => (
        <div
          key={stage}
          className={`flow-step ${index + 1 < current ? "done" : ""} ${index + 1 === current ? "current" : ""}`}
        >
          <span className="flow-number">
            {index + 1 < current ? <CheckCircleFilled /> : `0${index + 1}`}
          </span>
          <span>{stage}</span>
        </div>
      ))}
    </div>
  );
}

function PartView({
  view,
  quiet = false,
}: {
  view: ViewData;
  quiet?: boolean;
}) {
  const imagePath = "/images/casting-six-view.png";
  return (
    <div
      className={`part-view ${view.needsReview && !quiet ? "part-view-review" : ""}`}
    >
      <img
        src={imagePath}
        alt={`同一铸件的${view.name}视角`}
        style={{ left: `-${view.col * 100}%`, top: `-${view.row * 100}%` }}
      />
      {!quiet && (
        <>
          <span className="frame-corner frame-corner-tl" />
          <span className="frame-corner frame-corner-tr" />
          <span className="frame-corner frame-corner-bl" />
          <span className="frame-corner frame-corner-br" />
          <span className="frame-id">{view.id}</span>
          <span className="frame-camera">{view.camera}</span>
        </>
      )}
      {view.needsReview && !quiet && (
        <span className="defect-target" aria-label="疑似缺陷位置">
          <i />
        </span>
      )}
    </div>
  );
}

function ViewCard({ view, onOpen }: { view: ViewData; onOpen: () => void }) {
  return (
    <article className={`view-card ${view.needsReview ? "view-card-review" : ""}`}>
      <button
        type="button"
        className="view-open"
        onClick={onOpen}
        aria-label={`放大查看${view.name}视角`}
      >
        <PartView view={view} />
        <span className="zoom-hint">
          <ZoomInOutlined /> 放大
        </span>
      </button>
      <div className="view-meta">
        <div>
          <span className="view-kicker">{view.englishName}</span>
          <h3>{view.name}视角</h3>
        </div>
        <span className={`view-state ${view.needsReview ? "review" : "ready"}`}>
          {view.needsReview ? "待复核" : "已载入"}
        </span>
      </div>
      <p>{view.observation}</p>
    </article>
  );
}

function CapturePage() {
  const navigate = useNavigate();
  const { taskId } = useInspection();
  const [selectedView, setSelectedView] = useState<ViewData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const openResult = () => {
    setAnalyzing(true);
    window.setTimeout(() => {
      setAnalyzing(false);
      navigate(`/inspections/${taskId}/result`);
    }, 1100);
  };

  return (
    <main className={`page page-enter ${analyzing ? "is-analyzing" : ""}`}>
      <PageHeading
        eyebrow={`INSPECTION / ${taskId}`}
        title="六视角文件回放"
        description="六张图片来自同一零件。点击任一视角可放大检查；橙色标记表示当前待复核区域。"
        action={
          <Button
            type="primary"
            size="large"
            icon={<ScanOutlined spin={analyzing} />}
            loading={analyzing}
            onClick={openResult}
          >
            {analyzing ? "整理视角证据" : "查看诊断结论"}
          </Button>
        }
      />
      <FlowRail current={2} />

      <div className="capture-notice">
        <span className="notice-index">NOTE / 01</span>
        <p>
          当前为静态样例图回放。没有相机状态、采集质量分数或模型置信度，界面不会伪装这些能力已经接入。
        </p>
      </div>

      <section className="view-grid" aria-label="六视角图像">
        {VIEWS.map((view) => (
          <ViewCard key={view.id} view={view} onOpen={() => setSelectedView(view)} />
        ))}
      </section>

      {analyzing && (
        <div className="analysis-overlay" aria-live="polite">
          <div className="analysis-line" />
          <span>VIEW FUSION · 整理六视角证据</span>
        </div>
      )}

      <Modal
        open={Boolean(selectedView)}
        footer={null}
        width={760}
        centered
        onCancel={() => setSelectedView(null)}
        title={
          selectedView
            ? `${selectedView.id} · ${selectedView.name}视角 / ${selectedView.englishName}`
            : "视角详情"
        }
      >
        {selectedView && (
          <div className="view-modal-content">
            <PartView view={selectedView} />
            <div>
              <span className="view-kicker">OBSERVATION</span>
              <p>{selectedView.observation}</p>
              <small>当前图像来自本地文件回放，不包含神经网络推理输出。</small>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}

function ResultPage() {
  const navigate = useNavigate();
  const { taskId } = useInspection();
  const focusView = VIEWS[1];

  return (
    <main className="page page-enter">
      <PageHeading
        eyebrow={`RESULT / ${taskId}`}
        title="诊断结论"
        description="当前结论由文件回放规则生成，用于组织人工复核；推理服务尚未返回神经网络模型输出。"
      />
      <FlowRail current={3} />

      <section className="result-layout">
        <article className="panel result-visual">
          <div className="result-image-wrap">
            <PartView view={focusView} />
          </div>
          <div className="image-caption">
            <span>{focusView.id}</span>
            <p>左侧视角 · 上沿疑似结构断点</p>
            <button type="button" onClick={() => navigate(`/inspections/${taskId}/capture`)}>
              <EyeOutlined /> 返回六视角比对
            </button>
          </div>
        </article>

        <article className="panel decision-panel">
          <span className="decision-code">REVIEW_REQUIRED</span>
          <div className="decision-mark">
            <span>!</span>
          </div>
          <h2>建议人工复核</h2>
          <p className="decision-lead">
            文件回放规则发现上沿局部形态不连续；该区域在多个对应角度可见，需要由操作员结合实物确认。
          </p>
          <div className="finding-list">
            <div>
              <span>重点视角</span>
              <b>V-02 / LEFT</b>
            </div>
            <div>
              <span>疑似类型</span>
              <b>上沿局部破损</b>
            </div>
            <div>
              <span>异常分数</span>
              <b className="pending">待真实模型接入</b>
            </div>
            <div>
              <span>质量评估</span>
              <b className="pending">待采集模块接入</b>
            </div>
          </div>
          <div className="decision-actions">
            <Button
              icon={<LeftOutlined />}
              onClick={() => navigate(`/inspections/${taskId}/capture`)}
            >
              返回检查
            </Button>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => navigate(`/inspections/${taskId}/review`)}
            >
              进入人工复核
            </Button>
          </div>
        </article>
      </section>
    </main>
  );
}

function ReviewPage() {
  const navigate = useNavigate();
  const { taskId, review, setReview } = useInspection();
  const [form] = Form.useForm<ReviewRecord>();

  const submit = (values: ReviewRecord) => {
    setReview(values);
    message.success("人工复核已记录到本地运行会话");
    navigate(`/reports/${taskId}`);
  };

  return (
    <main className="page page-enter narrow-page">
      <PageHeading
        eyebrow={`MANUAL REVIEW / ${taskId}`}
        title="人工复核"
        description="保留文件回放规则的原始结论，并记录操作员最终判断。当前数据保存在本地运行会话中。"
      />
      <FlowRail current={3} />

      <section className="review-layout">
        <article className="panel review-context">
          <PartView view={VIEWS[1]} />
          <div className="review-original">
            <p className="eyebrow">ORIGINAL DECISION</p>
            <span className="status-pill review">REVIEW_REQUIRED</span>
            <h3>上沿局部破损</h3>
            <p>文件回放规则结论，不含模型分数与尺寸估计。</p>
          </div>
        </article>

        <article className="panel review-form-panel">
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={review}
            onFinish={submit}
          >
            <Form.Item label="人工结论" name="decision">
              <Radio.Group className="decision-radio">
                <Radio.Button value="PASS">确认正常</Radio.Button>
                <Radio.Button value="DEFECT">确认缺陷</Radio.Button>
                <Radio.Button value="RECAPTURE">需要补拍</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <div className="form-grid">
              <Form.Item label="缺陷类型" name="defectType">
                <Select
                  options={[
                    { value: "EDGE_DAMAGE", label: "上沿局部破损" },
                    { value: "SCRATCH", label: "表面划痕" },
                    { value: "OTHER", label: "其他" },
                  ]}
                />
              </Form.Item>
              <Form.Item label="严重程度" name="severity">
                <Select
                  options={[
                    { value: "LOW", label: "轻微" },
                    { value: "MEDIUM", label: "中等" },
                    { value: "HIGH", label: "严重" },
                  ]}
                />
              </Form.Item>
            </div>
            <Form.Item label="复核意见" name="note">
              <Input.TextArea rows={4} maxLength={180} showCount />
            </Form.Item>
            <div className="form-actions">
              <Button onClick={() => navigate(`/inspections/${taskId}/result`)}>
                返回结论
              </Button>
              <Button type="primary" htmlType="submit" icon={<FileTextOutlined />}>
                保存并生成报告页
              </Button>
            </div>
          </Form>
        </article>
      </section>
    </main>
  );
}

const historyStates = [
  { state: "已完成", tone: "pass" },
  { state: "已拦截", tone: "defect" },
  { state: "待复核", tone: "review" },
  { state: "需补拍", tone: "recapture" },
] as const;

const historyParts = [
  "PUMP-HOUSING-A17",
  "FLANGE-M08",
  "VALVE-BODY-C12",
  "GEAR-COVER-R04",
] as const;

const seededHistoryRows = Array.from({ length: 20 }, (_, index) => {
  const recordedAt = new Date(
    Date.UTC(2026, 7, 27, 10, 32) - index * 17 * 60 * 1000,
  );
  const status = historyStates[index % historyStates.length];
  return {
    id: `QS-20260827-R${String(20 - index).padStart(3, "0")}`,
    part: historyParts[index % historyParts.length],
    source: "本地归档",
    state: status.state,
    time: recordedAt.toISOString().slice(0, 16).replace("T", " "),
    tone: status.tone,
  };
});

const historyRows = [
  {
    id: TASK_ID,
    part: "PUMP-HOUSING-A17",
    source: "本地六视角图",
    state: "待复核",
    time: "2026-08-27 10:40",
    tone: "review",
  },
  ...seededHistoryRows,
];

function HistoryPage() {
  const navigate = useNavigate();
  const { setTaskId } = useInspection();
  const [records, setRecords] = useState<InspectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listInspections()
      .then((page) => {
        if (!active) return;
        setRecords(page.items);
        setLoadError(null);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof QSightApiError
            ? error.message
            : "无法连接本地质检服务",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stateView: Record<
    InspectionState,
    { label: string; tone: "pass" | "defect" | "review" | "recapture" }
  > = {
    CREATED: { label: "已创建", tone: "review" },
    CAPTURING: { label: "采集中", tone: "recapture" },
    READY: { label: "待推理", tone: "review" },
    INFERENCING: { label: "推理中", tone: "review" },
    DECIDED: { label: "已判定", tone: "pass" },
    RECAPTURE_REQUIRED: { label: "需补拍", tone: "recapture" },
    REVIEW_REQUIRED: { label: "待复核", tone: "review" },
    CLOSED: { label: "已完成", tone: "pass" },
    FAILED: { label: "失败", tone: "defect" },
  };

  const openInspection = (record: InspectionSummary) => {
    setTaskId(record.id);
    if (["CREATED", "CAPTURING", "READY"].includes(record.state)) {
      navigate(`/inspections/${record.id}/capture`);
      return;
    }
    navigate(`/inspections/${record.id}/result`);
  };

  return (
    <main className="page page-enter">
      <PageHeading
        eyebrow="TRACEABILITY / LOCAL RECORDS"
        title="记录追溯"
        description="记录来自本地 SQLite，可查看任务状态、工件信息和已导入视角数量。"
        action={
          <Tooltip title="报告服务接入后开放">
            <Button disabled icon={<FileTextOutlined />}>
              导出 CSV
            </Button>
          </Tooltip>
        }
      />
      <section className="panel history-panel">
        <div className="history-summary">
          <span><b>{records.length}</b> 条记录</span>
          <span><i /> 本地数据库</span>
          <span>按时间倒序</span>
        </div>
        <div className="history-table" role="table" aria-label="质检追溯记录">
          <div className="history-row history-head" role="row">
            <span>工件编号</span>
            <span>零件型号</span>
            <span>视角进度</span>
            <span>最终状态</span>
            <span>时间</span>
            <span>操作</span>
          </div>
          {loading && <div className="history-table-status">正在读取本地记录…</div>}
          {!loading && loadError && (
            <div className="history-table-status error">{loadError}</div>
          )}
          {!loading && !loadError && records.length === 0 && (
            <div className="history-table-status">暂无质检记录，请先创建任务。</div>
          )}
          {!loading && !loadError && records.map((row) => {
            const status = stateView[row.state];
            return (
              <div className="history-row" role="row" key={row.id}>
                <strong>{row.id}</strong>
                <span>{row.product_code}</span>
                <span>{`${row.view_count}/${row.expected_view_count} 视角`}</span>
                <span>
                  <span className={`status-pill ${status.tone}`}>{status.label}</span>
                </span>
                <span className="mono-muted">
                  {new Date(row.created_at).toLocaleString("zh-CN", {
                    hour12: false,
                    timeZone: "Asia/Shanghai",
                  })}
                </span>
                <button
                  type="button"
                  className="text-action"
                  onClick={() => openInspection(row)}
                >
                  打开 <ArrowRightOutlined />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function ReportPage() {
  const navigate = useNavigate();
  const { taskId, review } = useInspection();
  const { id: routeId } = useParams();
  const reportId = routeId ?? taskId;
  const record = historyRows.find((row) => row.id === reportId);
  const isCurrentRecord = reportId === taskId;
  const historicDecision: ReviewDecision | "REVIEW" =
    record?.tone === "defect"
      ? "DEFECT"
      : record?.tone === "recapture"
        ? "RECAPTURE"
        : record?.tone === "review"
          ? "REVIEW"
          : "PASS";
  const decisionKey = isCurrentRecord ? review.decision : historicDecision;
  const decisionMap: Record<ReviewDecision | "REVIEW", { label: string; tone: string }> = {
    DEFECT: { label: "确认缺陷 / 拦截", tone: "defect" },
    PASS: { label: "确认正常 / 放行", tone: "pass" },
    RECAPTURE: { label: "需要补拍", tone: "recapture" },
    REVIEW: { label: "等待人工复核", tone: "review" },
  };
  const decision = decisionMap[decisionKey];
  const displayedPart = record?.part ?? "PUMP-HOUSING-A17";
  const displayedSource = record?.source ?? "本地六视角图";
  const displayedDefect = isCurrentRecord
    ? review.defectType
    : decisionKey === "PASS"
      ? "无"
      : "表面缺陷记录";
  const displayedSeverity = isCurrentRecord
    ? review.severity
    : decisionKey === "PASS"
      ? "无"
      : "未分级";
  const displayedNote = isCurrentRecord
    ? review.note
    : "该条目已进入本地质量追溯档案。";

  return (
    <main className="page page-enter report-page">
      <PageHeading
        eyebrow={`REPORT / ${reportId}`}
        title="质检报告"
        description="报告已汇总工件、视角、原始结论与人工覆盖结论。PDF 导出将在报告服务接入后开放。"
        action={
          <div className="report-actions">
            <Button onClick={() => navigate("/history")}>返回记录</Button>
            <Tooltip title="报告服务接入后开放">
              <Button type="primary" disabled icon={<FileTextOutlined />}>
                导出 PDF
              </Button>
            </Tooltip>
          </div>
        }
      />
      <FlowRail current={4} />

      <section className="report-sheet">
        <div className="report-stamp">QUALITY RECORD</div>
        <header className="report-head">
          <div>
            <span className="report-number">QS / INSPECTION RECORD</span>
            <h2>{reportId}</h2>
          </div>
          <span className={`status-pill large ${decision.tone}`}>
            {decision.label}
          </span>
        </header>

        <div className="report-sections">
          <section>
            <p className="eyebrow">01 / 工件信息</p>
            <dl className="report-facts">
              <div>
                <dt>零件型号</dt>
                <dd>{displayedPart}</dd>
              </div>
              <div>
                <dt>生产批次</dt>
                <dd>BATCH-20260827-A</dd>
              </div>
              <div>
                <dt>输入来源</dt>
                <dd>{displayedSource}</dd>
              </div>
            </dl>
          </section>

          <section>
            <p className="eyebrow">02 / 六视角证据</p>
            <div className="report-views">
              {VIEWS.map((view) => (
                <div key={view.id}>
                  <PartView view={view} quiet />
                  <span>{view.id}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="report-two-col">
            <div>
              <p className="eyebrow">03 / 原始规则结论</p>
              <dl className="report-facts compact">
                <div>
                  <dt>状态</dt>
                  <dd>REVIEW_REQUIRED</dd>
                </div>
                <div>
                  <dt>疑似区域</dt>
                  <dd>V-02 · 上沿局部</dd>
                </div>
                <div>
                  <dt>模型信息</dt>
                  <dd>未接入真实模型</dd>
                </div>
              </dl>
            </div>
            <div>
              <p className="eyebrow">04 / 人工复核</p>
              <dl className="report-facts compact">
                <div>
                  <dt>最终结论</dt>
                  <dd>{decision.label}</dd>
                </div>
                <div>
                  <dt>缺陷类型</dt>
                  <dd>{displayedDefect}</dd>
                </div>
                <div>
                  <dt>严重程度</dt>
                  <dd>{displayedSeverity}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="review-note">
            <p className="eyebrow">OPERATOR NOTE</p>
            <p>{displayedNote || "未填写复核意见。"}</p>
          </section>
        </div>
      </section>
    </main>
  );
}

function ModelsPage() {
  const modelRegistry = [
    {
      id: "DINOMALY2-B280",
      name: "Dinomaly2-B / 280",
      status: "证据已登记",
      tone: "ready",
      role: "第一版适配骨干",
      input: "计划书基线：5 视角 / 280",
      runtime: "DGX Spark GB10 · PyTorch",
      artifact: "100k step checkpoint 与完整推理日志",
      checkpoint: "待从算法仓库导入服务",
      threshold: "待企业样本冻结",
    },
    {
      id: "DINOMALY2-L448",
      name: "Dinomaly2-L / 448",
      status: "证据已登记",
      tone: "ready",
      role: "精度与容量上界",
      input: "计划书基线：5 视角 / 448",
      runtime: "DGX Spark GB10 · PyTorch",
      artifact: "完整推理产物与运行元数据",
      checkpoint: "待从算法仓库导入服务",
      threshold: "不作为首版边缘默认",
    },
    {
      id: "QS-MVAD-V0",
      name: "QS-MVAD / v0",
      status: "预配置",
      tone: "planned",
      role: "质量感知多视角主线",
      input: "images + view mask",
      runtime: "PyTorch → ONNX → TensorRT",
      artifact: "尚无可核验 checkpoint",
      checkpoint: "待研发产物生成",
      threshold: "待独立校准集冻结",
    },
  ];

  return (
    <main className="page page-enter">
      <PageHeading
        eyebrow="MODEL REGISTRY / VERSION GOVERNANCE"
        title="模型管理"
        description="按照计划书管理模型版本、运行设备、Checkpoint、配置与阈值。只有完成兼容性和回归验收的版本才能激活。"
      />
      <section className="registry-summary" aria-label="模型登记摘要">
        <div><span>REGISTRY</span><b>03</b><small>登记版本</small></div>
        <div><span>EVIDENCE</span><b>02</b><small>已有工程产物</small></div>
        <div><span>SERVICE</span><b>00</b><small>已接入推理服务</small></div>
        <div><span>ACTIVE</span><b>00</b><small>通过激活验收</small></div>
      </section>

      <section className="model-registry-list">
        {modelRegistry.map((model) => (
          <article className="panel registry-card" key={model.id}>
            <div className="registry-card-title">
              <div>
                <span>{model.id}</span>
                <h2>{model.name}</h2>
              </div>
              <Tag color={model.tone === "ready" ? "cyan" : "gold"}>
                {model.status}
              </Tag>
            </div>
            <p className="registry-role">{model.role}</p>
            <dl className="registry-fields">
              <div><dt>输入契约</dt><dd>{model.input}</dd></div>
              <div><dt>运行路线</dt><dd>{model.runtime}</dd></div>
              <div><dt>计划书证据</dt><dd>{model.artifact}</dd></div>
              <div><dt>Checkpoint / Hash</dt><dd>{model.checkpoint}</dd></div>
              <div><dt>阈值版本</dt><dd>{model.threshold}</dd></div>
            </dl>
            <Tooltip title="当前 QSight 推理服务未连接，不能执行激活操作">
              <Button disabled block>
                未满足激活门槛
              </Button>
            </Tooltip>
          </article>
        ))}
      </section>

      <section className="model-governance">
        <article className="panel governance-card">
          <p className="eyebrow">ACTIVATION POLICY</p>
          <h2>激活与回滚门槛</h2>
          <ol>
            <li><span>01</span>登记 commit、checkpoint/config hash 与阈值版本</li>
            <li><span>02</span>完成目标设备兼容性和固定基准向量回归</li>
            <li><span>03</span>保存激活时间、操作记录与上一稳定版本</li>
            <li><span>04</span>推理或存储失败时保持非放行状态</li>
          </ol>
        </article>
        <article className="panel governance-card pipeline-card">
          <p className="eyebrow">DEPLOYMENT PIPELINE</p>
          <h2>部署路线</h2>
          <div className="deployment-pipeline">
            <span className="pipeline-ready">PyTorch 基准</span>
            <ArrowRightOutlined />
            <span>ONNX 对齐</span>
            <ArrowRightOutlined />
            <span>TensorRT FP16</span>
            <ArrowRightOutlined />
            <span>Jetson / 工控机</span>
          </div>
          <p>每一级必须通过输出一致性与回归门，失败则回退上一稳定运行方式。</p>
        </article>
      </section>
    </main>
  );
}

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <main className="page empty-state page-enter">
      <span>404 / ROUTE NOT FOUND</span>
      <h1>未找到对应的系统页面。</h1>
      <p>返回工作台，或从左侧导航重新选择入口。</p>
      <Button type="primary" onClick={() => navigate("/dashboard")}>
        返回工作台
      </Button>
    </main>
  );
}

export default App;

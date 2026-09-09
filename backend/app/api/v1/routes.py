from fastapi import APIRouter, File, Form, Query, Request, UploadFile

from app.api.v1.schemas import ApiEnvelope, InspectionCreate, WorkpieceCreate
from app.domain.states import InspectionState


router = APIRouter()


def success(
    request: Request,
    data: object,
    message: str,
    inspection_state: str | None = None,
) -> dict:
    return {
        "request_id": request.state.request_id,
        "inspection_state": inspection_state,
        "data": data,
        "error_code": None,
        "message": message,
    }


@router.get("/health", response_model=ApiEnvelope, tags=["system"])
def health(request: Request) -> dict:
    database_ok = request.app.state.database.ping()
    settings = request.app.state.settings
    return success(
        request,
        {
            "service": "qsight-backend",
            "database": "ready" if database_ok else "unavailable",
            "storage": "ready" if settings.image_dir.exists() else "unavailable",
            "inference": "not_configured",
            "acquisition": "file_adapter_ready",
        },
        "本地服务运行正常",
    )


@router.post(
    "/workpieces",
    response_model=ApiEnvelope,
    status_code=201,
    tags=["workpieces"],
)
def create_workpiece(payload: WorkpieceCreate, request: Request) -> dict:
    data = request.app.state.inspection_service.create_workpiece(
        payload.model_dump()
    )
    return success(request, data, "工件已登记")


@router.post(
    "/inspections",
    response_model=ApiEnvelope,
    status_code=201,
    tags=["inspections"],
)
def create_inspection(payload: InspectionCreate, request: Request) -> dict:
    data = request.app.state.inspection_service.create_inspection(
        payload.model_dump()
    )
    return success(request, data, "质检任务已创建", data["state"])


@router.get(
    "/inspections/{inspection_id}",
    response_model=ApiEnvelope,
    tags=["inspections"],
)
def get_inspection(inspection_id: str, request: Request) -> dict:
    data = request.app.state.inspection_service.get_inspection(inspection_id)
    return success(request, data, "质检任务查询成功", data["state"])


@router.get(
    "/inspections",
    response_model=ApiEnvelope,
    tags=["inspections"],
)
def list_inspections(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    state: InspectionState | None = Query(default=None),
    product_code: str | None = Query(default=None, max_length=80),
) -> dict:
    data = request.app.state.inspection_service.list_inspections(
        page=page,
        page_size=page_size,
        state=state.value if state else None,
        product_code=product_code,
    )
    return success(request, data, "质检记录查询成功")


@router.post(
    "/inspections/{inspection_id}/capture",
    response_model=ApiEnvelope,
    tags=["acquisition"],
)
async def import_view(
    inspection_id: str,
    request: Request,
    view_id: str = Form(min_length=1, max_length=32),
    view_name: str | None = Form(default=None, max_length=80),
    image: UploadFile = File(),
) -> dict:
    settings = request.app.state.settings
    content = await image.read(settings.max_upload_bytes + 1)
    data = request.app.state.inspection_service.import_view(
        inspection_id=inspection_id,
        view_id=view_id,
        view_name=view_name,
        content=content,
    )
    return success(
        request,
        data,
        f"视角 {view_id} 已导入",
        data["state"],
    )


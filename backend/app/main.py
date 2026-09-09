from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.adapters.acquisition.file_adapter import FileAcquisitionAdapter
from app.api.v1.routes import router as api_v1_router
from app.core.config import Settings
from app.core.errors import AppError
from app.db.database import Database
from app.repositories.sqlite_repository import SQLiteRepository
from app.services.inspection_service import InspectionService


logger = logging.getLogger("qsight")


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        resolved_settings.ensure_directories()
        database = Database(resolved_settings.database_path)
        database.initialize()
        repository = SQLiteRepository(database)
        acquisition = FileAcquisitionAdapter(
            resolved_settings.image_dir,
            resolved_settings.max_upload_bytes,
        )
        app.state.settings = resolved_settings
        app.state.database = database
        app.state.inspection_service = InspectionService(
            repository,
            acquisition,
        )
        yield

    app = FastAPI(
        title="QSight Local API",
        version="1.0.0",
        description="质界智检本地任务、追溯与文件采集接口",
        lifespan=lifespan,
    )
    app.state.settings = resolved_settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:4173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://localhost:5173",
        ],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request.state.request_id = request.headers.get(
            "X-Request-ID", f"REQ-{uuid4().hex[:16].upper()}"
        )
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "request_id": request.state.request_id,
                "inspection_state": exc.inspection_state,
                "data": None,
                "error_code": exc.error_code,
                "message": exc.message,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ):
        return JSONResponse(
            status_code=422,
            content={
                "request_id": request.state.request_id,
                "inspection_state": None,
                "data": {"errors": exc.errors()},
                "error_code": "VALIDATION_ERROR",
                "message": "请求参数校验失败",
            },
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception):
        logger.exception("Unhandled request error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={
                "request_id": request.state.request_id,
                "inspection_state": None,
                "data": None,
                "error_code": "INTERNAL_ERROR",
                "message": "本地服务处理失败",
            },
        )

    app.include_router(api_v1_router, prefix="/api/v1")
    return app


app = create_app()


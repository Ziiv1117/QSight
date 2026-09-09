from __future__ import annotations

from app.adapters.acquisition.file_adapter import FileAcquisitionAdapter
from app.repositories.sqlite_repository import SQLiteRepository


class InspectionService:
    def __init__(
        self,
        repository: SQLiteRepository,
        acquisition: FileAcquisitionAdapter,
    ) -> None:
        self.repository = repository
        self.acquisition = acquisition

    def create_workpiece(self, payload: dict) -> dict:
        return self.repository.create_workpiece(payload)

    def create_inspection(self, payload: dict) -> dict:
        return self.repository.create_inspection(payload)

    def get_inspection(self, inspection_id: str) -> dict:
        return self.repository.get_inspection(inspection_id)

    def list_inspections(
        self,
        page: int,
        page_size: int,
        state: str | None,
        product_code: str | None,
    ) -> dict:
        return self.repository.list_inspections(
            page=page,
            page_size=page_size,
            state=state,
            product_code=product_code,
        )

    def import_view(
        self,
        inspection_id: str,
        view_id: str,
        view_name: str | None,
        content: bytes,
    ) -> dict:
        stored = self.acquisition.store_image(
            inspection_id=inspection_id,
            view_id=view_id,
            content=content,
        )
        return self.repository.save_view(
            inspection_id,
            {
                "view_id": view_id,
                "view_name": view_name,
                "image_path": stored.image_path,
                "sha256": stored.sha256,
                "mime_type": stored.mime_type,
                "width": stored.width,
                "height": stored.height,
            },
        )


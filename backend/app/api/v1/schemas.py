from typing import Any

from pydantic import BaseModel, Field


class ApiEnvelope(BaseModel):
    request_id: str
    inspection_state: str | None = None
    data: Any | None = None
    error_code: str | None = None
    message: str


class WorkpieceCreate(BaseModel):
    product_code: str = Field(min_length=1, max_length=80)
    product_name: str = Field(min_length=1, max_length=120)
    product_revision: str = Field(default="A", min_length=1, max_length=40)
    batch_code: str = Field(min_length=1, max_length=80)
    batch_source: str | None = Field(default=None, max_length=200)
    serial_no: str = Field(min_length=1, max_length=120)


class InspectionCreate(BaseModel):
    workpiece_id: str = Field(min_length=1, max_length=80)
    model_version_id: str | None = Field(default=None, max_length=120)
    view_recipe: str = Field(min_length=1, max_length=120)
    expected_view_count: int = Field(default=6, ge=1, le=32)


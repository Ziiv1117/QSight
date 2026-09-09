from __future__ import annotations

from base64 import b64decode

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


PNG_1X1 = b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def test_create_list_and_import_views(tmp_path):
    runtime_dir = tmp_path / "runtime"
    settings = Settings(
        runtime_dir=runtime_dir,
        database_path=runtime_dir / "test.sqlite3",
        image_dir=runtime_dir / "images",
    )
    app = create_app(settings)

    with TestClient(app) as client:
        health = client.get("/api/v1/health")
        assert health.status_code == 200
        assert health.json()["data"]["database"] == "ready"

        workpiece = client.post(
            "/api/v1/workpieces",
            json={
                "product_code": "PUMP-HOUSING-A17",
                "product_name": "Pump Housing A17",
                "product_revision": "A",
                "batch_code": "BATCH-001",
                "batch_source": "integration-test",
                "serial_no": "WP-001",
            },
        )
        assert workpiece.status_code == 201
        workpiece_id = workpiece.json()["data"]["workpiece_id"]

        inspection = client.post(
            "/api/v1/inspections",
            json={
                "workpiece_id": workpiece_id,
                "model_version_id": None,
                "view_recipe": "TWO-VIEW-TEST",
                "expected_view_count": 2,
            },
        )
        assert inspection.status_code == 201
        inspection_id = inspection.json()["data"]["id"]
        assert inspection.json()["inspection_state"] == "CREATED"

        first_view = client.post(
            f"/api/v1/inspections/{inspection_id}/capture",
            data={"view_id": "V-01", "view_name": "正面"},
            files={"image": ("front.png", PNG_1X1, "image/png")},
        )
        assert first_view.status_code == 200
        assert first_view.json()["inspection_state"] == "CAPTURING"

        second_view = client.post(
            f"/api/v1/inspections/{inspection_id}/capture",
            data={"view_id": "V-02", "view_name": "侧面"},
            files={"image": ("side.png", PNG_1X1, "image/png")},
        )
        assert second_view.status_code == 200
        assert second_view.json()["inspection_state"] == "READY"
        assert second_view.json()["data"]["view_count"] == 2

        records = client.get("/api/v1/inspections?page=1&page_size=20")
        assert records.status_code == 200
        assert records.json()["data"]["total"] == 1
        assert records.json()["data"]["items"][0]["id"] == inspection_id


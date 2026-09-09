from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.core.errors import ConflictError, NotFoundError
from app.db.database import Database
from app.domain.states import InspectionState, ensure_transition


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12].upper()}"


class SQLiteRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def create_workpiece(self, payload: dict) -> dict:
        now = utc_now()
        with self.database.connect() as connection:
            product = connection.execute(
                "SELECT * FROM products WHERE code = ?",
                (payload["product_code"],),
            ).fetchone()
            if product is None:
                product_id = new_id("PRD")
                connection.execute(
                    """
                    INSERT INTO products(id, code, name, revision, status, created_at)
                    VALUES (?, ?, ?, ?, 'ACTIVE', ?)
                    """,
                    (
                        product_id,
                        payload["product_code"],
                        payload["product_name"],
                        payload["product_revision"],
                        now,
                    ),
                )
            else:
                product_id = product["id"]

            batch = connection.execute(
                "SELECT * FROM batches WHERE product_id = ? AND batch_code = ?",
                (product_id, payload["batch_code"]),
            ).fetchone()
            if batch is None:
                batch_id = new_id("BAT")
                connection.execute(
                    """
                    INSERT INTO batches(id, product_id, batch_code, source, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        batch_id,
                        product_id,
                        payload["batch_code"],
                        payload.get("batch_source"),
                        now,
                    ),
                )
            else:
                batch_id = batch["id"]

            duplicate = connection.execute(
                "SELECT id FROM workpieces WHERE serial_no = ?",
                (payload["serial_no"],),
            ).fetchone()
            if duplicate is not None:
                raise ConflictError(f"工件编号 {payload['serial_no']} 已存在")

            workpiece_id = new_id("WP")
            connection.execute(
                """
                INSERT INTO workpieces(id, batch_id, serial_no, state, created_at)
                VALUES (?, ?, ?, 'REGISTERED', ?)
                """,
                (workpiece_id, batch_id, payload["serial_no"], now),
            )
            return {
                "workpiece_id": workpiece_id,
                "product_id": product_id,
                "batch_id": batch_id,
                "product_code": payload["product_code"],
                "batch_code": payload["batch_code"],
                "serial_no": payload["serial_no"],
                "created_at": now,
            }

    def create_inspection(self, payload: dict) -> dict:
        now = utc_now()
        with self.database.connect() as connection:
            workpiece = connection.execute(
                "SELECT id FROM workpieces WHERE id = ?",
                (payload["workpiece_id"],),
            ).fetchone()
            if workpiece is None:
                raise NotFoundError("工件不存在")

            inspection_id = new_id("QS")
            connection.execute(
                """
                INSERT INTO inspections(
                    id, workpiece_id, model_version_id, view_recipe,
                    expected_view_count, state, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    inspection_id,
                    payload["workpiece_id"],
                    payload.get("model_version_id"),
                    payload["view_recipe"],
                    payload["expected_view_count"],
                    InspectionState.CREATED.value,
                    now,
                    now,
                ),
            )
            connection.execute(
                """
                INSERT INTO system_events(
                    inspection_id, level, component, event_code, message, created_at
                ) VALUES (?, 'INFO', 'inspection', 'INSPECTION_CREATED', ?, ?)
                """,
                (inspection_id, "质检任务已创建", now),
            )
        return self.get_inspection(inspection_id)

    def get_inspection(self, inspection_id: str) -> dict:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT
                    i.*, w.serial_no, b.batch_code, b.source AS batch_source,
                    p.code AS product_code, p.name AS product_name,
                    COUNT(v.id) AS view_count
                FROM inspections i
                JOIN workpieces w ON w.id = i.workpiece_id
                JOIN batches b ON b.id = w.batch_id
                JOIN products p ON p.id = b.product_id
                LEFT JOIN inspection_views v ON v.inspection_id = i.id
                WHERE i.id = ?
                GROUP BY i.id
                """,
                (inspection_id,),
            ).fetchone()
            if row is None:
                raise NotFoundError("质检任务不存在")
            result = dict(row)
            views = connection.execute(
                """
                SELECT view_id, view_name, image_path, sha256, mime_type,
                       width, height, created_at
                FROM inspection_views
                WHERE inspection_id = ?
                ORDER BY view_id
                """,
                (inspection_id,),
            ).fetchall()
            result["views"] = [dict(view) for view in views]
            return result

    def list_inspections(
        self,
        page: int,
        page_size: int,
        state: str | None = None,
        product_code: str | None = None,
    ) -> dict:
        filters: list[str] = []
        params: list[object] = []
        if state:
            filters.append("i.state = ?")
            params.append(state)
        if product_code:
            filters.append("p.code = ?")
            params.append(product_code)
        where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
        offset = (page - 1) * page_size

        with self.database.connect() as connection:
            total = connection.execute(
                f"""
                SELECT COUNT(*)
                FROM inspections i
                JOIN workpieces w ON w.id = i.workpiece_id
                JOIN batches b ON b.id = w.batch_id
                JOIN products p ON p.id = b.product_id
                {where_sql}
                """,
                params,
            ).fetchone()[0]
            rows = connection.execute(
                f"""
                SELECT
                    i.id, i.state, i.decision, i.view_recipe,
                    i.expected_view_count, i.model_version_id,
                    i.created_at, i.updated_at,
                    w.serial_no, b.batch_code, p.code AS product_code,
                    COUNT(v.id) AS view_count
                FROM inspections i
                JOIN workpieces w ON w.id = i.workpiece_id
                JOIN batches b ON b.id = w.batch_id
                JOIN products p ON p.id = b.product_id
                LEFT JOIN inspection_views v ON v.inspection_id = i.id
                {where_sql}
                GROUP BY i.id
                ORDER BY i.created_at DESC
                LIMIT ? OFFSET ?
                """,
                [*params, page_size, offset],
            ).fetchall()
            return {
                "items": [dict(row) for row in rows],
                "page": page,
                "page_size": page_size,
                "total": total,
            }

    def save_view(self, inspection_id: str, view: dict) -> dict:
        now = utc_now()
        with self.database.connect() as connection:
            inspection = connection.execute(
                "SELECT state, expected_view_count FROM inspections WHERE id = ?",
                (inspection_id,),
            ).fetchone()
            if inspection is None:
                raise NotFoundError("质检任务不存在")
            if inspection["state"] not in {
                InspectionState.CREATED.value,
                InspectionState.CAPTURING.value,
                InspectionState.READY.value,
            }:
                raise ConflictError(
                    "当前任务状态不允许导入视角图片",
                    inspection["state"],
                )

            state_before_result = inspection["state"]
            if state_before_result == InspectionState.CREATED.value:
                ensure_transition(state_before_result, InspectionState.CAPTURING)
                state_before_result = InspectionState.CAPTURING.value
            connection.execute(
                """
                INSERT INTO inspection_views(
                    id, inspection_id, view_id, view_name, image_path,
                    sha256, mime_type, width, height, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(inspection_id, view_id) DO UPDATE SET
                    view_name = excluded.view_name,
                    image_path = excluded.image_path,
                    sha256 = excluded.sha256,
                    mime_type = excluded.mime_type,
                    width = excluded.width,
                    height = excluded.height,
                    created_at = excluded.created_at
                """,
                (
                    new_id("VIEW"),
                    inspection_id,
                    view["view_id"],
                    view.get("view_name"),
                    view["image_path"],
                    view["sha256"],
                    view["mime_type"],
                    view["width"],
                    view["height"],
                    now,
                ),
            )
            view_count = connection.execute(
                "SELECT COUNT(*) FROM inspection_views WHERE inspection_id = ?",
                (inspection_id,),
            ).fetchone()[0]
            target_state = (
                InspectionState.READY
                if view_count >= inspection["expected_view_count"]
                else InspectionState.CAPTURING
            )
            if state_before_result != target_state.value:
                ensure_transition(state_before_result, target_state)
            connection.execute(
                "UPDATE inspections SET state = ?, updated_at = ? WHERE id = ?",
                (target_state.value, now, inspection_id),
            )
            connection.execute(
                """
                INSERT INTO system_events(
                    inspection_id, level, component, event_code, message, created_at
                ) VALUES (?, 'INFO', 'acquisition', 'VIEW_IMPORTED', ?, ?)
                """,
                (
                    inspection_id,
                    f"视角 {view['view_id']} 已导入，当前 {view_count}/{inspection['expected_view_count']}",
                    now,
                ),
            )
        return self.get_inspection(inspection_id)

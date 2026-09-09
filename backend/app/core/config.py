from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


BACKEND_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    runtime_dir: Path
    database_path: Path
    image_dir: Path
    max_upload_bytes: int = 20 * 1024 * 1024

    @classmethod
    def from_env(cls) -> "Settings":
        runtime_dir = Path(
            os.environ.get("QSIGHT_RUNTIME_DIR", BACKEND_ROOT / "runtime")
        ).resolve()
        database_path = Path(
            os.environ.get("QSIGHT_DB_PATH", runtime_dir / "qsight.sqlite3")
        ).resolve()
        image_dir = Path(
            os.environ.get("QSIGHT_IMAGE_DIR", runtime_dir / "images")
        ).resolve()
        return cls(
            runtime_dir=runtime_dir,
            database_path=database_path,
            image_dir=image_dir,
        )

    def ensure_directories(self) -> None:
        self.runtime_dir.mkdir(parents=True, exist_ok=True)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self.image_dir.mkdir(parents=True, exist_ok=True)


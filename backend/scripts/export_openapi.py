from __future__ import annotations

import json
from pathlib import Path
import sys


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app  # noqa: E402


output_path = PROJECT_ROOT / "contracts" / "openapi" / "qsight-v1.json"
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(
    json.dumps(app.openapi(), ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(output_path)


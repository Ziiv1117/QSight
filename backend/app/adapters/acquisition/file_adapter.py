from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import os
import re
import tempfile

from PIL import Image, UnidentifiedImageError

from app.core.errors import InvalidImageError


VIEW_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
FORMAT_MAP = {
    "PNG": (".png", "image/png"),
    "JPEG": (".jpg", "image/jpeg"),
    "WEBP": (".webp", "image/webp"),
}


@dataclass(frozen=True)
class StoredImage:
    image_path: str
    sha256: str
    mime_type: str
    width: int
    height: int


class FileAcquisitionAdapter:
    def __init__(self, image_root: Path, max_upload_bytes: int) -> None:
        self.image_root = image_root.resolve()
        self.max_upload_bytes = max_upload_bytes
        self.image_root.mkdir(parents=True, exist_ok=True)

    def store_image(
        self,
        inspection_id: str,
        view_id: str,
        content: bytes,
    ) -> StoredImage:
        if not VIEW_ID_PATTERN.fullmatch(view_id):
            raise InvalidImageError("视角编号只能包含字母、数字、下划线和短横线")
        if not content:
            raise InvalidImageError("上传图片不能为空")
        if len(content) > self.max_upload_bytes:
            raise InvalidImageError("单张图片不能超过20MB")

        try:
            with Image.open(BytesIO(content)) as image:
                image.verify()
            with Image.open(BytesIO(content)) as image:
                image_format = image.format
                width, height = image.size
        except (UnidentifiedImageError, OSError) as exc:
            raise InvalidImageError("文件不是可读取的PNG、JPEG或WEBP图片") from exc

        if image_format not in FORMAT_MAP:
            raise InvalidImageError("仅支持PNG、JPEG和WEBP图片")
        extension, mime_type = FORMAT_MAP[image_format]
        digest = sha256(content).hexdigest()
        inspection_dir = (self.image_root / inspection_id).resolve()
        if self.image_root not in inspection_dir.parents:
            raise InvalidImageError("质检任务编号不合法")
        inspection_dir.mkdir(parents=True, exist_ok=True)
        destination = inspection_dir / f"{view_id}-{digest[:12]}{extension}"

        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="wb",
                dir=inspection_dir,
                prefix=".upload-",
                suffix=".tmp",
                delete=False,
            ) as temporary:
                temporary.write(content)
                temporary.flush()
                os.fsync(temporary.fileno())
                temporary_path = Path(temporary.name)
            os.replace(temporary_path, destination)
        finally:
            if temporary_path and temporary_path.exists():
                temporary_path.unlink()

        return StoredImage(
            image_path=destination.relative_to(self.image_root.parent).as_posix(),
            sha256=digest,
            mime_type=mime_type,
            width=width,
            height=height,
        )


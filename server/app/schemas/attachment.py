from app.schemas.common import Timestamped, UUIDStr


class AttachmentRead(Timestamped):
    item_id: UUIDStr
    file_name: str
    original_name: str
    file_path: str
    mime_type: str | None = None
    size_bytes: int | None = None
    attachment_type: str | None = None

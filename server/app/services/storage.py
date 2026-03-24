import os
import uuid
from pathlib import Path

from fastapi import UploadFile
from supabase import Client, create_client

from app.core.config import get_settings

settings = get_settings()


def _get_supabase_client() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase URL/service role key are missing in environment.")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


async def save_upload(file: UploadFile, series_number: str, *, content: bytes | None = None) -> dict:
    extension = Path(file.filename or "").suffix
    generated_name = f"{uuid.uuid4().hex}{extension}"
    relative_path = f"{series_number}/{generated_name}"
    data = content if content is not None else await file.read()

    if settings.storage_backend == "supabase":
        client = _get_supabase_client()
        client.storage.from_(settings.supabase_storage_bucket).upload(
            path=relative_path,
            file=data,
            file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "false"},
        )
        path = relative_path
    else:
        base_dir = Path(settings.local_upload_dir)
        os.makedirs(base_dir / series_number, exist_ok=True)
        destination = base_dir / series_number / generated_name
        with destination.open("wb") as out:
            out.write(data)
        path = str(destination)

    return {
        "file_name": generated_name,
        "original_name": file.filename or generated_name,
        "file_path": path,
        "mime_type": file.content_type,
    }

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.attachment import Attachment
from app.models.correspondence_item import CorrespondenceItem
from app.models.document_text import DocumentText
from app.models.series import Series
from app.models.user import User
from app.schemas.attachment import AttachmentRead
from app.services.audit import log_audit
from app.services.document_extraction import extract_text_from_file
from app.services.response_cache import invalidate_response_cache
from app.services.storage import save_upload

router = APIRouter(prefix="/series/{series_id}/items/{item_id}/attachments", tags=["attachments"])


@router.get("", response_model=list[AttachmentRead])
async def list_attachments(
    series_id: str,
    item_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AttachmentRead]:
    result = await db.execute(
        select(Attachment)
        .join(CorrespondenceItem, CorrespondenceItem.id == Attachment.item_id)
        .where(and_(Attachment.item_id == item_id, CorrespondenceItem.series_id == series_id))
        .order_by(Attachment.created_at.desc())
    )
    return [AttachmentRead.model_validate(row) for row in result.scalars().all()]


@router.post("", response_model=list[AttachmentRead], status_code=status.HTTP_201_CREATED)
async def upload_attachments(
    series_id: str,
    item_id: str,
    files: list[UploadFile] = File(...),
    attachment_type: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AttachmentRead]:
    series_result = await db.execute(select(Series).where(Series.id == series_id))
    series = series_result.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Series not found.")

    item_result = await db.execute(select(CorrespondenceItem).where(CorrespondenceItem.id == item_id, CorrespondenceItem.series_id == series_id))
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")

    created_rows: list[Attachment] = []
    for file in files:
        file_content = await file.read()
        stored = await save_upload(file, series.series_number, content=file_content)
        row = Attachment(
            item_id=item_id,
            file_name=stored["file_name"],
            original_name=stored["original_name"],
            file_path=stored["file_path"],
            mime_type=stored["mime_type"],
            attachment_type=attachment_type,
        )
        db.add(row)
        await db.flush()
        extraction = extract_text_from_file(row.original_name, row.mime_type, file_content)
        db.add(
            DocumentText(
                attachment_id=row.id,
                item_id=item.id,
                source_type=extraction.source_type,
                extraction_status=extraction.status,
                extracted_text=extraction.text,
                extraction_error=extraction.error,
            )
        )
        created_rows.append(row)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        action="attachment.uploaded",
        entity="attachment",
        entity_id=str(item_id),
        description=f"{len(created_rows)} attachment(s) uploaded",
    )
    await db.commit()
    await invalidate_response_cache([f"series:items:{series_id}", f"series:get:{series_id}", "series:list:", "dashboard:"])

    for row in created_rows:
        await db.refresh(row)
    return [AttachmentRead.model_validate(row) for row in created_rows]

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.attachment import Attachment
from app.models.correspondence_item import CorrespondenceItem
from app.models.document_text import DocumentText
from app.models.enums import Direction, OutgoingItemStatus
from app.schemas.ai import AIDraftRequest
from app.services.gemini import GeminiError, generate_json, generate_text


@dataclass
class ItemContext:
    item: CorrespondenceItem
    extracted_text: str
    attachment_names: list[str]


def _fmt_date(value: datetime | None) -> str:
    if not value:
        return "-"
    return value.strftime("%d %b %Y")


def _truncate(text: str, size: int = 8000) -> str:
    text = text.strip()
    return text[:size]


def _normalize(text: str | None) -> str:
    if not text:
        return ""
    return " ".join(text.replace("\r", " ").replace("\n", " ").split())


async def _load_item_map(db: AsyncSession, series_id: uuid.UUID) -> list[CorrespondenceItem]:
    result = await db.execute(
        select(CorrespondenceItem)
        .where(CorrespondenceItem.series_id == series_id)
        .order_by(CorrespondenceItem.sequence_no.asc())
    )
    return list(result.scalars().all())


async def _load_document_texts(db: AsyncSession, item_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[tuple[str, str, str]]]:
    if not item_ids:
        return {}
    result = await db.execute(
        select(DocumentText, Attachment)
        .join(Attachment, Attachment.id == DocumentText.attachment_id)
        .where(DocumentText.item_id.in_(item_ids))
        .order_by(DocumentText.created_at.asc())
    )
    mapping: dict[uuid.UUID, list[tuple[str, str, str]]] = {}
    for doc_text, attachment in result.all():
        mapping.setdefault(doc_text.item_id, []).append(
            (
                attachment.original_name,
                attachment.attachment_type or "",
                doc_text.extracted_text or "",
            )
        )
    return mapping


def _filter_attachment_chunks(
    item: CorrespondenceItem,
    chunks: list[tuple[str, str, str]],
    *,
    file_scope: str,
    approved_only: bool,
) -> list[tuple[str, str, str]]:
    filtered = chunks

    if approved_only:
        if item.direction == Direction.OUTGOING and item.outgoing_status != OutgoingItemStatus.APPROVED:
            return []

    if file_scope == "main_letter_only":
        if not filtered:
            return []
        main = [chunk for chunk in filtered if chunk[1] in {"main_letter", "main", "letter"}]
        return main[:1] if main else filtered[:1]

    if file_scope == "approved_attachments_only":
        if item.direction == Direction.OUTGOING and item.outgoing_status == OutgoingItemStatus.APPROVED:
            return filtered
        return []

    return filtered


def _build_item_context(
    item: CorrespondenceItem,
    chunks: list[tuple[str, str, str]],
    *,
    file_scope: str,
    approved_only: bool,
) -> ItemContext:
    selected_chunks = _filter_attachment_chunks(item, chunks, file_scope=file_scope, approved_only=approved_only)
    attachment_text = "\n\n".join(
        [f"[Attachment: {name}]\n{text}" for name, _type, text in selected_chunks if text and text.strip()]
    )

    model_text = _normalize(item.final_draft_text) or _normalize(item.ai_draft_text) or _normalize(item.prompt_text)
    fields_text = "\n".join(
        [
            f"Subject: {item.subject}",
            f"Sender: {item.sender_name or item.sender_organization or '-'}",
            f"Recipient: {item.recipient_name or item.recipient_organization or '-'}",
            f"Date on Letter: {_fmt_date(item.date_on_letter)}",
            f"Received Date: {_fmt_date(item.received_date)}",
            f"Sent Date: {_fmt_date(item.sent_date)}",
            f"Reference: {item.in_reference_to or '-'}",
            f"Remarks: {item.remarks or '-'}",
            f"Recorded Draft: {model_text or '-'}",
        ]
    )
    merged_text = "\n\n".join(part for part in [fields_text, attachment_text] if part.strip())
    return ItemContext(
        item=item,
        extracted_text=_truncate(merged_text, 12000),
        attachment_names=[name for name, _type, _text in selected_chunks],
    )


async def _summarize_older_items_with_gemini(items: list[ItemContext]) -> str:
    if not items:
        return ""
    timeline_input = "\n".join(
        [
            f"- seq={ctx.item.sequence_no} date={_fmt_date(ctx.item.received_date or ctx.item.sent_date or ctx.item.date_on_letter)} "
            f"direction={ctx.item.direction} subject={ctx.item.subject}\n"
            f"  text={ctx.extracted_text[:1200]}"
            for ctx in items
        ]
    )
    prompt = (
        "Summarize the following correspondence timeline as concise numbered bullets.\n"
        "For each bullet include: date, who asked what, commitments made, and pending asks.\n"
        "Keep it factual and short.\n\n"
        f"{timeline_input}"
    )
    summary = await generate_text(prompt, temperature=0.1)
    return summary.strip()


def _fallback_summary(items: list[ItemContext]) -> str:
    lines = []
    for ctx in items:
        date_text = _fmt_date(ctx.item.received_date or ctx.item.sent_date or ctx.item.date_on_letter)
        direction = "Incoming" if ctx.item.direction == Direction.INCOMING else "Outgoing"
        lines.append(f"{ctx.item.sequence_no}. {date_text} - {direction} - {ctx.item.subject}")
    return "\n".join(lines)


async def build_ai_context(db: AsyncSession, item_id: str, request: AIDraftRequest) -> dict[str, Any]:
    item_result = await db.execute(
        select(CorrespondenceItem)
        .options(selectinload(CorrespondenceItem.series))
        .where(CorrespondenceItem.id == item_id)
    )
    current_item = item_result.scalar_one()
    series_items = await _load_item_map(db, current_item.series_id)
    item_ids = [row.id for row in series_items]
    text_map = await _load_document_texts(db, item_ids)

    selected_letter_id: uuid.UUID | None = None
    if request.selected_letter_item_id:
        try:
            selected_letter_id = uuid.UUID(str(request.selected_letter_item_id))
        except (ValueError, TypeError):
            selected_letter_id = None
    elif isinstance(current_item.mode_specific_data, dict) and current_item.mode_specific_data.get("reply_to_item_id"):
        try:
            selected_letter_id = uuid.UUID(str(current_item.mode_specific_data["reply_to_item_id"]))
        except (ValueError, TypeError):
            selected_letter_id = None
    elif current_item.direction == Direction.OUTGOING:
        previous_incoming = [row for row in series_items if row.sequence_no < current_item.sequence_no and row.direction == Direction.INCOMING]
        selected_letter_id = previous_incoming[-1].id if previous_incoming else current_item.id
    else:
        selected_letter_id = current_item.id

    selected_item = next((row for row in series_items if row.id == selected_letter_id), None)
    if not selected_item:
        selected_item = next((row for row in series_items if row.id == current_item.id), current_item)

    if not request.use_selected_letter:
        selected_item = current_item

    selected_chunks = text_map.get(selected_item.id, []) if request.use_uploaded_attachments else []
    selected_context = _build_item_context(
        selected_item,
        selected_chunks,
        file_scope=request.file_scope,
        approved_only=request.use_approved_only,
    )

    selected_index = 0
    for idx, row in enumerate(series_items):
        if row.id == selected_item.id:
            selected_index = idx
            break
    prior_items = series_items[:selected_index] if request.use_previous_thread else []
    prior_contexts = [
        _build_item_context(
            row,
            text_map.get(row.id, []) if request.use_uploaded_attachments else [],
            file_scope=request.file_scope,
            approved_only=request.use_approved_only,
        )
        for row in prior_items
    ]

    if request.thread_scope == "current_letter_only":
        full_context_items = []
        older_items: list[ItemContext] = []
    elif request.thread_scope == "current_plus_previous":
        full_context_items = prior_contexts[-1:]
        older_items = prior_contexts[:-1]
    elif request.thread_scope == "last_3":
        full_context_items = prior_contexts[-3:]
        older_items = prior_contexts[:-3]
    else:
        # full_thread or unknown
        full_context_items = prior_contexts[-3:]
        older_items = prior_contexts[:-3]

    thread_summary = ""
    if older_items:
        try:
            thread_summary = await _summarize_older_items_with_gemini(older_items)
        except GeminiError:
            thread_summary = _fallback_summary(older_items)

    full_context_blocks = [
        (
            f"[Exchange #{ctx.item.sequence_no} | {ctx.item.direction} | {_fmt_date(ctx.item.received_date or ctx.item.sent_date or ctx.item.date_on_letter)}]\n"
            f"{ctx.extracted_text}"
        )
        for ctx in full_context_items
    ]

    return {
        "selected_item": {
            "id": str(selected_item.id),
            "sequence_no": selected_item.sequence_no,
            "direction": selected_item.direction.value,
            "subject": selected_item.subject,
            "reference": selected_item.letter_number or selected_item.diary_number or "-",
            "text": selected_context.extracted_text,
            "attachment_names": selected_context.attachment_names,
        },
        "thread_scope": request.thread_scope,
        "file_scope": request.file_scope,
        "history_full_blocks": full_context_blocks,
        "thread_summary": thread_summary,
        "metadata": {
            "series_number": selected_item.series.series_number,
            "series_subject": selected_item.series.subject,
            "category_id": str(selected_item.series.category_id),
            "organization": selected_item.series.organization_name,
            "current_item_sequence": current_item.sequence_no,
            "current_item_direction": current_item.direction.value,
        },
        "context_preview": {
            "selected_letter_reference": selected_item.letter_number or selected_item.diary_number or str(selected_item.id),
            "thread_scope": request.thread_scope,
            "full_exchanges_included": len(full_context_blocks),
            "summarized_older_exchanges": len(older_items),
            "uploaded_documents_count": len(selected_context.attachment_names),
            "tone": request.tone,
            "prompt_summary": (request.prompt_instructions or "")[:180],
            "draft_purpose": request.draft_purpose or request.draft_type or "formal_reply",
        },
    }


def _build_generation_prompt(request: AIDraftRequest, context: dict[str, Any]) -> str:
    formula = (
        "For reply drafting: Reply Draft = User Prompt + Selected Letter Text + Uploaded Documents + Previous Thread Context.\n"
        "For fresh letter drafting: New Letter Draft = User Prompt + Series Context + Uploaded Documents + Category/Recipient Metadata."
    )
    instructions = (
        "You are drafting an official correspondence letter.\n"
        "Internally answer:\n"
        "1) What is latest letter asking?\n"
        "2) What has already been said in thread?\n"
        "3) What commitments were made?\n"
        "4) Which dates/references/annexures must be mentioned?\n"
        "5) What tone is requested?\n"
        "6) Is this clarification/denial/acknowledgement/submission/follow-up?\n"
    )
    output_schema = (
        "Return valid JSON with keys:\n"
        "{\n"
        '  "subject_suggestion": "string",\n'
        '  "reference_line": "string",\n'
        '  "body_draft": "string",\n'
        '  "key_mentions": ["string"]\n'
        "}\n"
    )

    full_exchanges_text = "\n\n".join(context["history_full_blocks"]) or "(None)"
    return (
        f"{instructions}\n"
        f"{formula}\n\n"
        f"Tone: {request.tone or 'formal'}\n"
        f"Draft Type: {request.draft_type or 'reply'}\n"
        f"Draft Purpose: {request.draft_purpose or request.draft_type or 'formal_reply'}\n"
        f"Length Preference: {request.length_preference or 'medium'}\n"
        f"Legal/Regulatory Angle: {request.legal_regulatory_angle or '-'}\n"
        f"User Prompt: {request.prompt_instructions}\n"
        f"Key Points: {request.key_points or []}\n\n"
        f"Series Metadata:\n{context['metadata']}\n\n"
        f"Selected Letter Reference: {context['selected_item']['reference']}\n"
        f"Selected Letter Subject: {context['selected_item']['subject']}\n"
        f"Selected Letter Text:\n{context['selected_item']['text']}\n\n"
        f"Recent Full Exchanges:\n{full_exchanges_text}\n\n"
        f"Older Thread Summary:\n{context['thread_summary'] or '(None)'}\n\n"
        f"{output_schema}"
    )


async def generate_draft_with_context(request: AIDraftRequest, context: dict[str, Any]) -> dict[str, Any]:
    prompt = _build_generation_prompt(request, context)
    result = await generate_json(prompt, temperature=0.2)

    subject = str(result.get("subject_suggestion") or "").strip()
    reference_line = str(result.get("reference_line") or "").strip()
    body = str(result.get("body_draft") or "").strip()
    if not body:
        raise GeminiError("Gemini did not return body_draft.")

    return {
        "subject_suggestion": subject,
        "reference_line": reference_line,
        "body_draft": body,
        "key_mentions": result.get("key_mentions") or [],
    }


def generate_fallback_draft(context: dict[str, Any], request: AIDraftRequest) -> dict[str, Any]:
    subject = context["selected_item"]["subject"] or context["metadata"]["series_subject"]
    reference = context["selected_item"]["reference"]
    body = (
        "Respected Sir/Madam,\n\n"
        "This draft is generated from available series context and uploaded records.\n"
        "Please review and refine before submission for approval.\n\n"
        f"Reference: {reference}\n"
        f"Requested tone: {request.tone or 'formal'}\n"
        f"Prompt: {request.prompt_instructions}\n\n"
        "Regards,\nCorrespondence Department"
    )
    return {
        "subject_suggestion": f"Reply regarding {subject}",
        "reference_line": f"In reference to {reference}",
        "body_draft": body,
        "key_mentions": [],
    }

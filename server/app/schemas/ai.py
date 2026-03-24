from pydantic import BaseModel


class AIDraftRequest(BaseModel):
    item_id: str
    selected_letter_item_id: str | None = None
    prompt_title: str | None = None
    prompt_instructions: str
    tone: str | None = "formal"
    draft_type: str | None = None
    draft_purpose: str | None = None
    key_points: list[str] | None = None
    legal_regulatory_angle: str | None = None
    length_preference: str | None = None
    use_selected_letter: bool = True
    use_uploaded_attachments: bool = True
    use_previous_thread: bool = True
    thread_scope: str = "last_3"
    file_scope: str = "main_plus_attachments"
    use_approved_only: bool = False


class AIDraftResponse(BaseModel):
    draft_text: str
    subject_suggestion: str | None = None
    reference_line: str | None = None
    thread_summary: str | None = None
    context_preview: dict


class AutoReplyRequest(BaseModel):
    series_id: str
    selected_letter_item_id: str | None = None
    prompt_instructions: str = "Draft a formal professional reply based on this incoming letter and thread context."
    tone: str = "formal"
    draft_purpose: str = "formal_reply"
    thread_scope: str = "last_3"
    file_scope: str = "main_plus_attachments"
    length_preference: str = "medium"


class AutoReplyResponse(BaseModel):
    series_id: str
    item_id: str
    letter_number: str | None = None
    draft_text: str
    subject_suggestion: str | None = None
    reference_line: str | None = None

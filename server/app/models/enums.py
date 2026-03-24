from enum import StrEnum


class RoleCode(StrEnum):
    ADMIN = "admin"
    DEPARTMENT_USER = "department_user"
    APPROVER = "approver"
    VIEWER = "viewer"


class Direction(StrEnum):
    INCOMING = "incoming"
    OUTGOING = "outgoing"


class SeriesStatus(StrEnum):
    OPEN = "open"
    AWAITING_INTERNAL_DRAFT = "awaiting_internal_draft"
    AWAITING_APPROVAL = "awaiting_approval"
    AWAITING_EXTERNAL_RESPONSE = "awaiting_external_response"
    CLOSED = "closed"


class IncomingItemStatus(StrEnum):
    RECEIVED = "received"
    LOGGED = "logged"
    UNDER_REVIEW = "under_review"
    ACTION_REQUIRED = "action_required"
    FILED = "filed"


class OutgoingItemStatus(StrEnum):
    DRAFT = "draft"
    UNDER_REVIEW = "under_review"
    APPROVAL_PENDING = "approval_pending"
    APPROVED = "approved"
    SENT_BACK_FOR_CHANGES = "sent_back_for_changes"
    DISPATCHED = "dispatched"


class ItemType(StrEnum):
    FRESH_NEW_LETTER = "fresh_new_letter"
    REPLY = "reply"
    FOLLOW_UP = "follow_up"
    REMINDER = "reminder"
    CLARIFICATION = "clarification"
    SUBMISSION_COVER = "submission_cover"
    ACKNOWLEDGEMENT = "acknowledgement"
    COMPLIANCE_RESPONSE = "compliance_response"
    EXTENSION_REQUEST = "extension_request"
    INCOMING_LETTER = "incoming_letter"


class DispatchMode(StrEnum):
    BY_HAND = "by_hand"
    COURIER = "courier"
    EMAIL = "email"


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ApprovalDecision(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    SENT_BACK = "sent_back"
    REJECTED = "rejected"


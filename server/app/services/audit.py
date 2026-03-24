from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def log_audit(
    db: AsyncSession,
    *,
    actor_user_id: str | None,
    action: str,
    entity: str,
    entity_id: str | None = None,
    description: str | None = None,
    payload: dict | None = None,
    ip_address: str | None = None,
) -> None:
    row = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        description=description,
        payload=payload,
        ip_address=ip_address,
    )
    db.add(row)
    await db.flush()


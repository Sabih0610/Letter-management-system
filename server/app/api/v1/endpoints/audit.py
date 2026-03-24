from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("")
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
    limit: int = Query(default=100, le=500),
) -> list[dict]:
    result = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit))
    rows = result.scalars().all()
    return [
        {
            "id": str(row.id),
            "actor_user_id": str(row.actor_user_id) if row.actor_user_id else None,
            "action": row.action,
            "entity": row.entity,
            "entity_id": row.entity_id,
            "description": row.description,
            "payload": row.payload,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


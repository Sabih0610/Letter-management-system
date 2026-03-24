from collections.abc import Callable
import asyncio
from datetime import datetime, timedelta, timezone
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.enums import RoleCode
from app.models.user import User
from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
AUTH_USER_CACHE_TTL_SECONDS = 60
_auth_user_cache: dict[str, tuple[datetime, User]] = {}
_auth_user_cache_lock = asyncio.Lock()


def _cache_is_fresh(expires_at: datetime) -> bool:
    return expires_at > datetime.now(timezone.utc)


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    cached = _auth_user_cache.get(token)
    if cached and _cache_is_fresh(cached[0]):
        return cached[1]

    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.")
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.") from exc

    result = await db.execute(select(User).options(selectinload(User.role)).where(User.id == user_uuid, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")

    async with _auth_user_cache_lock:
        _auth_user_cache[token] = (datetime.now(timezone.utc) + timedelta(seconds=AUTH_USER_CACHE_TTL_SECONDS), user)
    return user


def require_roles(*allowed_roles: RoleCode | str) -> Callable:
    allowed = {str(role) for role in allowed_roles}

    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        user_role = current_user.role.code if current_user.role else ""
        if user_role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")
        return current_user

    return dependency

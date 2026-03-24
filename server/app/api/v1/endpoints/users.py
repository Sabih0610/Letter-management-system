from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_roles
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.enums import RoleCode
from app.models.role import Role
from app.models.user import User
from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(RoleCode.ADMIN)),
) -> list[UserRead]:
    result = await db.execute(select(User).options(selectinload(User.role), selectinload(User.department)).order_by(User.full_name))
    return [UserRead.model_validate(row) for row in result.scalars().all()]


@router.post("", response_model=UserRead)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(RoleCode.ADMIN)),
) -> UserRead:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists.")

    role = await db.execute(select(Role).where(Role.id == payload.role_id))
    if not role.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role_id=payload.role_id,
        department_id=payload.department_id,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    result = await db.execute(select(User).options(selectinload(User.role), selectinload(User.department)).where(User.id == user.id))
    created = result.scalar_one()
    return UserRead.model_validate(created)


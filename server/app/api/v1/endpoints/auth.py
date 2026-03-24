from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.enums import RoleCode
from app.models.role import Role
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse
from app.schemas.common import Token
from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> LoginResponse:
    result = await db.execute(select(User).options(selectinload(User.role), selectinload(User.department)).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    token = create_access_token(str(user.id), expires_delta=timedelta(minutes=720))
    return LoginResponse(token=Token(access_token=token), user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.post("/bootstrap-admin", response_model=UserRead)
async def bootstrap_admin(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> UserRead:
    existing_user = await db.execute(select(User).limit(1))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bootstrap not allowed after first user.")

    role_map: dict[str, Role] = {}
    for role_code in RoleCode:
        role = Role(name=role_code.value.replace("_", " ").title(), code=role_code.value)
        db.add(role)
        role_map[role.code] = role
    await db.flush()

    admin_role = role_map[RoleCode.ADMIN.value]
    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role_id=admin_role.id,
        department_id=None,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user, attribute_names=["role", "department"])
    return UserRead.model_validate(user)


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.category import Category
from app.models.department import Department
from app.models.enums import RoleCode
from app.models.role import Role
from app.models.user import User
from app.schemas.meta import CategoryCreate, CategoryRead, DepartmentCreate, DepartmentRead

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/categories", response_model=list[CategoryRead])
async def list_categories(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)) -> list[CategoryRead]:
    result = await db.execute(select(Category).order_by(Category.name))
    return [CategoryRead.model_validate(row) for row in result.scalars().all()]


@router.post("/categories", response_model=CategoryRead)
async def create_category(
    payload: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(RoleCode.ADMIN)),
) -> CategoryRead:
    existing = await db.execute(select(Category).where(Category.code == payload.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category code already exists.")
    row = Category(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return CategoryRead.model_validate(row)


@router.get("/departments", response_model=list[DepartmentRead])
async def list_departments(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)) -> list[DepartmentRead]:
    result = await db.execute(select(Department).order_by(Department.name))
    return [DepartmentRead.model_validate(row) for row in result.scalars().all()]


@router.post("/departments", response_model=DepartmentRead)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(RoleCode.ADMIN)),
) -> DepartmentRead:
    existing = await db.execute(select(Department).where(Department.code == payload.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department code already exists.")
    row = Department(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return DepartmentRead.model_validate(row)


@router.get("/roles")
async def list_roles(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)) -> list[dict]:
    result = await db.execute(select(Role).order_by(Role.name))
    return [{"id": str(row.id), "name": row.name, "code": row.code} for row in result.scalars().all()]

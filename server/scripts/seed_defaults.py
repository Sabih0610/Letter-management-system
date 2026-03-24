import asyncio
import sys
from pathlib import Path

from sqlalchemy import select

# Allow running this script directly: `python scripts/seed_defaults.py`
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.models.category import Category
from app.models.department import Department
from app.models.enums import RoleCode
from app.models.role import Role
from app.models.user import User


DEFAULT_CATEGORIES = [
    ("PTA Correspondence", "PTA"),
    ("Legal Correspondence", "LEGAL"),
    ("Bank Correspondence", "BANK"),
    ("Franchise Correspondence", "FRN"),
    ("HR Correspondence", "HR"),
    ("General Correspondence", "GEN"),
    ("FIA / NCCIA Correspondence", "FIA"),
    ("Technical / Regulatory Correspondence", "TECH"),
]

DEFAULT_DEPARTMENTS = [
    ("Regulatory Affairs", "REG"),
    ("Legal", "LEG"),
    ("Finance", "FIN"),
    ("Human Resources", "HR"),
    ("Operations", "OPS"),
]


async def seed() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        role_map: dict[str, Role] = {}
        for role_code in RoleCode:
            result = await db.execute(select(Role).where(Role.code == role_code.value))
            role = result.scalar_one_or_none()
            if not role:
                role = Role(
                    name=role_code.value.replace("_", " ").title(),
                    code=role_code.value,
                    description=f"System role: {role_code.value}",
                )
                db.add(role)
                await db.flush()
            role_map[role.code] = role

        for name, code in DEFAULT_CATEGORIES:
            result = await db.execute(select(Category).where(Category.code == code))
            if not result.scalar_one_or_none():
                db.add(Category(name=name, code=code, is_active=True))

        for name, code in DEFAULT_DEPARTMENTS:
            result = await db.execute(select(Department).where(Department.code == code))
            if not result.scalar_one_or_none():
                db.add(Department(name=name, code=code, is_active=True))

        result = await db.execute(select(User).where(User.email == "admin@example.com"))
        if not result.scalar_one_or_none():
            admin = User(
                full_name="System Admin",
                email="admin@example.com",
                hashed_password=get_password_hash("ChangeMe123!"),
                role_id=role_map[RoleCode.ADMIN.value].id,
                is_active=True,
            )
            db.add(admin)

        await db.commit()

    print("Seed complete.")
    print("Admin login: admin@example.com / ChangeMe123!")


if __name__ == "__main__":
    asyncio.run(seed())

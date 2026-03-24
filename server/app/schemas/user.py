from pydantic import EmailStr

from app.schemas.common import ORMBase, Timestamped, UUIDStr


class RoleRead(ORMBase):
    id: UUIDStr
    name: str
    code: str


class DepartmentRead(ORMBase):
    id: UUIDStr
    name: str
    code: str


class UserCreate(ORMBase):
    full_name: str
    email: EmailStr
    password: str
    role_id: UUIDStr
    department_id: UUIDStr | None = None


class UserRead(Timestamped):
    full_name: str
    email: EmailStr
    is_active: bool
    role: RoleRead
    department: DepartmentRead | None = None

from app.schemas.common import ORMBase, Timestamped


class CategoryCreate(ORMBase):
    name: str
    code: str
    description: str | None = None
    is_active: bool = True


class CategoryRead(Timestamped):
    name: str
    code: str
    description: str | None = None
    is_active: bool


class DepartmentCreate(ORMBase):
    name: str
    code: str
    is_active: bool = True


class DepartmentRead(Timestamped):
    name: str
    code: str
    is_active: bool


from datetime import datetime
from typing import Annotated, Any
import uuid

from pydantic import BaseModel, BeforeValidator, ConfigDict


def _uuid_to_str(value: Any) -> Any:
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


UUIDStr = Annotated[str, BeforeValidator(_uuid_to_str)]


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Message(ORMBase):
    message: str


class Token(ORMBase):
    access_token: str
    token_type: str = "bearer"


class Timestamped(ORMBase):
    id: UUIDStr
    created_at: datetime
    updated_at: datetime

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class DocumentBase(BaseModel):
    filename: str
    original_name: str
    file_type: str
    size_bytes: int

class DocumentInDB(DocumentBase):
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DocumentOut(DocumentBase):
    id: str
    user_id: str
    created_at: datetime

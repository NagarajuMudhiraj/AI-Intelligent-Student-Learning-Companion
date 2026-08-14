from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timezone

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    google_id: Optional[str] = None
    picture: Optional[str] = None
    education: Optional[str] = ""
    skills: Optional[List[str]] = []
    interests: Optional[List[str]] = []
    goals: Optional[str] = ""
    preferences: Optional[List[str]] = []

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    hashed_password: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)
    is_active: bool = True
    is_verified: bool = False

class UserOut(UserBase):
    id: str
    is_active: bool
    is_verified: bool = False

class Token(BaseModel):
    access_token: str
    token_type: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


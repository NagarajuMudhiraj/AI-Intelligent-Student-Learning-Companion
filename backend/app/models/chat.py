from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ChatMessage(BaseModel):
    role: str # 'user' or 'ai'
    content: str

class ChatRequest(BaseModel):
    query: str
    document_id: Optional[str] = None # If null, search across all user documents
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]
    session_id: Optional[str] = None
    follow_up_suggestions: Optional[List[str]] = []

class ChatSessionCreate(BaseModel):
    title: Optional[str] = None
    document_id: Optional[str] = None

class ChatSessionUpdate(BaseModel):
    title: str

class ChatSessionOut(BaseModel):
    id: str
    user_id: str
    document_id: Optional[str] = None
    title: str
    created_at: datetime
    updated_at: datetime


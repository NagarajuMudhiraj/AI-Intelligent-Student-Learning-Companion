from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class FlashcardItem(BaseModel):
    front: str
    back: str
    next_review: datetime = Field(default_factory=datetime.utcnow)
    interval: int = 0
    ease_factor: float = 2.5
    repetitions: int = 0


class FlashcardGenerateRequest(BaseModel):
    document_id: Optional[str] = None
    topic: Optional[str] = None
    num_cards: int = 10
    deck_name: Optional[str] = None


class FlashcardDeckInDB(BaseModel):
    user_id: str
    deck_name: str
    cards: List[FlashcardItem]
    document_id: Optional[str] = None
    topic: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FlashcardDeckOut(BaseModel):
    id: str
    deck_name: str
    cards: List[FlashcardItem]
    document_id: Optional[str] = None
    topic: Optional[str] = None
    created_at: datetime
    card_count: int
    due_count: int = 0


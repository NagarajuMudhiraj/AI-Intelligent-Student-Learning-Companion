from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class QuizRequest(BaseModel):
    document_id: Optional[str] = None  # None = across all user docs
    topic: Optional[str] = None         # Free-text topic if no document
    num_questions: int = 5
    difficulty: str = "medium"          # easy | medium | hard


class QuizOption(BaseModel):
    label: str   # A, B, C, D
    text: str


class QuizQuestion(BaseModel):
    question: str
    options: List[QuizOption]
    correct_answer: str  # label A/B/C/D
    explanation: str


class QuizResponse(BaseModel):
    questions: List[QuizQuestion]
    document_name: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None


class QuizAttemptInDB(BaseModel):
    user_id: str
    questions: List[QuizQuestion]
    user_answers: List[str]  # list of chosen labels
    score: int
    total: int
    document_id: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = "medium"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class QuizAttemptOut(BaseModel):
    id: str
    score: int
    total: int
    topic: Optional[str] = None
    difficulty: Optional[str] = "medium"
    created_at: datetime


class QuizSubmitRequest(BaseModel):
    questions: List[QuizQuestion]
    user_answers: List[str]
    document_id: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = "medium"


class QuizSubmitResponse(BaseModel):
    score: int
    total: int
    percentage: float
    attempt_id: str


class QuizAttemptDetailsOut(BaseModel):
    id: str
    questions: List[QuizQuestion]
    user_answers: List[str]
    score: int
    total: int
    document_id: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = "medium"
    created_at: datetime


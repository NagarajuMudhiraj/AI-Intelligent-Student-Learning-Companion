from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class StudyTaskCreate(BaseModel):
    title: str
    subject: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str = "medium"  # low | medium | high
    notes: Optional[str] = None


class StudyTaskUpdate(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None


class StudyTaskInDB(StudyTaskCreate):
    user_id: str
    completed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class StudyTaskOut(BaseModel):
    id: str
    title: str
    subject: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str
    notes: Optional[str] = None
    completed: bool
    created_at: datetime


class StudyPlanWeekTask(BaseModel):
    title: str
    notes: Optional[str] = None
    priority: str = "medium"  # low | medium | high


class StudyPlanWeek(BaseModel):
    week: int
    title: str
    goal: str
    tasks: List[StudyPlanWeekTask]


class StudyPlanInDB(BaseModel):
    user_id: str
    document_id: Optional[str] = None
    topic: Optional[str] = None
    weeks: List[StudyPlanWeek]
    created_at: datetime = Field(default_factory=datetime.utcnow)


class StudyPlanOut(BaseModel):
    id: str
    document_id: Optional[str] = None
    topic: Optional[str] = None
    weeks: List[StudyPlanWeek]
    created_at: datetime


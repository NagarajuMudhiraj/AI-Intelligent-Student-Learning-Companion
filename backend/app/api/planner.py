from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.models.user import UserOut
from app.models.planner import (
    StudyTaskCreate, StudyTaskUpdate, StudyTaskInDB, StudyTaskOut,
    StudyPlanInDB, StudyPlanOut, StudyPlanWeek, StudyPlanWeekTask
)
from app.db.database import get_database
from app.services.rag_service import search_documents
from app.core.config import settings
from langchain_google_genai import ChatGoogleGenerativeAI
from typing import List, Optional
from bson import ObjectId
from pydantic import BaseModel
from datetime import datetime, timedelta
import json
import re

router = APIRouter()


@router.get("/tasks", response_model=List[StudyTaskOut])
async def get_tasks(current_user: UserOut = Depends(get_current_user)):
    db = get_database()
    cursor = db["study_tasks"].find({"user_id": current_user.id}).sort("created_at", -1)
    tasks = await cursor.to_list(length=100)

    return [
        StudyTaskOut(
            id=str(t["_id"]),
            title=t["title"],
            subject=t.get("subject"),
            due_date=t.get("due_date"),
            priority=t.get("priority", "medium"),
            notes=t.get("notes"),
            completed=t.get("completed", False),
            created_at=t["created_at"]
        )
        for t in tasks
    ]


@router.post("/tasks", response_model=StudyTaskOut)
async def create_task(
    task_in: StudyTaskCreate,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    task = StudyTaskInDB(**task_in.dict(), user_id=current_user.id)
    result = await db["study_tasks"].insert_one(task.dict())

    return StudyTaskOut(
        id=str(result.inserted_id),
        title=task.title,
        subject=task.subject,
        due_date=task.due_date,
        priority=task.priority,
        notes=task.notes,
        completed=task.completed,
        created_at=task.created_at
    )


@router.put("/tasks/{task_id}", response_model=StudyTaskOut)
async def update_task(
    task_id: str,
    task_update: StudyTaskUpdate,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    update_data = {k: v for k, v in task_update.dict().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db["study_tasks"].update_one(
        {"_id": ObjectId(task_id), "user_id": current_user.id},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")

    updated = await db["study_tasks"].find_one({"_id": ObjectId(task_id)})
    return StudyTaskOut(
        id=str(updated["_id"]),
        title=updated["title"],
        subject=updated.get("subject"),
        due_date=updated.get("due_date"),
        priority=updated.get("priority", "medium"),
        notes=updated.get("notes"),
        completed=updated.get("completed", False),
        created_at=updated["created_at"]
    )


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    result = await db["study_tasks"].delete_one(
        {"_id": ObjectId(task_id), "user_id": current_user.id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}


# AI Study Planner Routes

class GenerateScheduleRequest(BaseModel):
    document_id: Optional[str] = None
    topic: Optional[str] = None
    duration_days: int = 30


class BulkImportTaskItem(BaseModel):
    title: str
    subject: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str = "medium"
    notes: Optional[str] = None


class BulkImportRequest(BaseModel):
    tasks: List[BulkImportTaskItem]


llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.3
)

PLANNER_PROMPT = """You are an expert tutor and study planner. Generate a week-by-week study schedule for the syllabus or topics provided below for a total duration of {duration_days} days. Divide the content into weekly blocks.

Syllabus/Topics Context:
{context}

Return ONLY a valid JSON object. Do not include markdown wraps or anything else.
The JSON structure must match exactly:
{{
  "schedule": [
    {{
      "week": 1,
      "title": "Week 1: Title or Theme",
      "goal": "Main weekly learning objective",
      "tasks": [
        {{
          "title": "Task 1 title",
          "notes": "Detail/advice for task 1",
          "priority": "high"
        }}
      ]
    }}
  ]
}}
"""


@router.post("/generate-schedule", response_model=StudyPlanOut)
async def generate_schedule(
    request: GenerateScheduleRequest,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    context = ""
    
    if request.document_id or (not request.topic):
        results = search_documents(
            query=request.topic or "syllabus course outline topics",
            user_id=current_user.id,
            document_id=request.document_id,
            top_k=8
        )
        if results:
            context = "\n\n".join([doc.page_content for doc in results])
        elif request.topic:
            context = request.topic
        else:
            raise HTTPException(status_code=400, detail="No syllabus documents found. Upload a syllabus or type topics.")
            
    if request.topic and not context:
        context = request.topic
    elif request.topic and context:
        context = f"Topic: {request.topic}\n\nSyllabus:\n{context}"
        
    prompt = PLANNER_PROMPT.format(
        duration_days=request.duration_days,
        context=context[:6000]
    )
    
    response = llm.invoke(prompt)
    raw = response.content.strip()
    
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="Failed to parse schedule from AI response")
        
    try:
        data = json.loads(match.group())
        weeks_data = data.get("schedule", [])
        weeks = [StudyPlanWeek(**w) for w in weeks_data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schedule structure error: {str(e)}")
        
    # Upsert study plan (one active plan per user)
    now = datetime.utcnow()
    await db["study_plans"].delete_many({"user_id": current_user.id})
    
    plan = StudyPlanInDB(
        user_id=current_user.id,
        document_id=request.document_id,
        topic=request.topic,
        weeks=weeks,
        created_at=now
    )
    
    result = await db["study_plans"].insert_one(plan.model_dump())
    
    return StudyPlanOut(
        id=str(result.inserted_id),
        document_id=plan.document_id,
        topic=plan.topic,
        weeks=plan.weeks,
        created_at=plan.created_at
    )


@router.get("/active-schedule", response_model=Optional[StudyPlanOut])
async def get_active_schedule(current_user: UserOut = Depends(get_current_user)):
    db = get_database()
    plan = await db["study_plans"].find_one({"user_id": current_user.id})
    if not plan:
        return None
        
    return StudyPlanOut(
        id=str(plan["_id"]),
        document_id=plan.get("document_id"),
        topic=plan.get("topic"),
        weeks=plan.get("weeks", []),
        created_at=plan["created_at"]
    )


@router.delete("/active-schedule")
async def delete_active_schedule(current_user: UserOut = Depends(get_current_user)):
    db = get_database()
    await db["study_plans"].delete_many({"user_id": current_user.id})
    return {"message": "Active study schedule cleared"}


@router.post("/bulk-add-tasks")
async def bulk_add_tasks(
    request: BulkImportRequest,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    now = datetime.utcnow()
    tasks_to_insert = []
    
    for t in request.tasks:
        task = StudyTaskInDB(
            title=t.title,
            subject=t.subject,
            due_date=t.due_date,
            priority=t.priority,
            notes=t.notes,
            user_id=current_user.id,
            completed=False,
            created_at=now
        )
        tasks_to_insert.append(task.model_dump())
        
    if tasks_to_insert:
        await db["study_tasks"].insert_many(tasks_to_insert)
        
    return {"message": f"Successfully imported {len(tasks_to_insert)} tasks to the board"}


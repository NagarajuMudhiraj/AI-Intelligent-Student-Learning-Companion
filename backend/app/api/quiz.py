from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.models.user import UserOut
from app.models.quiz import (
    QuizRequest, QuizResponse, QuizQuestion, QuizOption,
    QuizSubmitRequest, QuizSubmitResponse, QuizAttemptInDB, QuizAttemptOut, QuizAttemptDetailsOut
)
from app.services.rag_service import search_documents
from app.db.database import get_database
from app.core.config import settings
from langchain_google_genai import ChatGoogleGenerativeAI
from typing import List
from bson import ObjectId
import json
import re

from app.core.prompt_security import detect_prompt_injection, sanitize_rag_context, wrap_rag_context, SYSTEM_SECURITY_DIRECTIVE

router = APIRouter()

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.4
)

QUIZ_PROMPT = """You are an expert educator. Generate {num_questions} multiple-choice quiz questions at {difficulty} difficulty level.

{system_security_directive}

Context/Topic:
{context}

Return ONLY a valid JSON array of objects. Each object must have exactly this structure:
{{
  "question": "The question text",
  "options": [
    {{"label": "A", "text": "Option A text"}},
    {{"label": "B", "text": "Option B text"}},
    {{"label": "C", "text": "Option C text"}},
    {{"label": "D", "text": "Option D text"}}
  ],
  "correct_answer": "A",
  "explanation": "Brief explanation of why this is correct"
}}

Do not include any text before or after the JSON array."""


@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(
    request: QuizRequest,
    current_user: UserOut = Depends(get_current_user)
):
    if request.topic:
        is_inj, _ = detect_prompt_injection(request.topic)
        if is_inj:
            raise HTTPException(status_code=400, detail="Invalid quiz topic: Contains suspicious prompt patterns.")
    db = get_database()
    context = ""
    doc_name = None

    if request.document_id or (not request.topic):
        results = search_documents(
            query=request.topic or "key concepts summary",
            user_id=current_user.id,
            document_id=request.document_id,
            top_k=4 # Optimized from 8
        )
        if results:
            context = "\n\n".join([doc.page_content for doc in results])
            doc_name = results[0].metadata.get("source") if results else None
        elif request.topic:
            context = request.topic
        else:
            raise HTTPException(status_code=400, detail="No documents found. Upload a document first or provide a topic.")
    
    if request.topic and not context:
        context = request.topic
    elif request.topic and context:
        context = f"Topic: {request.topic}\n\nRelevant content:\n{context}"

    # Adaptive difficulty calculation
    difficulty = request.difficulty
    if difficulty == "adaptive":
        # Fetch last 3 attempts for this user
        cursor = db["quiz_attempts"].find({"user_id": current_user.id}).sort("created_at", -1).limit(3)
        attempts = await cursor.to_list(length=3)
        if len(attempts) > 0:
            avg_score = sum([a["score"] / a["total"] for a in attempts]) / len(attempts)
            if avg_score >= 0.8:
                difficulty = "hard"
            elif avg_score >= 0.5:
                difficulty = "medium"
            else:
                difficulty = "easy"
        else:
            difficulty = "medium"  # default fallback

    safe_context = wrap_rag_context(context[:4000])

    prompt = QUIZ_PROMPT.format(
        system_security_directive=SYSTEM_SECURITY_DIRECTIVE,
        num_questions=request.num_questions,
        difficulty=difficulty,
        context=safe_context
    )

    response = llm.invoke(prompt)
    raw = response.content.strip()

    # Extract JSON
    match = re.search(r'\[.*\]', raw, re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="Failed to parse quiz from AI response")

    try:
        questions_data = json.loads(match.group())
        questions = [QuizQuestion(**q) for q in questions_data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz parsing error: {str(e)}")

    return QuizResponse(
        questions=questions,
        document_name=doc_name,
        topic=request.topic,
        difficulty=difficulty
    )


@router.post("/submit", response_model=QuizSubmitResponse)
async def submit_quiz(
    request: QuizSubmitRequest,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    
    # Calculate score
    score = 0
    for q, answer in zip(request.questions, request.user_answers):
        if answer == q.correct_answer:
            score += 1

    total = len(request.questions)
    percentage = round((score / total) * 100, 1) if total > 0 else 0

    attempt = QuizAttemptInDB(
        user_id=current_user.id,
        questions=request.questions,
        user_answers=request.user_answers,
        score=score,
        total=total,
        document_id=request.document_id,
        topic=request.topic,
        difficulty=request.difficulty
    )

    result = await db["quiz_attempts"].insert_one(attempt.model_dump())

    return QuizSubmitResponse(
        score=score,
        total=total,
        percentage=percentage,
        attempt_id=str(result.inserted_id)
    )


@router.get("/history", response_model=List[QuizAttemptOut])
async def get_quiz_history(current_user: UserOut = Depends(get_current_user)):
    db = get_database()
    cursor = db["quiz_attempts"].find({"user_id": current_user.id}).sort("created_at", -1).limit(20)
    attempts = await cursor.to_list(length=20)

    return [
        QuizAttemptOut(
            id=str(a["_id"]),
            score=a["score"],
            total=a["total"],
            topic=a.get("topic"),
            difficulty=a.get("difficulty", "medium"),
            created_at=a["created_at"]
        )
        for a in attempts
    ]


@router.get("/attempts/{attempt_id}", response_model=QuizAttemptDetailsOut)
async def get_quiz_attempt(
    attempt_id: str,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    attempt = await db["quiz_attempts"].find_one(
        {"_id": ObjectId(attempt_id), "user_id": current_user.id}
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")
        
    return QuizAttemptDetailsOut(
        id=str(attempt["_id"]),
        questions=attempt["questions"],
        user_answers=attempt["user_answers"],
        score=attempt["score"],
        total=attempt["total"],
        document_id=attempt.get("document_id"),
        topic=attempt.get("topic"),
        difficulty=attempt.get("difficulty", "medium"),
        created_at=attempt["created_at"]
    )


@router.post("/attempts/{attempt_id}/retest", response_model=QuizResponse)
async def retest_weak_areas(
    attempt_id: str,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    attempt = await db["quiz_attempts"].find_one(
        {"_id": ObjectId(attempt_id), "user_id": current_user.id}
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")
        
    questions = attempt.get("questions", [])
    user_answers = attempt.get("user_answers", [])
    
    # Extract incorrect questions
    wrong_questions = []
    for q, ans in zip(questions, user_answers):
        if q.get("correct_answer") != ans:
            wrong_questions.append(q)
            
    if not wrong_questions:
        raise HTTPException(status_code=400, detail="Congratulations! You had no wrong answers in this quiz, so no re-test is needed.")
        
    wrong_context = json.dumps(wrong_questions, indent=2)
    
    retest_prompt = f"""You are an expert tutor. Below are questions that a student answered incorrectly.
Generate a new review quiz of {len(wrong_questions)} questions covering the SAME concepts and topics as these failed questions, but using different phrasing, scenarios, or values to test if the student now understands the concept.

Incorrect questions:
{wrong_context}

Return ONLY a valid JSON array of objects. Each object must have exactly this structure:
{{
  "question": "The question text",
  "options": [
    {{"label": "A", "text": "Option A text"}},
    {{"label": "B", "text": "Option B text"}},
    {{"label": "C", "text": "Option C text"}},
    {{"label": "D", "text": "Option D text"}}
  ],
  "correct_answer": "A",
  "explanation": "Brief explanation of why this is correct and addressing the misconception"
}}

Do not include any text before or after the JSON array."""
    
    response = llm.invoke(retest_prompt)
    raw = response.content.strip()
    
    match = re.search(r'\[.*\]', raw, re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="Failed to parse retest quiz from AI response")
        
    try:
        questions_data = json.loads(match.group())
        new_questions = [QuizQuestion(**q) for q in questions_data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retest quiz parsing error: {str(e)}")
        
    return QuizResponse(
        questions=new_questions,
        document_name=attempt.get("topic") or "Review Re-test",
        topic=attempt.get("topic")
    )


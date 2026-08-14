from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.user import UserOut
from app.db.database import get_database
from pydantic import BaseModel
from typing import List
from datetime import datetime

router = APIRouter()

class QuizScore(BaseModel):
    date: str
    score: int
    total: int
    percentage: float

class TopicPerformance(BaseModel):
    topic: str
    correct: int
    total: int
    accuracy: float


class AnalyticsSummary(BaseModel):
    total_documents: int
    total_quizzes: int
    avg_quiz_score: float
    total_tasks: int
    completed_tasks: int
    flashcard_decks: int
    recent_quiz_scores: List[QuizScore]
    total_chats: int

@router.get("/summary", response_model=AnalyticsSummary)
async def get_analytics_summary(current_user: UserOut = Depends(get_current_user)):
    db = get_database()
    
    # 1. Count total documents
    total_documents = await db["documents"].count_documents({"user_id": current_user.id})
    
    # 2. Count total quizzes taken
    total_quizzes = await db["quiz_attempts"].count_documents({"user_id": current_user.id})
    
    # 3. Count flashcard decks
    flashcard_decks = await db["flashcard_decks"].count_documents({"user_id": current_user.id})
    
    # 4. Count total chats (user queries)
    total_chats = await db["chats"].count_documents({"user_id": current_user.id, "role": "user"})
    
    # 5. Count study tasks
    total_tasks = await db["study_tasks"].count_documents({"user_id": current_user.id})
    completed_tasks = await db["study_tasks"].count_documents({"user_id": current_user.id, "completed": True})
    
    # 6. Fetch 10 most recent quiz attempts (ordered by created_at descending)
    cursor = db["quiz_attempts"].find({"user_id": current_user.id}).sort("created_at", -1).limit(10)
    attempts = await cursor.to_list(length=10)
    
    recent_quiz_scores = []
    for a in attempts:
        pct = round((a["score"] / a["total"]) * 100, 1) if a["total"] > 0 else 0.0
        dt = a.get("created_at")
        if isinstance(dt, datetime):
            date_str = dt.strftime("%m/%d")
        else:
            date_str = datetime.utcnow().strftime("%m/%d")
        recent_quiz_scores.append(
            QuizScore(
                date=date_str,
                score=a["score"],
                total=a["total"],
                percentage=pct
            )
        )
        
    # 7. Compute average score percentage across ALL attempts
    all_attempts_cursor = db["quiz_attempts"].find({"user_id": current_user.id})
    all_attempts = await all_attempts_cursor.to_list(length=100)
    if all_attempts:
        percentages = [((a["score"] / a["total"]) * 100) if a["total"] > 0 else 0.0 for a in all_attempts]
        avg_quiz_score = round(sum(percentages) / len(percentages), 1)
    else:
        avg_quiz_score = 0.0
        
    return AnalyticsSummary(
        total_documents=total_documents,
        total_quizzes=total_quizzes,
        avg_quiz_score=avg_quiz_score,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        flashcard_decks=flashcard_decks,
        recent_quiz_scores=recent_quiz_scores,
        total_chats=total_chats
    )


@router.get("/cache-stats")
async def get_cache_stats(current_user: UserOut = Depends(get_current_user)):
    db = get_database()
    
    # Fetch all token logs for the current user
    cursor = db["token_logs"].find({"user_id": current_user.id}).sort("timestamp", 1)
    logs = await cursor.to_list(length=1000)
    
    total_before = 0
    total_after = 0
    total_saved = 0
    cache_hits = 0
    cache_misses = 0
    
    daily_stats = {} # group by date YYYY-MM-DD
    
    for log in logs:
        before = log.get("tokens_before", log.get("total_tokens", 0)) # fallback
        after = log.get("tokens_after", log.get("total_tokens", 0))
        saved = log.get("saved_tokens", 0)
        is_hit = log.get("cache_hit", False)
        
        total_before += before
        total_after += after
        total_saved += saved
        if is_hit:
            cache_hits += 1
        else:
            cache_misses += 1
            
        dt = log.get("timestamp", datetime.utcnow())
        date_str = dt.strftime("%Y-%m-%d")
        if date_str not in daily_stats:
            daily_stats[date_str] = {"before": 0, "after": 0, "saved": 0}
        daily_stats[date_str]["before"] += before
        daily_stats[date_str]["after"] += after
        daily_stats[date_str]["saved"] += saved
        
    total_requests = len(logs)
    hit_rate = round((cache_hits / total_requests) * 100, 1) if total_requests > 0 else 0.0
    miss_rate = round((cache_misses / total_requests) * 100, 1) if total_requests > 0 else 0.0
    savings_pct = round((total_saved / total_before) * 100, 1) if total_before > 0 else 0.0
    
    # Format daily usage chart data
    chart_data = []
    for date_str, vals in sorted(daily_stats.items()):
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            nice_date = date_obj.strftime("%m/%d")
        except Exception:
            nice_date = date_str
        chart_data.append({
            "date": nice_date,
            "before": vals["before"],
            "after": vals["after"],
            "saved": vals["saved"]
        })
        
    # If no data, populate a default baseline for visualization
    if not chart_data:
        chart_data = [
            {"date": datetime.utcnow().strftime("%m/%d"), "before": 0, "after": 0, "saved": 0}
        ]
        
    return {
        "total_tokens_before": total_before,
        "total_tokens_after": total_after,
        "total_tokens_saved": total_saved,
        "savings_percentage": savings_pct,
        "total_requests": total_requests,
        "cache_hits": cache_hits,
        "cache_misses": cache_misses,
        "hit_rate": hit_rate,
        "miss_rate": miss_rate,
        "daily_logs": chart_data
    }


@router.get("/subject-performance", response_model=List[TopicPerformance])
async def get_subject_performance(current_user: UserOut = Depends(get_current_user)):
    db = get_database()
    cursor = db["quiz_attempts"].find({"user_id": current_user.id})
    attempts = await cursor.to_list(length=1000)
    
    performance_map = {}
    for a in attempts:
        topic = (a.get("topic") or "General").strip()
        if not topic:
            topic = "General"
        
        # Capitalize first letter cleanly
        topic = topic[0].upper() + topic[1:] if len(topic) > 0 else "General"
        
        score = a.get("score", 0)
        total = a.get("total", 0)
        
        if topic not in performance_map:
            performance_map[topic] = {"correct": 0, "total": 0}
            
        performance_map[topic]["correct"] += score
        performance_map[topic]["total"] += total
        
    result = []
    for topic, stats in performance_map.items():
        acc = round((stats["correct"] / stats["total"]) * 100, 1) if stats["total"] > 0 else 0.0
        result.append(
            TopicPerformance(
                topic=topic,
                correct=stats["correct"],
                total=stats["total"],
                accuracy=acc
            )
        )
        
    # Sort by accuracy descending, then by total questions descending
    result.sort(key=lambda x: (x.accuracy, x.total), reverse=True)
    return result


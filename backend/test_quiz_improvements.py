import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv

# Load env values
os.chdir(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from app.db.database import connect_to_mongo, get_database
from app.models.user import UserOut
from app.api.analytics import get_subject_performance

async def test_quiz_improvements():
    print("Initializing MongoDB connection...")
    await connect_to_mongo()
    db = get_database()
    
    # 1. Fetch first user
    user_doc = await db["users"].find_one()
    if not user_doc:
        print("❌ FAILED: No user found in database. Register a user first.")
        return
        
    user_id = str(user_doc["_id"])
    print(f"Testing on User ID: {user_id}")
    current_user = UserOut(
        id=user_id,
        email=user_doc.get("email", "test@example.com"),
        full_name=user_doc.get("full_name", "Test User"),
        is_active=user_doc.get("is_active", True),
        education=user_doc.get("education", ""),
        skills=user_doc.get("skills", []),
        interests=user_doc.get("interests", []),
        goals=user_doc.get("goals", ""),
        preferences=user_doc.get("preferences", [])
    )

    # Prepare Mock Quiz Attempts
    test_tag = f"test_quiz_improvements_{int(datetime.utcnow().timestamp())}"
    print(f"Inserting mock quiz attempts with topic tag: {test_tag}")
    
    mock_attempts = [
        # Attempt 1: score 4/5 (80%)
        {
            "user_id": user_id,
            "questions": [],
            "user_answers": [],
            "score": 4,
            "total": 5,
            "topic": test_tag,
            "difficulty": "medium",
            "created_at": datetime.utcnow()
        },
        # Attempt 2: score 5/5 (100%)
        {
            "user_id": user_id,
            "questions": [],
            "user_answers": [],
            "score": 5,
            "total": 5,
            "topic": test_tag,
            "difficulty": "hard",
            "created_at": datetime.utcnow()
        },
        # Attempt 3: score 4/5 (80%)
        {
            "user_id": user_id,
            "questions": [],
            "user_answers": [],
            "score": 4,
            "total": 5,
            "topic": test_tag,
            "difficulty": "hard",
            "created_at": datetime.utcnow()
        }
    ]
    
    # Insert attempts
    inserted_ids = []
    for attempt in mock_attempts:
        res = await db["quiz_attempts"].insert_one(attempt)
        inserted_ids.append(res.inserted_id)
        
    try:
        # Test Adaptive Difficulty selection
        # With scores of 80%, 100%, 80%, average score is 86.7% (>= 80%). The next adaptive quiz should resolve to "hard".
        print("\n--- Test 1: Adaptive Difficulty (High Scores -> Hard) ---")
        
        cursor = db["quiz_attempts"].find({"user_id": user_id}).sort("created_at", -1).limit(3)
        attempts = await cursor.to_list(length=3)
        assert len(attempts) >= 3, "Should have retrieved at least 3 attempts"
        
        avg_score = sum([a["score"] / a["total"] for a in attempts]) / len(attempts)
        print(f"Mocked past attempts average score: {avg_score * 100:.2f}%")
        
        calculated_difficulty = "medium"
        if avg_score >= 0.8:
            calculated_difficulty = "hard"
        elif avg_score >= 0.5:
            calculated_difficulty = "medium"
        else:
            calculated_difficulty = "easy"
            
        print(f"Calculated Adaptive Difficulty: {calculated_difficulty}")
        assert calculated_difficulty == "hard", "Average score of 86.7% should map to 'hard' difficulty"
        print("SUCCESS: High score maps to hard difficulty!")

        # Let's insert low score attempts to check easy difficulty
        print("\n--- Test 2: Adaptive Difficulty (Low Scores -> Easy) ---")
        low_attempts = [
            {
                "user_id": user_id,
                "questions": [],
                "user_answers": [],
                "score": 1,
                "total": 5, # 20%
                "topic": test_tag,
                "difficulty": "medium",
                "created_at": datetime.utcnow()
            },
            {
                "user_id": user_id,
                "questions": [],
                "user_answers": [],
                "score": 2,
                "total": 5, # 40%
                "topic": test_tag,
                "difficulty": "easy",
                "created_at": datetime.utcnow()
            },
            {
                "user_id": user_id,
                "questions": [],
                "user_answers": [],
                "score": 1,
                "total": 5, # 20%
                "topic": test_tag,
                "difficulty": "easy",
                "created_at": datetime.utcnow()
            }
        ]
        
        low_inserted_ids = []
        for attempt in low_attempts:
            res = await db["quiz_attempts"].insert_one(attempt)
            low_inserted_ids.append(res.inserted_id)
            
        # Re-fetch last 3 attempts
        cursor = db["quiz_attempts"].find({"user_id": user_id}).sort("created_at", -1).limit(3)
        attempts = await cursor.to_list(length=3)
        avg_score = sum([a["score"] / a["total"] for a in attempts]) / len(attempts)
        print(f"Mocked past attempts average score (low): {avg_score * 100:.2f}%")
        
        calculated_difficulty = "medium"
        if avg_score >= 0.8:
            calculated_difficulty = "hard"
        elif avg_score >= 0.5:
            calculated_difficulty = "medium"
        else:
            calculated_difficulty = "easy"
            
        print(f"Calculated Adaptive Difficulty (low): {calculated_difficulty}")
        assert calculated_difficulty == "easy", "Average score of 26.7% should map to 'easy' difficulty"
        print("SUCCESS: Low score maps to easy difficulty!")
        
        # Clean up low attempts
        for id_ in low_inserted_ids:
            await db["quiz_attempts"].delete_one({"_id": id_})

        # Test Subject-Wise Performance aggregation route logic
        print("\n--- Test 3: Subject-Wise Performance API ---")
        performances = await get_subject_performance(current_user)
        
        # Find the tag in returned performances
        test_topic_perf = next((p for p in performances if p.topic == test_tag.capitalize()), None)
        assert test_topic_perf is not None, "Test topic should be present in results"
        print(f"Topic: {test_topic_perf.topic}, Correct: {test_topic_perf.correct}, Total: {test_topic_perf.total}, Accuracy: {test_topic_perf.accuracy}%")
        
        # Average score should be correct: (4+5+4)/(5+5+5) = 13/15 = 86.67%
        assert test_topic_perf.correct == 13, "Total correct should be 13"
        assert test_topic_perf.total == 15, "Total questions should be 15"
        assert abs(test_topic_perf.accuracy - 86.7) <= 0.1, "Accuracy should be 86.7%"
        print("SUCCESS: Subject-Wise Performance aggregation verified successfully!")

    finally:
        # Clean up mock attempts
        print(f"\nCleaning up mock attempts...")
        for id_ in inserted_ids:
            await db["quiz_attempts"].delete_one({"_id": id_})
        print("Cleanup completed.")

if __name__ == "__main__":
    asyncio.run(test_quiz_improvements())

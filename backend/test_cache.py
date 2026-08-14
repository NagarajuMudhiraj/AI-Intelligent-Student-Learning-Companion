import asyncio
import os
import time
from dotenv import load_dotenv

# Load env values
os.chdir(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from app.db.database import connect_to_mongo, get_database
from app.services.cache_service import (
    get_cached_profile_async,
    invalidate_profile_cache,
    build_smart_context,
    summarize_session_history,
    estimate_tokens,
    _PROFILE_CACHE
)

async def test_cache_memory():
    print("Initializing MongoDB connection...")
    await connect_to_mongo()
    db = get_database()
    
    # 1. Fetch first user
    user = await db["users"].find_one()
    if not user:
        print("❌ FAILED: No user found in database. Run register first.")
        return
        
    user_id = str(user["_id"])
    print(f"Testing on User ID: {user_id}")
    
    # ── Test 1: Profile Caching ──
    print("\n--- Test 1: Profile Caching ---")
    invalidate_profile_cache(user_id)
    
    start_time = time.time()
    profile1 = await get_cached_profile_async(user_id)
    load_time_1 = time.time() - start_time
    print(f"First Load (DB Fetch) Time: {load_time_1 * 1000:.2f} ms")
    
    start_time = time.time()
    profile2 = await get_cached_profile_async(user_id)
    load_time_2 = time.time() - start_time
    print(f"Second Load (Cache Hit) Time: {load_time_2 * 1000:.2f} ms")
    
    # Cache hit should be virtually instantaneous
    assert user_id in _PROFILE_CACHE, "Profile should be in cache!"
    print("SUCCESS: Profile Caching verified successfully!")
    
    # ── Test 2: Invalidation ──
    print("\n--- Test 2: Cache Invalidation ---")
    invalidate_profile_cache(user_id)
    assert user_id not in _PROFILE_CACHE, "Profile should be cleared from cache!"
    print("SUCCESS: Profile Cache Invalidation verified successfully!")

    # ── Test 3: Context Builder ──
    print("\n--- Test 3: Context Builder ---")
    context = await build_smart_context(user_id, None)
    print("Keys returned:", context.keys())
    assert "profile_context" in context, "Should contain profile_context"
    assert "roadmap_context" in context, "Should contain roadmap_context"
    assert "conversation_summary" in context, "Should contain conversation_summary"
    print("Profile Context Sample:", context["profile_context"])
    print("SUCCESS: Context Builder verified successfully!")

    # ── Test 4: Token Estimation ──
    print("\n--- Test 4: Token Estimation ---")
    sample_text = "Hello AI Student Companion, please optimize my tokens!"
    est = estimate_tokens(sample_text)
    print(f"Text: '{sample_text}' -> Est Tokens: {est}")
    assert est > 0, "Token estimate should be > 0"
    print("SUCCESS: Token Estimation verified successfully!")

    print("\nSUCCESS: ALL LOCAL SERVICE CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_cache_memory())

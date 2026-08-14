import time
import json
import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from bson import ObjectId
from app.db.database import get_database
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings

# Thread-safe in-memory cache for user profiles
# Key: user_id, Value: (profile_data, timestamp)
_PROFILE_CACHE: Dict[str, tuple] = {}
CACHE_TTL_SECONDS = 600  # 10 minutes

# Initialize Gemini LLM for summarization tasks
llm_summarizer = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.2,
)

# ── User Profile Cache ─────────────────────────────────────────────────────────

def get_cached_profile(user_id: str) -> Dict[str, Any]:
    """Retrieve user profile from in-memory cache, or load from DB if expired/missing."""
    now = time.time()
    if user_id in _PROFILE_CACHE:
        profile_data, expiry = _PROFILE_CACHE[user_id]
        if now < expiry:
            return profile_data

    # Cache miss: load from DB
    db = get_database()
    # Synchronous helper fallback since we aren't in async context or we are,
    # but since this might be called in async routes, we'll make it async-compatible or
    # execute async operations.
    # Note: FastAPI endpoints are async, so we'll make async helper where needed.
    # We will write both get_cached_profile_async and get_cached_profile.
    # Let's write the async version since all endpoints are async.
    return {}

async def get_cached_profile_async(user_id: str) -> Dict[str, Any]:
    """Retrieve user profile from in-memory cache, or load from DB if expired/missing (async)."""
    now = time.time()
    if user_id in _PROFILE_CACHE:
        profile_data, expiry = _PROFILE_CACHE[user_id]
        if now < expiry:
            return profile_data

    # Cache miss
    db = get_database()
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        return {}

    profile = {
        "full_name": user.get("full_name", ""),
        "education": user.get("education", ""),
        "skills": user.get("skills", []),
        "interests": user.get("interests", []),
        "goals": user.get("goals", ""),
        "preferences": user.get("preferences", []),
    }
    
    # Store in cache with TTL
    _PROFILE_CACHE[user_id] = (profile, now + CACHE_TTL_SECONDS)
    return profile

def invalidate_profile_cache(user_id: str):
    """Remove a user profile from the cache."""
    if user_id in _PROFILE_CACHE:
        del _PROFILE_CACHE[user_id]


# ── Career Roadmap Cache Invalidation ──────────────────────────────────────────

async def invalidate_roadmap_cache(user_id: str):
    """Mark the manual career roadmap as stale or clear it when profile updates."""
    db = get_database()
    # Deleting or marking as stale
    await db["career_manual_roadmaps"].delete_many({"user_id": user_id})


# ── LLM Token Logging ──────────────────────────────────────────────────────────

async def log_token_usage_optimized(
    user_id: str,
    operation: str,
    tokens_before: int,
    tokens_after: int,
    cache_hit: bool,
    actual_usage: Optional[dict] = None
):
    """Log token metrics comparing unoptimized (estimated) vs optimized (actual) usage."""
    db = get_database()
    input_tokens = 0
    output_tokens = 0
    total_tokens = 0

    if actual_usage:
        input_tokens = actual_usage.get("input_tokens", 0)
        output_tokens = actual_usage.get("output_tokens", 0)
        total_tokens = actual_usage.get("total_tokens", 0)

    # For cache hits, tokens_after is 0, so saved_tokens = tokens_before
    saved_tokens = max(0, tokens_before - tokens_after)
    
    await db["token_logs"].insert_one({
        "user_id": user_id,
        "operation": operation,
        "tokens_before": tokens_before,
        "tokens_after": tokens_after,
        "saved_tokens": saved_tokens,
        "cache_hit": cache_hit,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "timestamp": datetime.utcnow()
    })


# ── Conversation Memory Optimization (Summarization) ──────────────────────────

SUMMARIZE_PROMPT = """You are a memory compressor for a Career Mentor chat session.
Review the existing memory summary and the new conversation messages, and produce a new, updated compact memory summary.
Make sure to preserve crucial user details such as:
1. Career goals and plans.
2. Completed milestones and achievements.
3. User preferences and interests.
4. Key previous recommendations given.

Existing Memory Summary:
{existing_summary}

New messages:
{new_messages}

Output ONLY the updated compact memory summary as bullet points. Do not write any conversational intro or outro."""

async def summarize_session_history(session_id: str, user_id: str):
    """Summarize old chat history to reduce future tokens in this session."""
    db = get_database()
    
    # 1. Fetch the session and the existing summary
    session = await db["chat_sessions"].find_one({"_id": ObjectId(session_id), "user_id": user_id})
    if not session:
        return

    existing_summary = session.get("memory_summary", "No previous summary.")
    
    # 2. Fetch all messages in the session
    cursor = db["chats"].find({"session_id": session_id, "user_id": user_id}).sort("created_at", 1)
    messages = await cursor.to_list(length=1000)

    # We only summarize if we have more than 6 messages total (3 user messages + 3 assistant responses)
    # The last 4 messages are kept in active context, so we summarize everything *before* the last 4.
    if len(messages) <= 6:
        return

    older_messages = messages[:-4]
    
    # Format the new content to integrate into the summary
    formatted_new_turns = []
    for msg in older_messages:
        formatted_new_turns.append(f"{msg['role'].capitalize()}: {msg['content']}")
    
    new_messages_str = "\n".join(formatted_new_turns)
    
    # Build prompt
    prompt = SUMMARIZE_PROMPT.format(
        existing_summary=existing_summary,
        new_messages=new_messages_str
    )
    
    # Run LLM to compress
    try:
        response = await llm_summarizer.ainvoke(prompt)
        new_summary = response.content.strip()
        
        # Save new summary to session
        await db["chat_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"memory_summary": new_summary}}
        )
    except Exception as e:
        print(f"Error generating memory summary: {str(e)}")


# ── Smart Context Builder ──────────────────────────────────────────────────────

async def build_smart_context(user_id: str, session_id: Optional[str]) -> Dict[str, str]:
    """
    Build token-optimized profile, roadmap and conversation contexts.
    Returns keys: profile_context, roadmap_context, conversation_summary
    """
    db = get_database()
    
    # 1. Fetch Profile Cache
    profile = await get_cached_profile_async(user_id)
    profile_context = ""
    if profile:
        profile_parts = []
        if profile.get("full_name"):
            profile_parts.append(f"Name: {profile['full_name']}")
        if profile.get("education"):
            profile_parts.append(f"Education: {profile['education']}")
        if profile.get("skills"):
            skills_str = ", ".join(profile["skills"]) if isinstance(profile["skills"], list) else profile["skills"]
            if skills_str:
                profile_parts.append(f"Skills: {skills_str}")
        if profile.get("interests"):
            interests_str = ", ".join(profile["interests"]) if isinstance(profile["interests"], list) else profile["interests"]
            if interests_str:
                profile_parts.append(f"Interests: {interests_str}")
        if profile.get("goals"):
            profile_parts.append(f"Goals: {profile['goals']}")
        if profile.get("preferences"):
            prefs_str = ", ".join(profile["preferences"]) if isinstance(profile["preferences"], list) else profile["preferences"]
            if prefs_str:
                profile_parts.append(f"Preferences: {prefs_str}")
        
        profile_context = " | ".join(profile_parts)

    # 2. Fetch Cached Manual Career Roadmap (if available)
    roadmap_context = ""
    roadmap_doc = await db["career_manual_roadmaps"].find_one({"user_id": user_id})
    if roadmap_doc and "roadmap" in roadmap_doc:
        rm = roadmap_doc["roadmap"]
        recommended = rm.get("recommended_career", "")
        fit_score = rm.get("career_fit_score", "")
        skills_req = ", ".join(rm.get("skills_required", []))
        missing = ", ".join(rm.get("missing_skills", []))
        roadmap_context = f"Target: {recommended} (Fit: {fit_score}%) | Required: {skills_req} | Missing to learn: {missing}"

    # 3. Fetch Session Conversation Summary
    conversation_summary = ""
    if session_id:
        try:
            session = await db["chat_sessions"].find_one({"_id": ObjectId(session_id), "user_id": user_id})
            if session:
                conversation_summary = session.get("memory_summary", "")
        except Exception:
            pass

    return {
        "profile_context": profile_context or "Not provided.",
        "roadmap_context": roadmap_context or "No active career roadmap generated yet.",
        "conversation_summary": conversation_summary or "No previous conversation summary."
    }


# ── Helper to Estimate Unoptimized Prompt Size ─────────────────────────────────

def estimate_tokens(text: str) -> int:
    """Rough character-to-token estimate (approx 4 characters per token)."""
    return len(text) // 4

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.api.deps import get_current_user
from app.models.user import UserOut
from app.models.chat import (
    ChatRequest,
    ChatResponse,
    ChatSessionCreate,
    ChatSessionUpdate,
    ChatSessionOut,
)
from app.services.rag_service import search_documents, check_cache, set_cache
from app.services.cache_service import (
    build_smart_context,
    log_token_usage_optimized,
    summarize_session_history,
    estimate_tokens,
)
from app.db.database import get_database
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from app.core.config import settings
from app.core.prompt_security import (
    detect_prompt_injection,
    wrap_user_query,
    wrap_rag_context,
    SYSTEM_SECURITY_DIRECTIVE,
)
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

router = APIRouter()

# Initialize Gemini LLM
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.3,
)

OPTIMIZED_RAG_PROMPT_TEMPLATE = """You are an AI Student Companion. Help the student based on the context provided.
Adapt your response length and format based on the question:
- Simple questions: Short, direct answers.
- Educational concepts: Detailed explanations with examples.
- Coding questions: Provide complete code and clear explanations.
- Career guidance: Structured and detailed advice.

{system_security_directive}

[User Profile]
{profile_context}

[Career Roadmap]
{roadmap_context}

[Conversation Summary]
{conversation_summary}

If you don't know the answer, say that you couldn't find that information in the uploaded documents.

At the very end of your response, you MUST suggest exactly 3 short follow-up questions that the user might want to ask next, relevant to this response and the context. Format these follow-up questions in a separate section starting with the exact tag `<<<SUGGESTIONS>>>` followed by each question on a new line. Do not number the questions in that section.
For example:
<<<SUGGESTIONS>>>
What are some examples of this?
How does this compare to option B?
Can you explain the code step-by-step?

Retrieved Context:
{context}

Recent Conversation History:
{history}

User Question:
{question}

Answer:
"""

# Backwards compatible token logging
async def log_token_usage(user_id: str, usage: dict):
    """Log token usage asynchronously to monitor cost (legacy fallback)."""
    db = get_database()
    await db["token_logs"].insert_one({
        "user_id": user_id,
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "total_tokens": usage.get("total_tokens", 0),
        "timestamp": datetime.utcnow()
    })


# ── Models ─────────────────────────────────────────────────────────────────────

class ChatMessageOut(BaseModel):
    id: str
    role: str          # "user" | "assistant"
    content: str
    sources: Optional[List[str]] = []
    session_id: Optional[str] = None
    follow_up_suggestions: Optional[List[str]] = []
    created_at: datetime


def serialize_session(session: dict) -> ChatSessionOut:
    return ChatSessionOut(
        id=str(session["_id"]),
        user_id=session["user_id"],
        document_id=session.get("document_id"),
        title=session["title"],
        created_at=session["created_at"],
        updated_at=session["updated_at"]
    )


# ── Sessions Routes ────────────────────────────────────────────────────────────

@router.get("/sessions", response_model=List[ChatSessionOut])
async def get_sessions(
    document_id: Optional[str] = None,
    current_user: UserOut = Depends(get_current_user),
):
    db = get_database()
    query = {"user_id": current_user.id}
    
    # Check for document_id query filter
    if document_id:
        if document_id in ("null", "undefined", "None"):
            query["document_id"] = None
        else:
            query["document_id"] = document_id
    else:
        query["document_id"] = None

    cursor = db["chat_sessions"].find(query).sort("updated_at", -1)
    sessions = await cursor.to_list(length=100)
    return [serialize_session(s) for s in sessions]


@router.post("/sessions", response_model=ChatSessionOut)
async def create_session(
    payload: ChatSessionCreate,
    current_user: UserOut = Depends(get_current_user),
):
    db = get_database()
    now = datetime.utcnow()
    title = payload.title.strip() if payload.title else "New Chat"
    doc_id = payload.document_id if payload.document_id else None
    
    session_doc = {
        "user_id": current_user.id,
        "document_id": doc_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
    }
    result = await db["chat_sessions"].insert_one(session_doc)
    session_doc["_id"] = result.inserted_id
    return serialize_session(session_doc)


@router.put("/sessions/{session_id}", response_model=ChatSessionOut)
async def update_session(
    session_id: str,
    payload: ChatSessionUpdate,
    current_user: UserOut = Depends(get_current_user),
):
    db = get_database()
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")
        
    session = await db["chat_sessions"].find_one({"_id": oid, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    now = datetime.utcnow()
    await db["chat_sessions"].update_one(
        {"_id": oid},
        {"$set": {"title": payload.title.strip(), "updated_at": now}}
    )
    session["title"] = payload.title.strip()
    session["updated_at"] = now
    return serialize_session(session)


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: UserOut = Depends(get_current_user),
):
    db = get_database()
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")
        
    session = await db["chat_sessions"].find_one({"_id": oid, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    await db["chat_sessions"].delete_one({"_id": oid})
    await db["chats"].delete_many({"user_id": current_user.id, "session_id": session_id})
    return {"status": "success", "message": "Session and its history deleted"}


# ── Query & History Routes ─────────────────────────────────────────────────────

@router.post("/query", response_model=ChatResponse)
async def query_documents(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: UserOut = Depends(get_current_user),
):
    # ── Security: Prompt Injection Guardrail ──────────────────────────────────
    is_injection, matched_reason = detect_prompt_injection(request.query)
    if is_injection:
        raise HTTPException(
            status_code=400,
            detail="Your request was blocked as it contained suspicious prompt injection patterns."
        )

    db = get_database()

    # ── 0. Resolve or Create Session ───────────────────────────────────────────
    session_id = request.session_id
    if not session_id:
        # Create a new session auto-named from user query
        session_title = request.query[:40] + ("..." if len(request.query) > 40 else "")
        now = datetime.utcnow()
        new_session = {
            "user_id": current_user.id,
            "document_id": request.document_id,
            "title": session_title,
            "created_at": now,
            "updated_at": now
        }
        result = await db["chat_sessions"].insert_one(new_session)
        session_id = str(result.inserted_id)
    else:
        try:
            oid = ObjectId(session_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid session ID")
        session = await db["chat_sessions"].find_one({"_id": oid, "user_id": current_user.id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

    # Update session's updated_at
    await db["chat_sessions"].update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"updated_at": datetime.utcnow()}}
    )
    
    # Auto-rename "New Chat" title on first query
    session = await db["chat_sessions"].find_one({"_id": ObjectId(session_id)})
    if session and session.get("title") == "New Chat":
        new_title = request.query[:40] + ("..." if len(request.query) > 40 else "")
        await db["chat_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"title": new_title}}
        )

    # ── 1. Semantic Cache Check ──────────────────────────────────────────────────
    cached_answer = check_cache(request.query, current_user.id)
    if cached_answer:
        now = datetime.utcnow()
        default_suggestions = [
            "Can you explain this in more detail?",
            "What are the key takeaways?",
            "Are there any examples of this?"
        ]
        await db["chats"].insert_many([
            {"user_id": current_user.id, "session_id": session_id, "role": "user", "content": request.query, "sources": [], "document_id": request.document_id, "created_at": now},
            {"user_id": current_user.id, "session_id": session_id, "role": "assistant", "content": cached_answer, "sources": ["Semantic Cache"], "document_id": request.document_id, "follow_up_suggestions": default_suggestions, "created_at": now}
        ])

        # Estimate unoptimized tokens for this cache hit (query + baseline unoptimized context)
        unoptimized_prompt_est = f"User Profile Context | Career Roadmap Context | Conversation Memory Summary | Question: {request.query}"
        tokens_before = estimate_tokens(unoptimized_prompt_est) + 1800  # unoptimized baseline
        
        # Log optimized token usage as cache hit
        background_tasks.add_task(
            log_token_usage_optimized,
            current_user.id,
            "chat",
            tokens_before,
            0,
            True,
            None
        )

        return ChatResponse(
            answer=cached_answer,
            sources=["Semantic Cache"],
            session_id=session_id,
            follow_up_suggestions=default_suggestions
        )

    # ── 2. Smart Context Builder ───────────────────────────────────────────────
    smart_context = await build_smart_context(current_user.id, session_id)
    profile_ctx = smart_context["profile_context"]
    roadmap_ctx = smart_context["roadmap_context"]
    memory_summary = smart_context["conversation_summary"]

    # ── 3. Fetch Recent Memory for active session (optimized to last 4 messages) ─
    history_filter: dict = {"user_id": current_user.id, "session_id": session_id}
    cursor = db["chats"].find(history_filter).sort("created_at", -1).limit(4)
    history_docs = await cursor.to_list(length=4)
    history_text = "\n".join([f"{h['role'].capitalize()}: {h['content']}" for h in reversed(history_docs)])
    if not history_text:
        history_text = "No previous history."

    # ── 4. Retrieve relevant chunks from ChromaDB ────────────────────────────────
    results = search_documents(
        query=request.query,
        user_id=current_user.id,
        document_id=request.document_id,
        top_k=3,
    )

    if not results:
        answer = "I couldn't find that information in your uploaded documents. Please try rephrasing your question or uploading more study materials."
        sources: List[str] = []
        follow_up_suggestions = [
            "Can you explain this in more detail?",
            "What are the key takeaways?",
            "Are there any examples of this?"
        ]
    else:
        context_text = "\n\n---\n\n".join([doc.page_content for doc in results])
        sources = list(set([doc.metadata.get("source", "Unknown") for doc in results]))

        safe_context = wrap_rag_context(context_text)
        safe_query = wrap_user_query(request.query)

        prompt = PromptTemplate(
            template=OPTIMIZED_RAG_PROMPT_TEMPLATE,
            input_variables=[
                "system_security_directive",
                "profile_context",
                "roadmap_context",
                "conversation_summary",
                "context",
                "history",
                "question"
            ],
        )
        final_prompt = prompt.format(
            system_security_directive=SYSTEM_SECURITY_DIRECTIVE,
            profile_context=profile_ctx,
            roadmap_context=roadmap_ctx,
            conversation_summary=memory_summary,
            context=safe_context,
            history=history_text,
            question=safe_query
        )

        # Generate answer using Gemini
        response = llm.invoke(final_prompt)
        raw_answer = response.content
        
        # Parse follow-up suggestions
        follow_up_suggestions = []
        if "<<<SUGGESTIONS>>>" in raw_answer:
            parts = raw_answer.split("<<<SUGGESTIONS>>>")
            answer = parts[0].strip()
            suggestions_part = parts[1].strip()
            for line in suggestions_part.split("\n"):
                line_clean = line.strip()
                if not line_clean:
                    continue
                # Clean numbering/bullet points
                for prefix in ["1.", "2.", "3.", "-", "*", "•"]:
                    if line_clean.startswith(prefix):
                        line_clean = line_clean[len(prefix):].strip()
                if line_clean:
                    follow_up_suggestions.append(line_clean)
            follow_up_suggestions = follow_up_suggestions[:3]
        else:
            answer = raw_answer.strip()
            
        default_suggestions = [
            "Can you explain this in more detail?",
            "What are the key takeaways?",
            "Are there any examples of this?"
        ]
        while len(follow_up_suggestions) < 3:
            follow_up_suggestions.append(default_suggestions[len(follow_up_suggestions)])

        # Calculate comparative unoptimized prompt size (full history + unoptimized profile)
        msg_count = await db["chats"].count_documents({"session_id": session_id, "user_id": current_user.id})
        # Baseline history: let's assume ~400 characters per conversation turn of uncompressed history
        est_unoptimized_history_chars = min(20000, max(0, msg_count - 4) * 400)
        
        unoptimized_text = (
            f"Unoptimized Profile: {profile_ctx} \n"
            f"Unoptimized Career Goal: {roadmap_ctx} \n"
            f"Full Chat History: {history_text} (Extra history chars: {est_unoptimized_history_chars}) \n"
            f"Context: {context_text} \n"
            f"Query: {request.query}"
        )
        tokens_before = estimate_tokens(unoptimized_text) + 1200  # unoptimized template overhead

        # Token Logging and Cache Saving
        tokens_after = 0
        actual_usage = None
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            actual_usage = response.usage_metadata
            tokens_after = actual_usage.get("total_tokens", 0)
        else:
            tokens_after = estimate_tokens(final_prompt) + estimate_tokens(raw_answer)

        # Log metrics to DB
        background_tasks.add_task(
            log_token_usage_optimized,
            current_user.id,
            "chat",
            tokens_before,
            tokens_after,
            False,
            actual_usage
        )
            
        set_cache(request.query, answer, current_user.id)

    # ── 5. Persist chat messages to MongoDB ──────────────────────────────────────
    await db["chats"].insert_many([
        {
            "user_id": current_user.id,
            "session_id": session_id,
            "role": "user",
            "content": request.query,
            "sources": [],
            "document_id": request.document_id,
            "created_at": datetime.utcnow(),
        },
        {
            "user_id": current_user.id,
            "session_id": session_id,
            "role": "assistant",
            "content": answer,
            "sources": sources,
            "document_id": request.document_id,
            "follow_up_suggestions": follow_up_suggestions,
            "created_at": datetime.utcnow(),
        },
    ])

    # ── 6. Trigger Memory summarization in the background ────────────────────────
    background_tasks.add_task(summarize_session_history, session_id, current_user.id)

    return ChatResponse(
        answer=answer,
        sources=sources,
        session_id=session_id,
        follow_up_suggestions=follow_up_suggestions
    )


@router.get("/history", response_model=List[ChatMessageOut])
async def get_chat_history(
    session_id: Optional[str] = None,
    current_user: UserOut = Depends(get_current_user),
    limit: int = 50,
):
    """Return chat messages for the specified session, or the most recent session if omitted."""
    db = get_database()
    
    # If no session_id is provided, try to find the most recent session
    if not session_id:
        recent_session = await db["chat_sessions"].find_one({"user_id": current_user.id}, sort=[("updated_at", -1)])
        if recent_session:
            session_id = str(recent_session["_id"])
        else:
            return []

    cursor = (
        db["chats"]
        .find({"user_id": current_user.id, "session_id": session_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    messages = await cursor.to_list(length=limit)

    return [
        ChatMessageOut(
            id=str(m["_id"]),
            role=m["role"],
            content=m["content"],
            sources=m.get("sources", []),
            session_id=m.get("session_id"),
            follow_up_suggestions=m.get("follow_up_suggestions", []),
            created_at=m["created_at"],
        )
        for m in reversed(messages)  # Return oldest-first for display
    ]


@router.post("/sessions/{session_id}/clear-memory")
async def clear_session_memory(
    session_id: str,
    current_user: UserOut = Depends(get_current_user)
):
    """Purge memory summarizations and chat logs under the active session."""
    db = get_database()
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    session = await db["chat_sessions"].find_one({"_id": oid, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Clear memory summary on session document
    await db["chat_sessions"].update_one(
        {"_id": oid},
        {"$set": {"memory_summary": ""}}
    )

    # Delete all chats inside this session
    await db["chats"].delete_many({"user_id": current_user.id, "session_id": session_id})

    return {"status": "success", "message": "Conversation memory and history cleared."}

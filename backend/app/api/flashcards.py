from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.models.user import UserOut
from app.models.flashcard import (
    FlashcardGenerateRequest, FlashcardDeckInDB, FlashcardDeckOut, FlashcardItem
)
from app.services.rag_service import search_documents
from app.db.database import get_database
from app.core.config import settings
from langchain_google_genai import ChatGoogleGenerativeAI
from typing import List
from bson import ObjectId
from datetime import datetime, timedelta
from pydantic import BaseModel
import json
import re

from app.core.prompt_security import detect_prompt_injection, sanitize_rag_context, wrap_rag_context, SYSTEM_SECURITY_DIRECTIVE

router = APIRouter()


class FlashcardReviewRequest(BaseModel):
    rating: int  # 1: Again, 2: Hard, 3: Good, 4: Easy


def count_due_cards(cards: list, now: datetime) -> int:
    count = 0
    for c in cards:
        next_rev = None
        if isinstance(c, dict):
            next_rev = c.get("next_review")
        else:
            next_rev = getattr(c, "next_review", None)
        
        if next_rev is None:
            count += 1
        elif isinstance(next_rev, str):
            try:
                dt = datetime.fromisoformat(next_rev.replace("Z", "+00:00")).replace(tzinfo=None)
                if dt <= now:
                    count += 1
            except:
                count += 1
        elif isinstance(next_rev, datetime):
            dt = next_rev.replace(tzinfo=None)
            if dt <= now:
                count += 1
    return count


llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.3
)

FLASHCARD_PROMPT = """You are an expert educator. Create {num_cards} educational flashcards from the following content.

{system_security_directive}

Content:
{context}

Return ONLY a valid JSON array of objects. Each object must have exactly this structure:
{{
  "front": "Question or term on the front of the card",
  "back": "Answer or definition on the back of the card"
}}

Make the flashcards clear, concise, and educational. Cover key concepts.
Do not include any text before or after the JSON array."""


@router.post("/generate", response_model=FlashcardDeckOut)
async def generate_flashcards(
    request: FlashcardGenerateRequest,
    current_user: UserOut = Depends(get_current_user)
):
    if request.topic:
        is_inj, _ = detect_prompt_injection(request.topic)
        if is_inj:
            raise HTTPException(status_code=400, detail="Invalid topic: Contains suspicious prompt patterns.")

    db = get_database()
    context = ""
    doc_name = None

    if request.document_id or (not request.topic):
        results = search_documents(
            query=request.topic or "key concepts and definitions",
            user_id=current_user.id,
            document_id=request.document_id,
            top_k=5 # Optimized from 10
        )
        if results:
            context = "\n\n".join([doc.page_content for doc in results])
            doc_name = results[0].metadata.get("source") if results else None
        elif request.topic:
            context = request.topic
        else:
            raise HTTPException(status_code=400, detail="No documents found. Upload a document or provide a topic.")

    if request.topic and not context:
        context = request.topic
    elif request.topic and context:
        context = f"Topic: {request.topic}\n\nContent:\n{context}"

    safe_context = wrap_rag_context(context[:4000])

    prompt = FLASHCARD_PROMPT.format(
        system_security_directive=SYSTEM_SECURITY_DIRECTIVE,
        num_cards=request.num_cards,
        context=safe_context
    )

    response = llm.invoke(prompt)
    raw = response.content.strip()

    match = re.search(r'\[.*\]', raw, re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="Failed to parse flashcards from AI response")

    try:
        cards_data = json.loads(match.group())
        cards = [FlashcardItem(**c) for c in cards_data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flashcard parsing error: {str(e)}")

    deck_name = request.deck_name or doc_name or request.topic or "My Flashcard Deck"

    deck = FlashcardDeckInDB(
        user_id=current_user.id,
        deck_name=deck_name,
        cards=cards,
        document_id=request.document_id,
        topic=request.topic
    )

    result = await db["flashcard_decks"].insert_one(deck.model_dump())

    return FlashcardDeckOut(
        id=str(result.inserted_id),
        deck_name=deck.deck_name,
        cards=cards,
        document_id=deck.document_id,
        topic=deck.topic,
        created_at=deck.created_at,
        card_count=len(cards),
        due_count=len(cards)
    )


@router.get("/", response_model=List[FlashcardDeckOut])
async def list_flashcard_decks(current_user: UserOut = Depends(get_current_user)):
    db = get_database()
    cursor = db["flashcard_decks"].find({"user_id": current_user.id}).sort("created_at", -1)
    decks = await cursor.to_list(length=50)

    now = datetime.utcnow()
    return [
        FlashcardDeckOut(
            id=str(d["_id"]),
            deck_name=d["deck_name"],
            cards=d["cards"],
            document_id=d.get("document_id"),
            topic=d.get("topic"),
            created_at=d["created_at"],
            card_count=len(d["cards"]),
            due_count=count_due_cards(d["cards"], now)
        )
        for d in decks
    ]


@router.get("/{deck_id}", response_model=FlashcardDeckOut)
async def get_flashcard_deck(
    deck_id: str,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    deck = await db["flashcard_decks"].find_one(
        {"_id": ObjectId(deck_id), "user_id": current_user.id}
    )
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
        
    now = datetime.utcnow()
    due_count = count_due_cards(deck["cards"], now)
    
    return FlashcardDeckOut(
        id=str(deck["_id"]),
        deck_name=deck["deck_name"],
        cards=deck["cards"],
        document_id=deck.get("document_id"),
        topic=deck.get("topic"),
        created_at=deck["created_at"],
        card_count=len(deck["cards"]),
        due_count=due_count
    )


@router.post("/{deck_id}/cards/{card_index}/review", response_model=FlashcardDeckOut)
async def review_flashcard(
    deck_id: str,
    card_index: int,
    request: FlashcardReviewRequest,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    deck_in_db = await db["flashcard_decks"].find_one(
        {"_id": ObjectId(deck_id), "user_id": current_user.id}
    )
    if not deck_in_db:
        raise HTTPException(status_code=404, detail="Deck not found")
        
    cards = deck_in_db.get("cards", [])
    if card_index < 0 or card_index >= len(cards):
        raise HTTPException(status_code=404, detail="Card index out of range")
        
    card = cards[card_index]
    
    repetitions = card.get("repetitions", 0)
    interval = card.get("interval", 0)
    ease_factor = card.get("ease_factor", 2.5)
    
    rating = request.rating
    if rating not in [1, 2, 3, 4]:
        raise HTTPException(status_code=400, detail="Rating must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy)")
        
    # Map 1-4 rating to SM-2 quality 1-5 (where 1=Forgot/Again, 3=Hard, 4=Good, 5=Easy)
    quality_map = {1: 1, 2: 3, 3: 4, 4: 5}
    quality = quality_map[rating]
    
    if quality < 3:
        # Failure
        repetitions = 0
        interval = 1
    else:
        # Success
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = int(round(interval * ease_factor))
        repetitions += 1
        
    # Adjust ease factor
    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    ease_factor = max(1.3, ease_factor)
    
    now = datetime.utcnow()
    next_review = now + timedelta(days=interval)
    
    # Update card properties
    card["repetitions"] = repetitions
    card["interval"] = interval
    card["ease_factor"] = ease_factor
    card["next_review"] = next_review
    
    # Save back to database
    await db["flashcard_decks"].update_one(
        {"_id": ObjectId(deck_id)},
        {"$set": {f"cards.{card_index}": card}}
    )
    
    # Return updated deck
    updated_deck = await db["flashcard_decks"].find_one({"_id": ObjectId(deck_id)})
    due_count = count_due_cards(updated_deck["cards"], now)
    
    return FlashcardDeckOut(
        id=str(updated_deck["_id"]),
        deck_name=updated_deck["deck_name"],
        cards=updated_deck["cards"],
        document_id=updated_deck.get("document_id"),
        topic=updated_deck.get("topic"),
        created_at=updated_deck["created_at"],
        card_count=len(updated_deck["cards"]),
        due_count=due_count
    )


@router.delete("/{deck_id}")
async def delete_flashcard_deck(
    deck_id: str,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    result = await db["flashcard_decks"].delete_one(
        {"_id": ObjectId(deck_id), "user_id": current_user.id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Deck not found")
    return {"message": "Deck deleted"}


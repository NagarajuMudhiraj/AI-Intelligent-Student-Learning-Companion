from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.models.user import UserOut
from app.db.database import get_database
from app.core.security import get_password_hash, verify_password
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId

router = APIRouter()


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    education: Optional[str] = None
    skills: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    goals: Optional[str] = None
    preferences: Optional[List[str]] = None


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str


class ProfileOut(BaseModel):
    id: str
    email: str
    full_name: str
    education: Optional[str] = ""
    skills: Optional[List[str]] = []
    interests: Optional[List[str]] = []
    goals: Optional[str] = ""
    preferences: Optional[List[str]] = []


@router.get("/profile", response_model=ProfileOut)
async def get_profile(current_user: UserOut = Depends(get_current_user)):
    return ProfileOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        education=current_user.education or "",
        skills=current_user.skills or [],
        interests=current_user.interests or [],
        goals=current_user.goals or "",
        preferences=current_user.preferences or []
    )


@router.put("/profile", response_model=ProfileOut)
async def update_profile(
    updates: ProfileUpdate,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    update_data = {k: v for k, v in updates.dict().items() if v is not None}

    if update_data:
        await db["users"].update_one(
            {"_id": ObjectId(current_user.id)},
            {"$set": update_data}
        )
        # Clear/invalidate memory and career roadmap cache when profile updates
        from app.services.cache_service import invalidate_profile_cache, invalidate_roadmap_cache
        invalidate_profile_cache(current_user.id)
        await invalidate_roadmap_cache(current_user.id)

    user = await db["users"].find_one({"_id": ObjectId(current_user.id)})
    return ProfileOut(
        id=str(user["_id"]),
        email=user["email"],
        full_name=user.get("full_name", ""),
        education=user.get("education", ""),
        skills=user.get("skills", []),
        interests=user.get("interests", []),
        goals=user.get("goals", ""),
        preferences=user.get("preferences", [])
    )


@router.put("/password")
async def update_password(
    data: PasswordUpdate,
    current_user: UserOut = Depends(get_current_user)
):
    db = get_database()
    user = await db["users"].find_one({"_id": ObjectId(current_user.id)})

    if not verify_password(data.current_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_hash = get_password_hash(data.new_password)
    await db["users"].update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"hashed_password": new_hash}}
    )

    return {"message": "Password updated successfully"}


@router.delete("/account")
async def delete_account(current_user: UserOut = Depends(get_current_user)):
    db = get_database()
    uid = current_user.id
    # Delete all user data
    await db["users"].delete_one({"_id": ObjectId(uid)})
    await db["documents"].delete_many({"user_id": uid})
    await db["quiz_attempts"].delete_many({"user_id": uid})
    await db["flashcard_decks"].delete_many({"user_id": uid})
    await db["study_tasks"].delete_many({"user_id": uid})
    return {"message": "Account deleted"}

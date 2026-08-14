from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from app.models.user import UserCreate, UserOut, Token, UserInDB, ForgotPasswordRequest, ResetPasswordRequest
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.audit_logger import log_security_event
from app.api.deps import get_current_user
from app.db.database import get_database
from app.core.config import settings
from bson import ObjectId
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests
import secrets
import hashlib
from datetime import datetime, timedelta, timezone

router = APIRouter()

class GoogleAuthRequest(BaseModel):
    credential: str

@router.post("/register", response_model=UserOut)
async def register(user_in: UserCreate, request: Request):
    db = get_database()
    client_ip = request.client.host if request.client else "UNKNOWN"
    
    # Check if user already exists
    existing_user = await db["users"].find_one({"email": user_in.email})
    if existing_user:
        await log_security_event(
            event_type="REGISTER_FAILED_DUPLICATE",
            email=user_in.email,
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    # Create new user
    user_dict = user_in.model_dump()
    user_dict["hashed_password"] = get_password_hash(user_dict.pop("password"))
    user_in_db = UserInDB(**user_dict)

    result = await db["users"].insert_one(user_in_db.model_dump())
    user_id = str(result.inserted_id)

    await log_security_event(
        event_type="REGISTER_SUCCESS",
        user_id=user_id,
        email=user_in_db.email,
        ip_address=client_ip,
    )

    return UserOut(
        id=user_id,
        email=user_in_db.email,
        full_name=user_in_db.full_name,
        is_active=user_in_db.is_active,
        is_verified=user_in_db.is_verified,
    )


@router.post("/login", response_model=Token)
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_database()
    client_ip = request.client.host if request.client else "UNKNOWN"
    
    user = await db["users"].find_one({"email": form_data.username})
    if not user:
        await log_security_event(
            event_type="LOGIN_FAILED_NO_USER",
            email=form_data.username,
            ip_address=client_ip,
        )
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if not user.get("hashed_password") or not verify_password(form_data.password, user["hashed_password"]):
        await log_security_event(
            event_type="LOGIN_FAILED_INVALID_PASSWORD",
            user_id=str(user["_id"]),
            email=form_data.username,
            ip_address=client_ip,
        )
        raise HTTPException(status_code=400, detail="Incorrect email or password. If you signed up with Google, please use Google Login.")

    access_token = create_access_token(subject=str(user["_id"]))

    await log_security_event(
        event_type="LOGIN_SUCCESS",
        user_id=str(user["_id"]),
        email=form_data.username,
        ip_address=client_ip,
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/google", response_model=Token)
async def google_auth(req: Request, auth_req: GoogleAuthRequest):
    client_ip = req.client.host if req.client else "UNKNOWN"
    try:
        # Verify the Google JWT token
        idinfo = id_token.verify_oauth2_token(
            auth_req.credential, 
            requests.Request(), 
            settings.GOOGLE_CLIENT_ID
        )

        email = idinfo.get('email')
        name = idinfo.get('name', 'Google User')
        google_id = idinfo.get('sub')
        picture = idinfo.get('picture')

        db = get_database()
        
        # Check if user exists
        user = await db["users"].find_one({"email": email})
        
        if not user:
            # Register new user without a password
            user_in_db = UserInDB(
                email=email,
                full_name=name,
                google_id=google_id,
                picture=picture,
                hashed_password=None,
                is_verified=True
            )
            result = await db["users"].insert_one(user_in_db.model_dump())
            user_id = str(result.inserted_id)
        else:
            # Update existing user with google_id if missing
            user_id = str(user["_id"])
            if not user.get("google_id"):
                await db["users"].update_one(
                    {"_id": user["_id"]},
                    {"$set": {"google_id": google_id, "picture": picture, "is_verified": True}}
                )

        access_token = create_access_token(subject=user_id)

        await log_security_event(
            event_type="GOOGLE_LOGIN_SUCCESS",
            user_id=user_id,
            email=email,
            ip_address=client_ip,
        )

        return {"access_token": access_token, "token_type": "bearer"}

    except ValueError as e:
        await log_security_event(
            event_type="GOOGLE_LOGIN_FAILED",
            ip_address=client_ip,
            details={"error": str(e)}
        )
        raise HTTPException(status_code=400, detail=f"Invalid Google authentication token: {str(e)}")


@router.post("/forgot-password")
async def forgot_password(req: Request, forgot_in: ForgotPasswordRequest):
    client_ip = req.client.host if req.client else "UNKNOWN"
    db = get_database()
    
    user = await db["users"].find_one({"email": forgot_in.email})
    
    # Generic response to prevent user enumeration
    success_msg = "If an account with that email exists, a password reset token has been generated."
    
    if not user:
        await log_security_event(
            event_type="PASSWORD_RESET_REQUEST_NOT_FOUND",
            email=forgot_in.email,
            ip_address=client_ip,
        )
        return {"message": success_msg}
    
    # Generate 32-byte secure token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # Save hashed token in DB
    await db["password_resets"].insert_one({
        "user_id": str(user["_id"]),
        "email": forgot_in.email,
        "token_hash": token_hash,
        "expires_at": expires_at,
        "used": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    await log_security_event(
        event_type="PASSWORD_RESET_REQUESTED",
        user_id=str(user["_id"]),
        email=forgot_in.email,
        ip_address=client_ip,
    )
    
    # Return reset_token (in production, this token is emailed to user)
    return {
        "message": success_msg,
        "reset_token": raw_token,
        "expires_in_minutes": 15
    }


@router.post("/reset-password")
async def reset_password(req: Request, reset_in: ResetPasswordRequest):
    client_ip = req.client.host if req.client else "UNKNOWN"
    db = get_database()
    
    if len(reset_in.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters long.")
    
    token_hash = hashlib.sha256(reset_in.token.encode('utf-8')).hexdigest()
    
    reset_record = await db["password_resets"].find_one({
        "token_hash": token_hash,
        "used": False
    })
    
    if not reset_record:
        await log_security_event(
            event_type="PASSWORD_RESET_FAILED_INVALID_TOKEN",
            ip_address=client_ip,
        )
        raise HTTPException(status_code=400, detail="Invalid or already used password reset token.")
    
    # Check expiry
    expires_at = reset_record["expires_at"]
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            await log_security_event(
                event_type="PASSWORD_RESET_FAILED_EXPIRED_TOKEN",
                email=reset_record.get("email"),
                ip_address=client_ip,
            )
            raise HTTPException(status_code=400, detail="Password reset token has expired. Please request a new one.")
    
    # Hash new password and update user
    new_hashed_password = get_password_hash(reset_in.new_password)
    await db["users"].update_one(
        {"_id": ObjectId(reset_record["user_id"])},
        {"$set": {"hashed_password": new_hashed_password}}
    )
    
    # Mark reset token as used
    await db["password_resets"].update_one(
        {"_id": reset_record["_id"]},
        {"$set": {"used": True}}
    )
    
    await log_security_event(
        event_type="PASSWORD_RESET_SUCCESS",
        user_id=reset_record.get("user_id"),
        email=reset_record.get("email"),
        ip_address=client_ip,
    )
    
    return {"message": "Password successfully reset. You may now log in with your new password."}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: UserOut = Depends(get_current_user)):
    """Return the currently authenticated user's profile (name, email, id)."""
    return current_user

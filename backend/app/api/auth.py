"""Authentication & User Session router for Autonomous AI Data Analyst Studio.

Supports:
1. Mobile Number + Name with 6-digit OTP (5-minute expiry)
2. Email with 6-digit OTP (5-minute expiry)
3. Google Sign-In
4. User-scoped project and chat persistence
"""

import logging
import os
import random
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

logger = logging.getLogger("auth")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# In-memory stores for development / persistence
OTP_STORE: Dict[str, Dict[str, Any]] = {}
USERS_STORE: Dict[str, Dict[str, Any]] = {}
SESSIONS_STORE: Dict[str, str] = {}  # token -> user_id
USER_PROJECTS: Dict[str, List[Dict[str, Any]]] = {}  # user_id -> list of projects
USER_CHATS: Dict[str, List[Dict[str, Any]]] = {}  # user_id -> list of chat sessions

OTP_EXPIRY_MINUTES = 5


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SendOTPRequest(BaseModel):
    channel: str = Field(..., description="'mobile' or 'email'")
    destination: str = Field(..., description="Phone number (with country code) or email address")
    name: Optional[str] = Field(None, description="User's full name (for mobile sign up)")


class SendOTPResponse(BaseModel):
    success: bool
    channel: str
    destination: str
    message: str
    expires_in_seconds: int
    dev_code: Optional[str] = Field(None, description="Provided in development mode for easy local verification")


class VerifyOTPRequest(BaseModel):
    channel: str = Field(..., description="'mobile' or 'email'")
    destination: str = Field(..., description="Phone number or email address")
    code: str = Field(..., description="6-digit verification code")
    name: Optional[str] = Field(None, description="Optional full name if not sent earlier")


class GoogleAuthRequest(BaseModel):
    name: str = Field(..., description="Full Name from Google profile")
    email: str = Field(..., description="Email address from Google profile")
    avatar_url: Optional[str] = Field(None, description="Profile picture URL")
    google_id: Optional[str] = Field(None, description="Google OAuth subject ID")


class AppleAuthRequest(BaseModel):
    email: Optional[str] = Field("user@icloud.com", description="Apple ID email")
    name: Optional[str] = Field("Apple User", description="User name")


class EmailDirectRequest(BaseModel):
    email: str = Field(..., description="User's email address")
    name: Optional[str] = Field(None, description="User name")


class UserProfile(BaseModel):
    id: str
    name: str
    identifier: str  # email or phone
    auth_type: str  # 'mobile', 'email', 'google'
    avatar_url: Optional[str] = None
    created_at: str


class AuthResponse(BaseModel):
    success: bool
    session_token: str
    user: UserProfile
    message: str


class ProjectItem(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = ""
    created_at: str
    dataset_id: Optional[str] = None
    status: Optional[str] = "active"


class ChatSessionItem(BaseModel):
    id: str
    user_id: str
    title: str
    messages: List[Dict[str, Any]] = []
    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def generate_otp_code() -> str:
    """Generate a secure 6-digit numeric OTP."""
    return "".join(secrets.choice(string.digits) for _ in range(6))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/otp/send", response_model=SendOTPResponse)
async def send_otp(req: SendOTPRequest):
    """Generate and dispatch a 6-digit OTP code to mobile number or email."""
    destination = req.destination.strip().lower() if req.channel == "email" else req.destination.strip()
    if not destination:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination (phone number or email) cannot be empty."
        )

    # Generate 6-digit OTP
    code = generate_otp_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    OTP_STORE[destination] = {
        "code": code,
        "expires_at": expires_at,
        "channel": req.channel,
        "name": req.name or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Log clearly to backend console for developer visibility
    print(f"\n[AUTH] ===================================================")
    print(f"[AUTH] >>> OTP DISPATCHED TO {req.channel.upper()}: {destination}")
    print(f"[AUTH] >>> 6-DIGIT VERIFICATION CODE: {code}")
    print(f"[AUTH] >>> EXPIRES IN: {OTP_EXPIRY_MINUTES} minutes")
    print(f"[AUTH] ===================================================\n")

    return SendOTPResponse(
        success=True,
        channel=req.channel,
        destination=destination,
        message=f"Verification code sent to {destination}. Valid for {OTP_EXPIRY_MINUTES} minutes.",
        expires_in_seconds=OTP_EXPIRY_MINUTES * 60,
        dev_code=code,  # Returns dev_code for convenient automated/local testing
    )


@router.post("/otp/verify", response_model=AuthResponse)
async def verify_otp(req: VerifyOTPRequest):
    """Verify the 6-digit OTP code and authenticate/register the user."""
    destination = req.destination.strip().lower() if req.channel == "email" else req.destination.strip()
    code = req.code.strip()

    record = OTP_STORE.get(destination)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP found for this destination. Please request a new code.",
        )

    # Check expiry
    if datetime.now(timezone.utc) > record["expires_at"]:
        OTP_STORE.pop(destination, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification code has expired (validity is 5 minutes). Please request a new one.",
        )

    # Check code match
    if record["code"] != code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect verification code. Please check and re-enter.",
        )

    # Code matches - consume it
    name = req.name or record.get("name")
    if not name:
        if req.channel == "email":
            name = destination.split("@")[0].capitalize()
        else:
            name = f"User {destination[-4:]}" if len(destination) >= 4 else "User"

    OTP_STORE.pop(destination, None)

    # Find or create user
    user_id = None
    for uid, u in USERS_STORE.items():
        if u.get("identifier") == destination:
            user_id = uid
            break

    if not user_id:
        user_id = f"usr_{secrets.token_hex(6)}"
        USERS_STORE[user_id] = {
            "id": user_id,
            "name": name,
            "identifier": destination,
            "auth_type": req.channel,
            "avatar_url": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    else:
        if name and USERS_STORE[user_id].get("name") != name:
            USERS_STORE[user_id]["name"] = name

    # Create session token
    session_token = secrets.token_urlsafe(32)
    SESSIONS_STORE[session_token] = user_id

    user_info = USERS_STORE[user_id]
    profile = UserProfile(
        id=user_info["id"],
        name=user_info["name"],
        identifier=user_info["identifier"],
        auth_type=user_info["auth_type"],
        avatar_url=user_info.get("avatar_url"),
        created_at=user_info["created_at"],
    )

    return AuthResponse(
        success=True,
        session_token=session_token,
        user=profile,
        message=f"Welcome back, {profile.name}!",
    )


@router.post("/google", response_model=AuthResponse)
async def google_auth(req: GoogleAuthRequest):
    """Authenticate or register a user via Google Sign-In."""
    email = req.email.strip().lower()
    name = req.name.strip() or email.split("@")[0].capitalize()

    user_id = None
    for uid, u in USERS_STORE.items():
        if u.get("identifier") == email:
            user_id = uid
            break

    if not user_id:
        user_id = f"usr_{secrets.token_hex(6)}"
        USERS_STORE[user_id] = {
            "id": user_id,
            "name": name,
            "identifier": email,
            "auth_type": "google",
            "avatar_url": req.avatar_url,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    else:
        USERS_STORE[user_id]["name"] = name
        if req.avatar_url:
            USERS_STORE[user_id]["avatar_url"] = req.avatar_url

    session_token = secrets.token_urlsafe(32)
    SESSIONS_STORE[session_token] = user_id

    user_info = USERS_STORE[user_id]
    profile = UserProfile(
        id=user_info["id"],
        name=user_info["name"],
        identifier=user_info["identifier"],
        auth_type=user_info["auth_type"],
        avatar_url=user_info.get("avatar_url"),
        created_at=user_info["created_at"],
    )

    return AuthResponse(
        success=True,
        session_token=session_token,
        user=profile,
        message=f"Welcome, {profile.name}!",
    )


@router.post("/apple", response_model=AuthResponse)
async def apple_auth(req: AppleAuthRequest):
    """Authenticate or register a user via Apple Sign-In."""
    email = (req.email or "apple.user@privaterelay.appleid.com").strip().lower()
    name = req.name.strip() if req.name else email.split("@")[0].capitalize()

    user_id = None
    for uid, u in USERS_STORE.items():
        if u.get("identifier") == email:
            user_id = uid
            break

    if not user_id:
        user_id = f"usr_{secrets.token_hex(6)}"
        USERS_STORE[user_id] = {
            "id": user_id,
            "name": name,
            "identifier": email,
            "auth_type": "apple",
            "avatar_url": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    session_token = secrets.token_urlsafe(32)
    SESSIONS_STORE[session_token] = user_id

    user_info = USERS_STORE[user_id]
    profile = UserProfile(
        id=user_info["id"],
        name=user_info["name"],
        identifier=user_info["identifier"],
        auth_type=user_info["auth_type"],
        avatar_url=user_info.get("avatar_url"),
        created_at=user_info["created_at"],
    )

    return AuthResponse(
        success=True,
        session_token=session_token,
        user=profile,
        message=f"Welcome, {profile.name}!",
    )


@router.post("/email-direct", response_model=AuthResponse)
async def email_direct_auth(req: EmailDirectRequest):
    """Authenticate or register directly via email."""
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please enter a valid email address.")

    name = req.name.strip() if req.name else email.split("@")[0].replace(".", " ").capitalize()

    user_id = None
    for uid, u in USERS_STORE.items():
        if u.get("identifier") == email:
            user_id = uid
            break

    if not user_id:
        user_id = f"usr_{secrets.token_hex(6)}"
        USERS_STORE[user_id] = {
            "id": user_id,
            "name": name,
            "identifier": email,
            "auth_type": "email",
            "avatar_url": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    session_token = secrets.token_urlsafe(32)
    SESSIONS_STORE[session_token] = user_id

    user_info = USERS_STORE[user_id]
    profile = UserProfile(
        id=user_info["id"],
        name=user_info["name"],
        identifier=user_info["identifier"],
        auth_type=user_info["auth_type"],
        avatar_url=user_info.get("avatar_url"),
        created_at=user_info["created_at"],
    )

    return AuthResponse(
        success=True,
        session_token=session_token,
        user=profile,
        message=f"Welcome, {profile.name}!",
    )


@router.get("/me", response_model=UserProfile)
async def get_current_user(token: str):
    """Retrieve profile for active session token."""
    user_id = SESSIONS_STORE.get(token)
    if not user_id or user_id not in USERS_STORE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session token.")
    u = USERS_STORE[user_id]
    return UserProfile(
        id=u["id"],
        name=u["name"],
        identifier=u["identifier"],
        auth_type=u["auth_type"],
        avatar_url=u.get("avatar_url"),
        created_at=u["created_at"],
    )


# ---------------------------------------------------------------------------
# User Projects & Chats Persistence
# ---------------------------------------------------------------------------

@router.get("/projects", response_model=List[ProjectItem])
async def list_user_projects(user_id: str):
    """Return projects belonging to the given user."""
    projects = USER_PROJECTS.get(user_id, [])
    if not projects:
        starter_projects = [
            {
                "id": f"proj_sample_churn_{user_id[:6]}",
                "user_id": user_id,
                "name": "Customer Churn & Retention Model",
                "description": "Exploratory analysis and root-cause drivers for SaaS subscription drop-off.",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "dataset_id": "sample_churn",
                "status": "active",
            },
            {
                "id": f"proj_sample_retail_{user_id[:6]}",
                "user_id": user_id,
                "name": "Omnichannel Retail Star Schema",
                "description": "DuckDB star schema modeling with verified DAX measures.",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "dataset_id": "sample_retail",
                "status": "active",
            }
        ]
        USER_PROJECTS[user_id] = starter_projects
        return starter_projects
    return projects


class CreateProjectRequest(BaseModel):
    user_id: str
    name: str
    description: Optional[str] = ""
    dataset_id: Optional[str] = None


@router.post("/projects", response_model=ProjectItem)
async def create_user_project(req: CreateProjectRequest):
    """Create a new project workspace for the authenticated user."""
    project_id = f"proj_{secrets.token_hex(5)}"
    project = {
        "id": project_id,
        "user_id": req.user_id,
        "name": req.name.strip(),
        "description": req.description or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "dataset_id": req.dataset_id,
        "status": "active",
    }
    if req.user_id not in USER_PROJECTS:
        USER_PROJECTS[req.user_id] = []
    USER_PROJECTS[req.user_id].insert(0, project)
    return project


@router.delete("/projects/{project_id}")
async def delete_user_project(project_id: str, user_id: str):
    """Delete a user's project."""
    if user_id in USER_PROJECTS:
        USER_PROJECTS[user_id] = [p for p in USER_PROJECTS[user_id] if p["id"] != project_id]
    return {"success": True, "deleted_id": project_id}


@router.get("/chats", response_model=List[ChatSessionItem])
async def list_user_chats(user_id: str):
    """List saved chat threads for the user."""
    return USER_CHATS.get(user_id, [])


class SaveChatRequest(BaseModel):
    id: str
    user_id: str
    title: str
    messages: List[Dict[str, Any]]


@router.post("/chats", response_model=ChatSessionItem)
async def save_user_chat(req: SaveChatRequest):
    """Save or update a chat session."""
    now = datetime.now(timezone.utc).isoformat()
    if req.user_id not in USER_CHATS:
        USER_CHATS[req.user_id] = []

    for chat in USER_CHATS[req.user_id]:
        if chat["id"] == req.id:
            chat["title"] = req.title
            chat["messages"] = req.messages
            chat["updated_at"] = now
            return chat

    new_chat = {
        "id": req.id,
        "user_id": req.user_id,
        "title": req.title,
        "messages": req.messages,
        "created_at": now,
        "updated_at": now,
    }
    USER_CHATS[req.user_id].insert(0, new_chat)
    return new_chat

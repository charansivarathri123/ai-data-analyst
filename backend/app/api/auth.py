"""Authentication & User Session router for Autonomous AI Data Analyst Studio.

Backed by persistent database (SQLAlchemy - SQLite/PostgreSQL):
1. Mobile Number + Name with 6-digit OTP (5-minute expiry)
2. Email with 6-digit OTP (5-minute expiry)
3. Google Sign-In
4. Apple Sign-In
5. Direct Email Sign-In
6. User-scoped project workspaces persistence
7. User-scoped chat threads persistence
"""

import json
import logging
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import UserModel, SessionModel, OTPModel, ProjectModel, ChatSessionModel
from app.engine.notifications import send_email_otp, send_sms_otp

logger = logging.getLogger("auth")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

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
    name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    google_id: Optional[str] = None
    credential: Optional[str] = Field(None, description="Raw Google ID token JWT from Google Identity Services")


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
    auth_type: str  # 'mobile', 'email', 'google', 'apple'
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
async def send_otp(req: SendOTPRequest, db: Session = Depends(get_db)):
    """Generate and dispatch a 6-digit OTP code to mobile number or email."""
    destination = req.destination.strip().lower() if req.channel == "email" else req.destination.strip()
    if not destination:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination (phone number or email) cannot be empty."
        )

    # Generate 6-digit OTP
    code = generate_otp_code()
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(minutes=OTP_EXPIRY_MINUTES)

    # Persist or update OTP in database
    otp_record = db.query(OTPModel).filter(OTPModel.destination == destination).first()
    if not otp_record:
        otp_record = OTPModel(
            destination=destination,
            code=code,
            channel=req.channel,
            name=req.name or "",
            expires_at=expires_at,
            created_at=now_utc.isoformat(),
        )
        db.add(otp_record)
    else:
        otp_record.code = code
        otp_record.channel = req.channel
        otp_record.name = req.name or otp_record.name or ""
        otp_record.expires_at = expires_at
        otp_record.created_at = now_utc.isoformat()
    db.commit()

    # Log clearly to backend console for developer visibility
    print(f"\n[AUTH] ===================================================")
    print(f"[AUTH] >>> OTP DISPATCHED TO {req.channel.upper()}: {destination}")
    print(f"[AUTH] >>> 6-DIGIT VERIFICATION CODE: {code}")
    print(f"[AUTH] >>> EXPIRES IN: {OTP_EXPIRY_MINUTES} minutes")
    print(f"[AUTH] ===================================================\n")

    # Dispatch real notification based on channel
    delivery_status_msg = ""
    if req.channel == "email":
        sent, delivery_status_msg = send_email_otp(destination, code, user_name=req.name or "")
    elif req.channel == "mobile":
        sent, delivery_status_msg = send_sms_otp(destination, code)
    else:
        delivery_status_msg = f"Verification code generated for {destination}."

    return SendOTPResponse(
        success=True,
        channel=req.channel,
        destination=destination,
        message=delivery_status_msg or f"Verification code sent to {destination}. Valid for {OTP_EXPIRY_MINUTES} minutes.",
        expires_in_seconds=OTP_EXPIRY_MINUTES * 60,
        dev_code=code,
    )


@router.post("/otp/verify", response_model=AuthResponse)
async def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    """Verify the 6-digit OTP code and authenticate/register the user."""
    destination = req.destination.strip().lower() if req.channel == "email" else req.destination.strip()
    code = req.code.strip()

    record = db.query(OTPModel).filter(OTPModel.destination == destination).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP found for this destination. Please request a new code.",
        )

    # Check expiry safely with timezone support
    exp = record.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        db.delete(record)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification code has expired (validity is 5 minutes). Please request a new one.",
        )

    # Check code match
    if record.code != code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect verification code. Please check and re-enter.",
        )

    # Code matches - consume it
    name = req.name or record.name
    if not name:
        if req.channel == "email":
            name = destination.split("@")[0].capitalize()
        else:
            name = f"User {destination[-4:]}" if len(destination) >= 4 else "User"

    db.delete(record)
    db.commit()

    # Find or create user
    user = db.query(UserModel).filter(UserModel.identifier == destination).first()
    now_iso = datetime.now(timezone.utc).isoformat()

    if not user:
        user = UserModel(
            id=f"usr_{secrets.token_hex(6)}",
            name=name,
            identifier=destination,
            auth_type=req.channel,
            avatar_url=None,
            created_at=now_iso,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if name and user.name != name:
            user.name = name
            db.commit()

    # Create session token
    session_token = secrets.token_urlsafe(32)
    session_record = SessionModel(
        token=session_token,
        user_id=user.id,
        created_at=now_iso,
    )
    db.add(session_record)
    db.commit()

    profile = UserProfile(
        id=user.id,
        name=user.name,
        identifier=user.identifier,
        auth_type=user.auth_type,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
    )

    return AuthResponse(
        success=True,
        session_token=session_token,
        user=profile,
        message=f"Welcome back, {profile.name}!",
    )


@router.post("/google", response_model=AuthResponse)
async def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Authenticate or register a user via Google Sign-In."""
    email = (req.email or "").strip().lower()
    name = (req.name or "").strip()
    avatar_url = req.avatar_url

    # If raw Google ID token is provided, decode payload
    if req.credential:
        try:
            import base64
            payload_b64 = req.credential.split(".")[1]
            padded = payload_b64 + "=" * (-len(payload_b64) % 4)
            jwt_data = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
            if jwt_data.get("email"):
                email = jwt_data["email"].strip().lower()
            if jwt_data.get("name"):
                name = jwt_data["name"].strip()
            if jwt_data.get("picture"):
                avatar_url = jwt_data["picture"]
        except Exception as e:
            logger.warning(f"Could not parse Google ID token: {e}")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid email address is required for Google Sign-In.",
        )

    if not name:
        name = email.split("@")[0].replace(".", " ").capitalize()

    now_iso = datetime.now(timezone.utc).isoformat()
    user = db.query(UserModel).filter(UserModel.identifier == email).first()
    if not user:
        user = UserModel(
            id=f"usr_{secrets.token_hex(6)}",
            name=name,
            identifier=email,
            auth_type="google",
            avatar_url=req.avatar_url,
            created_at=now_iso,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.name = name
        if req.avatar_url:
            user.avatar_url = req.avatar_url
        db.commit()

    session_token = secrets.token_urlsafe(32)
    session_record = SessionModel(
        token=session_token,
        user_id=user.id,
        created_at=now_iso,
    )
    db.add(session_record)
    db.commit()

    profile = UserProfile(
        id=user.id,
        name=user.name,
        identifier=user.identifier,
        auth_type=user.auth_type,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
    )

    return AuthResponse(
        success=True,
        session_token=session_token,
        user=profile,
        message=f"Welcome, {profile.name}!",
    )


@router.post("/apple", response_model=AuthResponse)
async def apple_auth(req: AppleAuthRequest, db: Session = Depends(get_db)):
    """Authenticate or register a user via Apple Sign-In."""
    email = (req.email or "apple.user@privaterelay.appleid.com").strip().lower()
    name = req.name.strip() if req.name else email.split("@")[0].capitalize()
    now_iso = datetime.now(timezone.utc).isoformat()

    user = db.query(UserModel).filter(UserModel.identifier == email).first()
    if not user:
        user = UserModel(
            id=f"usr_{secrets.token_hex(6)}",
            name=name,
            identifier=email,
            auth_type="apple",
            avatar_url=None,
            created_at=now_iso,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.name = name
        db.commit()

    session_token = secrets.token_urlsafe(32)
    session_record = SessionModel(
        token=session_token,
        user_id=user.id,
        created_at=now_iso,
    )
    db.add(session_record)
    db.commit()

    profile = UserProfile(
        id=user.id,
        name=user.name,
        identifier=user.identifier,
        auth_type=user.auth_type,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
    )

    return AuthResponse(
        success=True,
        session_token=session_token,
        user=profile,
        message=f"Welcome, {profile.name}!",
    )


@router.post("/email-direct", response_model=AuthResponse)
async def email_direct_auth(req: EmailDirectRequest, db: Session = Depends(get_db)):
    """Authenticate or register directly via email."""
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please enter a valid email address.")

    name = req.name.strip() if req.name else email.split("@")[0].replace(".", " ").capitalize()
    now_iso = datetime.now(timezone.utc).isoformat()

    user = db.query(UserModel).filter(UserModel.identifier == email).first()
    if not user:
        user = UserModel(
            id=f"usr_{secrets.token_hex(6)}",
            name=name,
            identifier=email,
            auth_type="email",
            avatar_url=None,
            created_at=now_iso,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if name:
            user.name = name
            db.commit()

    session_token = secrets.token_urlsafe(32)
    session_record = SessionModel(
        token=session_token,
        user_id=user.id,
        created_at=now_iso,
    )
    db.add(session_record)
    db.commit()

    profile = UserProfile(
        id=user.id,
        name=user.name,
        identifier=user.identifier,
        auth_type=user.auth_type,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
    )

    return AuthResponse(
        success=True,
        session_token=session_token,
        user=profile,
        message=f"Welcome, {profile.name}!",
    )


@router.get("/me", response_model=UserProfile)
async def get_current_user(token: str, db: Session = Depends(get_db)):
    """Retrieve profile for active session token."""
    session_record = db.query(SessionModel).filter(SessionModel.token == token).first()
    if not session_record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session token.")

    user = db.query(UserModel).filter(UserModel.id == session_record.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found.")

    return UserProfile(
        id=user.id,
        name=user.name,
        identifier=user.identifier,
        auth_type=user.auth_type,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
    )


# ---------------------------------------------------------------------------
# User Projects & Chats Persistence
# ---------------------------------------------------------------------------

@router.get("/projects", response_model=List[ProjectItem])
async def list_user_projects(user_id: str, db: Session = Depends(get_db)):
    """Return projects belonging to the given user."""
    projects = db.query(ProjectModel).filter(ProjectModel.user_id == user_id).order_by(ProjectModel.created_at.desc()).all()

    if not projects:
        now_iso = datetime.now(timezone.utc).isoformat()
        starter_projects = [
            ProjectModel(
                id=f"proj_sample_churn_{user_id[:6]}",
                user_id=user_id,
                name="Customer Churn & Retention Model",
                description="Exploratory analysis and root-cause drivers for SaaS subscription drop-off.",
                created_at=now_iso,
                dataset_id="sample_churn",
                status="active",
            ),
            ProjectModel(
                id=f"proj_sample_retail_{user_id[:6]}",
                user_id=user_id,
                name="Omnichannel Retail Star Schema",
                description="DuckDB star schema modeling with verified DAX measures.",
                created_at=now_iso,
                dataset_id="sample_retail",
                status="active",
            )
        ]
        for p in starter_projects:
            db.add(p)
        db.commit()
        projects = starter_projects

    return [
        ProjectItem(
            id=p.id,
            user_id=p.user_id,
            name=p.name,
            description=p.description or "",
            created_at=p.created_at,
            dataset_id=p.dataset_id,
            status=p.status or "active",
        )
        for p in projects
    ]


class CreateProjectRequest(BaseModel):
    user_id: str
    name: str
    description: Optional[str] = ""
    dataset_id: Optional[str] = None


@router.post("/projects", response_model=ProjectItem)
async def create_user_project(req: CreateProjectRequest, db: Session = Depends(get_db)):
    """Create a new project workspace for the authenticated user."""
    project_id = f"proj_{secrets.token_hex(5)}"
    now_iso = datetime.now(timezone.utc).isoformat()
    project = ProjectModel(
        id=project_id,
        user_id=req.user_id,
        name=req.name.strip(),
        description=req.description or "",
        created_at=now_iso,
        dataset_id=req.dataset_id,
        status="active",
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return ProjectItem(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description or "",
        created_at=project.created_at,
        dataset_id=project.dataset_id,
        status=project.status or "active",
    )


@router.delete("/projects/{project_id}")
async def delete_user_project(project_id: str, user_id: str, db: Session = Depends(get_db)):
    """Delete a user's project."""
    project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id,
        ProjectModel.user_id == user_id,
    ).first()
    if project:
        db.delete(project)
        db.commit()
    return {"success": True, "deleted_id": project_id}


@router.get("/chats", response_model=List[ChatSessionItem])
async def list_user_chats(user_id: str, db: Session = Depends(get_db)):
    """List saved chat threads for the user."""
    chat_records = db.query(ChatSessionModel).filter(ChatSessionModel.user_id == user_id).order_by(ChatSessionModel.updated_at.desc()).all()
    results = []
    for c in chat_records:
        try:
            messages = json.loads(c.messages_json)
        except Exception:
            messages = []
        results.append(
            ChatSessionItem(
                id=c.id,
                user_id=c.user_id,
                title=c.title,
                messages=messages,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
        )
    return results


class SaveChatRequest(BaseModel):
    id: str
    user_id: str
    title: str
    messages: List[Dict[str, Any]]


@router.post("/chats", response_model=ChatSessionItem)
async def save_user_chat(req: SaveChatRequest, db: Session = Depends(get_db)):
    """Save or update a chat session."""
    now_iso = datetime.now(timezone.utc).isoformat()
    messages_serialized = json.dumps(req.messages)

    chat = db.query(ChatSessionModel).filter(
        ChatSessionModel.id == req.id,
        ChatSessionModel.user_id == req.user_id,
    ).first()

    if chat:
        chat.title = req.title
        chat.messages_json = messages_serialized
        chat.updated_at = now_iso
        db.commit()
    else:
        chat = ChatSessionModel(
            id=req.id,
            user_id=req.user_id,
            title=req.title,
            messages_json=messages_serialized,
            created_at=now_iso,
            updated_at=now_iso,
        )
        db.add(chat)
        db.commit()
        db.refresh(chat)

    return ChatSessionItem(
        id=chat.id,
        user_id=chat.user_id,
        title=chat.title,
        messages=req.messages,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
    )

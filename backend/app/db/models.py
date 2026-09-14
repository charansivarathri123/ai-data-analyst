"""SQLAlchemy ORM models for Autonomous AI Data Analyst Studio.

Tables:
- users: Registered users (Google, Apple, Mobile OTP, Email)
- sessions: Active login session tokens
- otps: Pending one-time passcodes with expiration
- projects: User-scoped analytics workspaces
- chat_sessions: User-scoped chat threads and message histories
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from app.db.database import Base


class UserModel(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    identifier = Column(String(255), unique=True, index=True, nullable=False)  # email or phone
    auth_type = Column(String(50), nullable=False)  # 'mobile', 'email', 'google', 'apple'
    avatar_url = Column(Text, nullable=True)
    created_at = Column(String(64), nullable=False, default=lambda: datetime.now(timezone.utc).isoformat())


class SessionModel(Base):
    __tablename__ = "sessions"

    token = Column(String(128), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(String(64), nullable=False, default=lambda: datetime.now(timezone.utc).isoformat())


class OTPModel(Base):
    __tablename__ = "otps"

    destination = Column(String(255), primary_key=True, index=True)  # phone or email
    code = Column(String(10), nullable=False)
    channel = Column(String(20), nullable=False)  # 'mobile' or 'email'
    name = Column(String(255), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(String(64), nullable=False, default=lambda: datetime.now(timezone.utc).isoformat())


class ProjectModel(Base):
    __tablename__ = "projects"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True, default="")
    dataset_id = Column(String(128), nullable=True)
    status = Column(String(50), nullable=False, default="active")
    created_at = Column(String(64), nullable=False, default=lambda: datetime.now(timezone.utc).isoformat())


class ChatSessionModel(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    messages_json = Column(Text, nullable=False, default="[]")
    created_at = Column(String(64), nullable=False, default=lambda: datetime.now(timezone.utc).isoformat())
    updated_at = Column(String(64), nullable=False, default=lambda: datetime.now(timezone.utc).isoformat())

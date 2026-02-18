"""
Email verification token model
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
import uuid

from app.core.database import Base


class EmailVerificationToken(Base):
    """Email verification token for user registration - uses string IDs to match Prisma"""

    __tablename__ = "email_verification_tokens"

    id = Column(String(255), primary_key=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False)
    used_at = Column(DateTime, nullable=True)

    @classmethod
    def generate_token(cls) -> str:
        """Generate a secure random token"""
        return str(uuid.uuid4())

    @classmethod
    def get_expiration_time(cls, hours: int = 24) -> datetime:
        """Get expiration time for token (default 24 hours)"""
        return datetime.now(timezone.utc) + timedelta(hours=hours)

    def is_expired(self) -> bool:
        """Check if token has expired"""
        return datetime.now(timezone.utc) > self.expires_at

    def is_valid(self) -> bool:
        """Check if token is valid (not used and not expired)"""
        return not self.is_used and not self.is_expired()

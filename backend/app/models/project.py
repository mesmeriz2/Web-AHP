from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.db.base import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, nullable=False)
    participant_count = Column(Integer, nullable=False)
    project_code = Column(String, unique=True, index=True, nullable=False)
    admin_code = Column(String, unique=True, index=True, nullable=False)
    owner_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

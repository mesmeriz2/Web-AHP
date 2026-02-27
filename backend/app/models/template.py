from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, JSON, String

from app.db.base import Base


class SurveyTemplate(Base):
    __tablename__ = "survey_templates"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    hierarchy = Column(JSON, nullable=False)
    owner_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

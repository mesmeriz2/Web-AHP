from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Float, ForeignKey, JSON, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class PairwiseResponse(Base):
    __tablename__ = "pairwise_responses"

    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    node_id = Column(String, ForeignKey("hierarchy_nodes.id"), nullable=False)
    participant_id = Column(String, ForeignKey("participants.id"), nullable=False)
    matrix = Column(JSON, nullable=False)
    consistency_index = Column(Float, nullable=False)
    consistency_ratio = Column(Float, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project")
    node = relationship("HierarchyNode")
    participant = relationship("Participant")

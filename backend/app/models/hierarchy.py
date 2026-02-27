from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class HierarchyNode(Base):
    __tablename__ = "hierarchy_nodes"

    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    parent_id = Column(String, ForeignKey("hierarchy_nodes.id"), nullable=True)
    name = Column(String, nullable=False)
    node_type = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False)

    project = relationship("Project")
    parent = relationship("HierarchyNode", remote_side=[id])

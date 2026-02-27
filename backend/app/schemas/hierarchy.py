from typing import List, Optional

from pydantic import BaseModel, Field


class HierarchyNodeInput(BaseModel):
    name: str
    node_type: str = Field(..., description="goal|criteria|alternative")
    children: Optional[List["HierarchyNodeInput"]] = None


class HierarchyNodeOutput(BaseModel):
    id: str
    name: str
    node_type: str
    parent_id: Optional[str]
    sort_order: int


class HierarchyNodeCreateRequest(BaseModel):
    name: str
    node_type: str
    parent_id: Optional[str] = None
    sort_order: Optional[int] = None


class HierarchyNodeUpdateRequest(BaseModel):
    name: Optional[str] = None
    node_type: Optional[str] = None
    parent_id: Optional[str] = None
    sort_order: Optional[int] = None


class HierarchyTreeNode(BaseModel):
    id: str
    name: str
    node_type: str
    parent_id: Optional[str]
    sort_order: int
    children: Optional[List["HierarchyTreeNode"]] = None


HierarchyNodeInput.model_rebuild()
HierarchyTreeNode.model_rebuild()

from typing import Optional

from pydantic import BaseModel

from app.schemas.hierarchy import HierarchyNodeInput


class TemplateCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    hierarchy: HierarchyNodeInput


class TemplateListItem(BaseModel):
    id: str
    name: str
    description: Optional[str]
    owner_id: Optional[str] = None
    owner_username: Optional[str] = None


class TemplateFromProjectRequest(BaseModel):
    project_id: str
    name: str
    description: Optional[str] = None

from typing import List, Optional

from pydantic import BaseModel

from app.schemas.hierarchy import HierarchyNodeInput


class ProjectCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    participant_count: int
    hierarchy: Optional[HierarchyNodeInput] = None
    template_id: Optional[str] = None


class ProjectCreateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    participant_count: int
    project_code: str
    admin_code: str
    participant_codes: List[str]


class ProjectListItem(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    participant_count: int
    admin_code: str
    responded_count: int = 0
    owner_id: Optional[str] = None
    owner_username: Optional[str] = None


class ProjectSummaryResponse(BaseModel):
    project_id: str
    total_participants: int
    responded_participants: int
    high_inconsistency_nodes: List[str]


class ParticipantDetail(BaseModel):
    participant_code: str
    has_participated: bool
    completed_nodes: List[str]
    total_nodes: int
    completion_rate: float


class ProjectParticipantsResponse(BaseModel):
    project_id: str
    participants: List[ParticipantDetail]

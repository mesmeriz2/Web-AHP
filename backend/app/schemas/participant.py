from typing import List, Optional

from pydantic import BaseModel


class ParticipantTaskResponse(BaseModel):
    project_id: str
    participant_id: str
    participant_code: str
    nodes: List[dict]


class ParticipantInfoResponse(BaseModel):
    project_id: str
    participant_id: str
    participant_code: str
    name: Optional[str]

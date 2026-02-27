from typing import List

from pydantic import BaseModel


class PairwiseSubmission(BaseModel):
    participant_code: str
    node_id: str
    matrix: List[List[float]]


class PairwiseResponseOut(BaseModel):
    id: str
    node_id: str
    participant_id: str
    consistency_index: float
    consistency_ratio: float

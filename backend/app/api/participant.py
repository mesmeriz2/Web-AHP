from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import STATUS_ARCHIVED
from app.core.settings import get_ri_table, get_settings
from app.db.session import get_db
from app.models.hierarchy import HierarchyNode
from app.models.participant import Participant
from app.models.project import Project
from app.models.response import PairwiseResponse
from app.schemas.response import PairwiseResponseOut, PairwiseSubmission
from app.services.ahp import compute_consistency, validate_matrix
from app.services.results import build_children_map
from app.services.utils import generate_id

router = APIRouter(prefix="/api/participant", tags=["participant"])
settings = get_settings()


@router.get("/{participant_code}/tasks")
def participant_tasks(participant_code: str, db: Session = Depends(get_db)):
    participant = db.query(Participant).filter(Participant.code == participant_code).first()
    if not participant:
        raise HTTPException(status_code=404, detail="participant not found")

    project = db.query(Project).filter(Project.id == participant.project_id).first()
    if project and project.status == STATUS_ARCHIVED:
        raise HTTPException(status_code=403, detail="종료된 설문입니다")

    nodes = db.query(HierarchyNode).filter(HierarchyNode.project_id == participant.project_id).all()
    children_map = build_children_map(nodes)
    responses = (
        db.query(PairwiseResponse)
        .filter(PairwiseResponse.project_id == participant.project_id)
        .filter(PairwiseResponse.participant_id == participant.id)
        .all()
    )
    response_map = {resp.node_id: resp for resp in responses}

    node_payload = []
    for node in nodes:
        children = children_map.get(node.id, [])
        response = response_map.get(node.id)
        node_payload.append(
            {
                "id": node.id,
                "name": node.name,
                "node_type": node.node_type,
                "parent_id": node.parent_id,
                "sort_order": node.sort_order,
                "child_ids": [child.id for child in children],
                "consistency_ratio": response.consistency_ratio if response else None,
                "matrix": response.matrix if response else None,
                "consistency_index": response.consistency_index if response else None,
            }
        )

    # 프로젝트 정보도 포함 (위에서 이미 조회했으나 재사용)
    project_name = project.name if project else "알 수 없는 프로젝트"
    
    return {
        "project_id": participant.project_id,
        "project_name": project_name,
        "participant_id": participant.id,
        "participant_code": participant.code,
        "nodes": node_payload,
    }


@router.post("/submit", response_model=PairwiseResponseOut)
def submit_pairwise(request: PairwiseSubmission, db: Session = Depends(get_db)):
    participant = db.query(Participant).filter(Participant.code == request.participant_code).first()
    if not participant:
        raise HTTPException(status_code=404, detail="participant not found")

    project = db.query(Project).filter(Project.id == participant.project_id).first()
    if project and project.status == STATUS_ARCHIVED:
        raise HTTPException(status_code=403, detail="종료된 설문입니다")

    node = (
        db.query(HierarchyNode)
        .filter(HierarchyNode.id == request.node_id)
        .filter(HierarchyNode.project_id == participant.project_id)
        .first()
    )
    if not node:
        raise HTTPException(status_code=404, detail="node not found")

    nodes = db.query(HierarchyNode).filter(HierarchyNode.project_id == participant.project_id).all()
    children_map = build_children_map(nodes)
    child_count = len(children_map.get(node.id, []))
    if child_count == 0:
        raise HTTPException(status_code=400, detail="node has no children")

    size = validate_matrix(request.matrix)
    if size != child_count:
        raise HTTPException(status_code=400, detail="matrix size does not match child count")

    ri_table = get_ri_table()
    ci, cr = compute_consistency(request.matrix, ri_table)

    existing = (
        db.query(PairwiseResponse)
        .filter(PairwiseResponse.project_id == participant.project_id)
        .filter(PairwiseResponse.participant_id == participant.id)
        .filter(PairwiseResponse.node_id == node.id)
        .first()
    )
    if existing:
        existing.matrix = request.matrix
        existing.consistency_index = ci
        existing.consistency_ratio = cr
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        response = existing
    else:
        response = PairwiseResponse(
            id=generate_id(),
            project_id=participant.project_id,
            node_id=node.id,
            participant_id=participant.id,
            matrix=request.matrix,
            consistency_index=ci,
            consistency_ratio=cr,
            updated_at=datetime.now(timezone.utc),
        )
        db.add(response)
        db.commit()

    return PairwiseResponseOut(
        id=response.id,
        node_id=response.node_id,
        participant_id=response.participant_id,
        consistency_index=response.consistency_index,
        consistency_ratio=response.consistency_ratio,
    )

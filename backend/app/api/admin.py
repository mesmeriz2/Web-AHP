from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import ROLE_SUPER_ADMIN, STATUS_ACTIVE, STATUS_ARCHIVED
from app.core.settings import get_ri_table, get_settings
from app.db.session import get_db
from app.models.hierarchy import HierarchyNode
from app.models.participant import Participant
from app.models.project import Project
from app.models.response import PairwiseResponse
from app.models.template import SurveyTemplate
from app.models.user import User
from app.schemas.admin import AdminLoginRequest, AdminLoginResponse
from app.schemas.hierarchy import (
    HierarchyNodeCreateRequest,
    HierarchyNodeInput,
    HierarchyNodeOutput,
    HierarchyNodeUpdateRequest,
    HierarchyTreeNode,
)
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectCreateResponse,
    ProjectListItem,
    ProjectSummaryResponse,
    ProjectParticipantsResponse,
    ParticipantDetail,
)
from app.schemas.template import TemplateCreateRequest, TemplateFromProjectRequest, TemplateListItem
from app.services.auth import authenticate_user, create_token, get_current_user
from app.services.hierarchy import (
    build_hierarchy_tree,
    build_hierarchy_tree_with_ids,
    normalize_sibling_order,
)
from app.services.results import build_children_map, compute_global_weights
from app.services.utils import (
    generate_admin_code,
    generate_id,
    generate_participant_code,
    generate_project_code,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])
settings = get_settings()


def verify_project_access(db: Session, project_id: str, user: User) -> Project:
    """프로젝트 조회 후 소유권 검증. super_admin은 모든 프로젝트 접근 가능."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    if user.role != ROLE_SUPER_ADMIN and project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="access denied")
    return project


def verify_template_access(db: Session, template_id: str, user: User) -> SurveyTemplate:
    """템플릿 조회 후 소유권 검증 (수정/삭제용). super_admin은 모든 템플릿 접근 가능."""
    template = db.query(SurveyTemplate).filter(SurveyTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="template not found")
    if user.role != ROLE_SUPER_ADMIN and template.owner_id != user.id:
        raise HTTPException(status_code=403, detail="access denied")
    return template


@router.post("/login", response_model=AdminLoginResponse)
def admin_login(request: AdminLoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, request.login_id, request.password)
    token_data = create_token(user)
    return AdminLoginResponse(
        token=token_data["token"],
        expires_at=token_data["expires_at"],
        user=token_data["user"],
    )


def create_hierarchy_nodes(
    db: Session,
    project_id: str,
    node_input: HierarchyNodeInput,
    parent_id: Optional[str],
    sort_order: int,
) -> None:
    node_id = generate_id()
    node = HierarchyNode(
        id=node_id,
        project_id=project_id,
        parent_id=parent_id,
        name=node_input.name,
        node_type=node_input.node_type,
        sort_order=sort_order,
    )
    db.add(node)
    children = node_input.children or []
    for index, child in enumerate(children):
        create_hierarchy_nodes(db, project_id, child, node_id, index)


def get_project_or_404(db: Session, project_id: str) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    return project


def get_node_or_404(db: Session, project_id: str, node_id: str) -> HierarchyNode:
    node = (
        db.query(HierarchyNode)
        .filter(HierarchyNode.project_id == project_id)
        .filter(HierarchyNode.id == node_id)
        .first()
    )
    if not node:
        raise HTTPException(status_code=404, detail="node not found")
    return node


def ensure_root_available(db: Session, project_id: str) -> None:
    root = (
        db.query(HierarchyNode)
        .filter(HierarchyNode.project_id == project_id)
        .filter(HierarchyNode.parent_id.is_(None))
        .first()
    )
    if root:
        raise HTTPException(status_code=400, detail="root node already exists")


def collect_descendant_ids(nodes: List[HierarchyNode], node_id: str) -> List[str]:
    children_map = build_children_map(nodes)
    collected = []
    stack = [node_id]
    while stack:
        current_id = stack.pop()
        collected.append(current_id)
        for child in children_map.get(current_id, []):
            stack.append(child.id)
    return collected


def generate_unique_code(db: Session, model, field_name: str, generator) -> str:
    while True:
        code = generator()
        exists = db.query(model).filter(getattr(model, field_name) == code).first()
        if not exists:
            return code


def resolve_hierarchy_from_template(
    db: Session,
    template_id: str,
) -> HierarchyNodeInput:
    template = db.query(SurveyTemplate).filter(SurveyTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="template not found")
    return HierarchyNodeInput.model_validate(template.hierarchy)


@router.post("/projects", response_model=ProjectCreateResponse)
def create_project(
    request: ProjectCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if request.participant_count < settings.min_participants or request.participant_count > settings.max_participants:
        raise HTTPException(status_code=400, detail="participant_count out of range")

    if request.template_id:
        hierarchy = resolve_hierarchy_from_template(db, request.template_id)
    elif request.hierarchy:
        hierarchy = request.hierarchy
    else:
        raise HTTPException(status_code=400, detail="hierarchy or template_id required")

    project_id = generate_id()
    project_code = generate_unique_code(db, Project, "project_code", generate_project_code)
    admin_code = generate_unique_code(db, Project, "admin_code", generate_admin_code)

    project = Project(
        id=project_id,
        name=request.name,
        description=request.description,
        status=STATUS_ACTIVE,
        participant_count=request.participant_count,
        project_code=project_code,
        admin_code=admin_code,
        owner_id=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(project)

    participant_codes: List[str] = []
    for _ in range(request.participant_count):
        participant_id = generate_id()
        participant_code = generate_unique_code(db, Participant, "code", generate_participant_code)
        participant_codes.append(participant_code)
        db.add(
            Participant(
                id=participant_id,
                project_id=project_id,
                code=participant_code,
                created_at=datetime.now(timezone.utc),
            )
        )

    create_hierarchy_nodes(db, project_id, hierarchy, None, 0)
    db.commit()

    return ProjectCreateResponse(
        id=project_id,
        name=request.name,
        description=request.description,
        participant_count=request.participant_count,
        project_code=project_code,
        admin_code=admin_code,
        participant_codes=participant_codes,
    )


def _get_responded_count(db: Session, project_id: str) -> int:
    return db.query(PairwiseResponse).filter(PairwiseResponse.project_id == project_id).count()


def _ensure_no_responses(db: Session, project_id: str) -> None:
    if _get_responded_count(db, project_id) > 0:
        raise HTTPException(
            status_code=403,
            detail="설문 응답이 시작된 프로젝트는 계층 구조를 변경할 수 없습니다.",
        )


def _get_owner_username(db: Session, owner_id: Optional[str]) -> Optional[str]:
    if not owner_id:
        return None
    user = db.query(User).filter(User.id == owner_id).first()
    return user.username if user else None


@router.get("/projects", response_model=List[ProjectListItem])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == ROLE_SUPER_ADMIN:
        projects = db.query(Project).order_by(Project.created_at.desc()).all()
    else:
        projects = (
            db.query(Project)
            .filter(Project.owner_id == current_user.id)
            .order_by(Project.created_at.desc())
            .all()
        )
    return [
        ProjectListItem(
            id=project.id,
            name=project.name,
            description=project.description,
            status=project.status,
            participant_count=project.participant_count,
            admin_code=project.admin_code,
            responded_count=_get_responded_count(db, project.id),
            owner_id=project.owner_id,
            owner_username=_get_owner_username(db, project.owner_id),
        )
        for project in projects
    ]


@router.post("/projects/{project_id}/archive")
def archive_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = verify_project_access(db, project_id, current_user)
    project.status = STATUS_ARCHIVED
    db.commit()
    return {"status": "archived"}


@router.post("/projects/{project_id}/restore")
def restore_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = verify_project_access(db, project_id, current_user)
    project.status = STATUS_ACTIVE
    db.commit()
    return {"status": "active"}


@router.get("/projects/{project_id}/participants", response_model=ProjectParticipantsResponse)
def get_project_participants(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_project_access(db, project_id, current_user)

    participants = db.query(Participant).filter(Participant.project_id == project_id).all()
    nodes = db.query(HierarchyNode).filter(HierarchyNode.project_id == project_id).all()
    children_map = build_children_map(nodes)
    comparable_node_ids = [
        n.id for n in nodes
        if len(children_map.get(n.id, [])) >= 2
    ]
    total_nodes = len(comparable_node_ids)

    all_responses = db.query(PairwiseResponse).filter(
        PairwiseResponse.project_id == project_id
    ).all()
    responses_by_participant: dict = {}
    for resp in all_responses:
        responses_by_participant.setdefault(resp.participant_id, []).append(resp)

    participant_details = []
    for participant in participants:
        responses = responses_by_participant.get(participant.id, [])
        completed_nodes = [r.node_id for r in responses]
        completed_unique = len(set(completed_nodes))
        completion_rate = min(completed_unique, total_nodes) / total_nodes if total_nodes > 0 else 0
        participant_details.append(ParticipantDetail(
            participant_code=participant.code,
            has_participated=len(responses) > 0,
            completed_nodes=completed_nodes,
            total_nodes=total_nodes,
            completion_rate=completion_rate,
        ))

    return ProjectParticipantsResponse(
        project_id=project_id,
        participants=participant_details,
    )


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = verify_project_access(db, project_id, current_user)

    participants = db.query(Participant).filter(Participant.project_id == project_id).all()
    for participant in participants:
        db.query(PairwiseResponse).filter(PairwiseResponse.participant_id == participant.id).delete()

    db.query(Participant).filter(Participant.project_id == project_id).delete()
    db.query(HierarchyNode).filter(HierarchyNode.project_id == project_id).delete()
    db.delete(project)
    db.commit()

    return {"status": "deleted"}


@router.get("/projects/{project_id}/summary", response_model=ProjectSummaryResponse)
def project_summary(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = verify_project_access(db, project_id, current_user)
    responses = db.query(PairwiseResponse).filter(PairwiseResponse.project_id == project_id).all()
    responded_participants = len({resp.participant_id for resp in responses})
    high_inconsistency_nodes = list(
        {resp.node_id for resp in responses if resp.consistency_ratio > settings.cr_threshold}
    )

    return ProjectSummaryResponse(
        project_id=project_id,
        total_participants=project.participant_count,
        responded_participants=responded_participants,
        high_inconsistency_nodes=high_inconsistency_nodes,
    )


@router.get("/projects/{project_id}/results")
def project_results(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_project_access(db, project_id, current_user)
    nodes = db.query(HierarchyNode).filter(HierarchyNode.project_id == project_id).all()
    responses = db.query(PairwiseResponse).filter(PairwiseResponse.project_id == project_id).all()
    ri_table = get_ri_table()
    results = compute_global_weights(nodes, responses, ri_table)

    node_name_map = {node.id: node.name for node in nodes}
    alternative_weights = [
        {"node_id": node_id, "name": node_name_map.get(node_id), "weight": weight}
        for node_id, weight in results["alternative_weights"].items()
    ]

    return {
        "project_id": project_id,
        "alternative_weights": sorted(alternative_weights, key=lambda item: item["weight"], reverse=True),
        "node_consistency": results["node_consistency"],
        "missing_nodes": results["missing_nodes"],
    }


@router.get("/projects/{project_id}/hierarchy", response_model=HierarchyTreeNode)
def get_project_hierarchy(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_project_access(db, project_id, current_user)
    nodes = db.query(HierarchyNode).filter(HierarchyNode.project_id == project_id).all()
    if not nodes:
        raise HTTPException(status_code=404, detail="hierarchy not found")
    try:
        hierarchy = build_hierarchy_tree_with_ids(nodes)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return hierarchy


@router.post("/projects/{project_id}/hierarchy", response_model=HierarchyNodeOutput)
def create_hierarchy_node(
    project_id: str,
    request: HierarchyNodeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_project_access(db, project_id, current_user)
    _ensure_no_responses(db, project_id)
    if request.parent_id is None:
        ensure_root_available(db, project_id)
    else:
        get_node_or_404(db, project_id, request.parent_id)

    sibling_query = (
        db.query(HierarchyNode)
        .filter(HierarchyNode.project_id == project_id)
        .filter(HierarchyNode.parent_id == request.parent_id)
        .order_by(HierarchyNode.sort_order.asc())
    )
    siblings = sibling_query.all()

    sort_order = request.sort_order if request.sort_order is not None else len(siblings)
    for sibling in siblings:
        if sibling.sort_order >= sort_order:
            sibling.sort_order += 1

    node = HierarchyNode(
        id=generate_id(),
        project_id=project_id,
        parent_id=request.parent_id,
        name=request.name,
        node_type=request.node_type,
        sort_order=sort_order,
    )
    db.add(node)
    db.commit()
    normalize_sibling_order(db, project_id, request.parent_id)
    db.commit()

    return HierarchyNodeOutput(
        id=node.id,
        name=node.name,
        node_type=node.node_type,
        parent_id=node.parent_id,
        sort_order=node.sort_order,
    )


@router.patch("/projects/{project_id}/hierarchy/{node_id}", response_model=HierarchyNodeOutput)
def update_hierarchy_node(
    project_id: str,
    node_id: str,
    request: HierarchyNodeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_project_access(db, project_id, current_user)
    _ensure_no_responses(db, project_id)
    node = get_node_or_404(db, project_id, node_id)
    old_parent_id = node.parent_id

    if request.parent_id is None and old_parent_id is not None:
        ensure_root_available(db, project_id)
    if request.parent_id is not None and request.parent_id != old_parent_id:
        get_node_or_404(db, project_id, request.parent_id)

    if request.name is not None:
        node.name = request.name
    if request.node_type is not None:
        node.node_type = request.node_type
    if request.parent_id is not None:
        node.parent_id = request.parent_id
    if request.sort_order is not None:
        node.sort_order = request.sort_order
    elif request.parent_id is not None and request.parent_id != old_parent_id:
        sibling_count = (
            db.query(HierarchyNode)
            .filter(HierarchyNode.project_id == project_id)
            .filter(HierarchyNode.parent_id == request.parent_id)
            .count()
        )
        node.sort_order = sibling_count

    db.commit()
    normalize_sibling_order(db, project_id, old_parent_id)
    normalize_sibling_order(db, project_id, node.parent_id)
    db.commit()

    return HierarchyNodeOutput(
        id=node.id,
        name=node.name,
        node_type=node.node_type,
        parent_id=node.parent_id,
        sort_order=node.sort_order,
    )


@router.delete("/projects/{project_id}/hierarchy/{node_id}")
def delete_hierarchy_node(
    project_id: str,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_project_access(db, project_id, current_user)
    _ensure_no_responses(db, project_id)
    nodes = db.query(HierarchyNode).filter(HierarchyNode.project_id == project_id).all()
    if not nodes:
        raise HTTPException(status_code=404, detail="hierarchy not found")

    if not any(node.id == node_id for node in nodes):
        raise HTTPException(status_code=404, detail="node not found")

    ids_to_delete = collect_descendant_ids(nodes, node_id)
    parent_id = next((node.parent_id for node in nodes if node.id == node_id), None)

    db.query(HierarchyNode).filter(HierarchyNode.id.in_(ids_to_delete)).delete(synchronize_session=False)
    db.commit()
    normalize_sibling_order(db, project_id, parent_id)
    db.commit()
    return {"status": "deleted"}


@router.post("/templates", response_model=TemplateListItem)
def create_template(
    request: TemplateCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template_id = generate_id()
    template = SurveyTemplate(
        id=template_id,
        name=request.name,
        description=request.description,
        hierarchy=request.hierarchy.model_dump(),
        owner_id=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(template)
    db.commit()
    return TemplateListItem(
        id=template.id,
        name=template.name,
        description=template.description,
        owner_id=template.owner_id,
        owner_username=current_user.username,
    )


@router.post("/templates/from-project", response_model=TemplateListItem)
def create_template_from_project(
    request: TemplateFromProjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = verify_project_access(db, request.project_id, current_user)
    nodes = db.query(HierarchyNode).filter(HierarchyNode.project_id == project.id).all()
    try:
        hierarchy = build_hierarchy_tree(nodes)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    template_id = generate_id()
    template = SurveyTemplate(
        id=template_id,
        name=request.name,
        description=request.description,
        hierarchy=hierarchy,
        owner_id=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(template)
    db.commit()
    return TemplateListItem(
        id=template.id,
        name=template.name,
        description=template.description,
        owner_id=template.owner_id,
        owner_username=current_user.username,
    )


@router.get("/templates", response_model=List[TemplateListItem])
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    templates = db.query(SurveyTemplate).order_by(SurveyTemplate.created_at.desc()).all()
    return [
        TemplateListItem(
            id=template.id,
            name=template.name,
            description=template.description,
            owner_id=template.owner_id,
            owner_username=_get_owner_username(db, template.owner_id),
        )
        for template in templates
    ]


@router.get("/templates/{template_id}")
def get_template_detail(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = db.query(SurveyTemplate).filter(SurveyTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="template not found")

    return {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "hierarchy": template.hierarchy,
        "created_at": template.created_at.isoformat(),
        "owner_id": template.owner_id,
        "owner_username": _get_owner_username(db, template.owner_id),
    }


@router.put("/templates/{template_id}", response_model=TemplateListItem)
def update_template(
    template_id: str,
    request: TemplateCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = verify_template_access(db, template_id, current_user)

    template.name = request.name
    template.description = request.description
    template.hierarchy = request.hierarchy.model_dump()
    db.commit()

    return TemplateListItem(
        id=template.id,
        name=template.name,
        description=template.description,
        owner_id=template.owner_id,
        owner_username=_get_owner_username(db, template.owner_id),
    )


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = verify_template_access(db, template_id, current_user)

    db.delete(template)
    db.commit()

    return {"status": "deleted"}

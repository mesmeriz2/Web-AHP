from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.hierarchy import HierarchyNode
from app.services.results import build_children_map


def build_hierarchy_tree(nodes: List[HierarchyNode]) -> Dict:
    children_map = build_children_map(nodes)
    roots = children_map.get(None, [])
    if len(roots) != 1:
        raise ValueError("hierarchy must have exactly one root node")

    def build_node(node: HierarchyNode) -> Dict:
        children = children_map.get(node.id, [])
        payload = {"name": node.name, "node_type": node.node_type}
        if children:
            payload["children"] = [build_node(child) for child in children]
        return payload

    return build_node(roots[0])


def build_hierarchy_tree_with_ids(nodes: List[HierarchyNode]) -> Dict:
    children_map = build_children_map(nodes)
    roots = children_map.get(None, [])
    if len(roots) != 1:
        raise ValueError("hierarchy must have exactly one root node")

    def build_node(node: HierarchyNode) -> Dict:
        children = children_map.get(node.id, [])
        payload = {
            "id": node.id,
            "name": node.name,
            "node_type": node.node_type,
            "parent_id": node.parent_id,
            "sort_order": node.sort_order,
        }
        if children:
            payload["children"] = [build_node(child) for child in children]
        return payload

    return build_node(roots[0])


def normalize_sibling_order(db: Session, project_id: str, parent_id: Optional[str]) -> None:
    siblings = (
        db.query(HierarchyNode)
        .filter(HierarchyNode.project_id == project_id)
        .filter(HierarchyNode.parent_id == parent_id)
        .order_by(HierarchyNode.sort_order.asc())
        .all()
    )
    for index, sibling in enumerate(siblings):
        sibling.sort_order = index
    db.flush()

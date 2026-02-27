from typing import Dict, List, Optional, Tuple

from app.models.hierarchy import HierarchyNode
from app.models.response import PairwiseResponse
from app.services.ahp import aggregate_matrices, compute_consistency, compute_priority_vector


def build_children_map(nodes: List[HierarchyNode]) -> Dict[Optional[str], List[HierarchyNode]]:
    children_map: Dict[Optional[str], List[HierarchyNode]] = {}
    for node in nodes:
        children_map.setdefault(node.parent_id, []).append(node)
    for parent_id in children_map:
        children_map[parent_id] = sorted(children_map[parent_id], key=lambda item: item.sort_order)
    return children_map


def compute_local_weights(
    node_id: str,
    responses: List[PairwiseResponse],
    ri_table: Dict[int, float],
) -> Tuple[Optional[List[float]], Optional[float], Optional[float]]:
    node_matrices = [resp.matrix for resp in responses if resp.node_id == node_id]
    if not node_matrices:
        return None, None, None
    aggregated = aggregate_matrices(node_matrices)
    weights = compute_priority_vector(aggregated)
    ci, cr = compute_consistency(aggregated, ri_table)
    return weights, ci, cr


def compute_global_weights(
    nodes: List[HierarchyNode],
    responses: List[PairwiseResponse],
    ri_table: Dict[int, float],
) -> Dict[str, object]:
    children_map = build_children_map(nodes)
    root_nodes = children_map.get(None, [])
    local_weights_map: Dict[str, List[float]] = {}
    node_consistency: Dict[str, Dict[str, float]] = {}
    missing_nodes: List[str] = []

    for node in nodes:
        children = children_map.get(node.id, [])
        if not children:
            continue
        weights, ci, cr = compute_local_weights(node.id, responses, ri_table)
        if weights is None:
            missing_nodes.append(node.id)
            continue
        local_weights_map[node.id] = weights
        node_consistency[node.id] = {"ci": ci or 0.0, "cr": cr or 0.0}

    alternative_weights: Dict[str, float] = {}

    def walk(node_id: str, inherited_weight: float) -> None:
        children = children_map.get(node_id, [])
        if not children:
            alternative_weights[node_id] = alternative_weights.get(node_id, 0.0) + inherited_weight
            return
        local_weights = local_weights_map.get(node_id)
        if not local_weights:
            return
        for child, weight in zip(children, local_weights):
            walk(child.id, inherited_weight * weight)

    for root in root_nodes:
        walk(root.id, 1.0)

    return {
        "alternative_weights": alternative_weights,
        "node_consistency": node_consistency,
        "missing_nodes": missing_nodes,
    }

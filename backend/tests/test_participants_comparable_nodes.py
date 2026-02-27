"""
참여현황 API의 비교 노드(comparable nodes) 계산 검증.
루트가 유일한 비교 노드인 계층(루트 -> A, B)에서 total_nodes=1이 되어야 참여자 화면과 일치한다.
"""
from app.services.results import build_children_map


class _MockNode:
    """HierarchyNode와 동일한 필드만 사용하는 모의 객체."""
    __slots__ = ("id", "parent_id", "sort_order")

    def __init__(self, id: str, parent_id: str | None, sort_order: int = 0):
        self.id = id
        self.parent_id = parent_id
        self.sort_order = sort_order


def test_comparable_nodes_include_root_when_root_has_two_children():
    """루트만 자식 2개인 경우(루트->A,B): 비교 노드는 루트 1개여야 함 (관리자 참여현황 1/1 표시)."""
    root_id = "root"
    a_id = "a"
    b_id = "b"
    nodes = [
        _MockNode(root_id, None, 0),
        _MockNode(a_id, root_id, 0),
        _MockNode(b_id, root_id, 1),
    ]
    children_map = build_children_map(nodes)
    comparable_node_ids = [
        n.id for n in nodes
        if len(children_map.get(n.id, [])) >= 2
    ]
    assert len(comparable_node_ids) == 1
    assert comparable_node_ids[0] == root_id


def test_comparable_nodes_exclude_root_when_root_has_one_child():
    """루트에 자식 1개만 있으면 비교 노드 0개."""
    nodes = [
        _MockNode("root", None, 0),
        _MockNode("a", "root", 0),
    ]
    children_map = build_children_map(nodes)
    comparable_node_ids = [
        n.id for n in nodes
        if len(children_map.get(n.id, [])) >= 2
    ]
    assert len(comparable_node_ids) == 0


def test_comparable_nodes_multi_level():
    """여러 레벨에서 비교 노드 2개: 루트(자식 A,B), 중간(자식 C,D)."""
    nodes = [
        _MockNode("root", None, 0),
        _MockNode("a", "root", 0),
        _MockNode("b", "root", 1),
        _MockNode("mid", "root", 2),
        _MockNode("c", "mid", 0),
        _MockNode("d", "mid", 1),
    ]
    children_map = build_children_map(nodes)
    comparable_node_ids = [
        n.id for n in nodes
        if len(children_map.get(n.id, [])) >= 2
    ]
    assert set(comparable_node_ids) == {"root", "mid"}
    assert len(comparable_node_ids) == 2

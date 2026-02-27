/**
 * 계층 구조 공통 타입·상수 (구조도·편집 행 공통화용)
 */

export type NodeType = "goal" | "criteria" | "alternative";

/** 구조도·읽기 전용에 사용. id 없이 name, node_type, children 만 있으면 됨 */
export interface HierarchyNodeBase {
  name: string;
  node_type: string;
  children?: HierarchyNodeBase[];
}

export const nodeTypeOptions: { value: NodeType; label: string }[] = [
  { value: "goal", label: "목표" },
  { value: "criteria", label: "기준" },
  { value: "alternative", label: "대안" },
];

export const typeLabel: Record<NodeType, string> = {
  goal: "목표",
  criteria: "기준",
  alternative: "대안",
};

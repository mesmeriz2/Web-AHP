/**
 * API 요청/응답 타입 (백엔드 스키마와 동기화)
 */

import type { NodeType } from "./hierarchy";

export type UserRole = "super_admin" | "admin";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
};

export type UserLoginResponse = {
  token: string;
  expires_at: string;
  user: AuthUser;
};

export type UserListItem = {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

export type ProjectListItem = {
  id: string;
  name: string;
  description?: string;
  status: string;
  participant_count: number;
  admin_code: string;
  responded_count: number;
  owner_id?: string;
  owner_username?: string;
};

export type ProjectCreateResponse = {
  id: string;
  name: string;
  description?: string;
  participant_count: number;
  project_code: string;
  admin_code: string;
  participant_codes: string[];
};

export type ProjectSummary = {
  project_id: string;
  total_participants: number;
  responded_participants: number;
  high_inconsistency_nodes: string[];
};

export type ProjectResults = {
  project_id: string;
  alternative_weights: { node_id: string; name?: string; weight: number }[];
  node_consistency: Record<string, { ci: number; cr: number }>;
  missing_nodes: string[];
};

export type TemplateListItem = {
  id: string;
  name: string;
  description?: string;
  owner_id?: string;
  owner_username?: string;
};

export type HierarchyNodeInput = {
  name: string;
  node_type: string;
  children?: HierarchyNodeInput[];
};

export type TemplateDetail = {
  id: string;
  name: string;
  description?: string;
  hierarchy: HierarchyNodeInput;
  created_at: string;
  owner_id?: string;
  owner_username?: string;
};

export type AdminLoginResponse = {
  token: string;
  expires_at: string;
  user?: AuthUser;
};

export type HierarchyTreeNode = {
  id: string;
  name: string;
  node_type: NodeType;
  parent_id?: string | null;
  sort_order: number;
  children?: HierarchyTreeNode[];
};

export type ParticipantDetail = {
  participant_code: string;
  has_participated: boolean;
  completed_nodes: string[];
  total_nodes: number;
  completion_rate: number;
};

export type ProjectParticipantsResponse = {
  project_id: string;
  participants: ParticipantDetail[];
};

export type TasksResponse = {
  project_id: string;
  project_name: string;
  participant_id: string;
  participant_code: string;
  nodes: ParticipantTaskNode[];
};

export type ParticipantTaskNode = {
  id: string;
  name: string;
  node_type: string;
  parent_id?: string | null;
  sort_order: number;
  child_ids: string[];
  consistency_ratio?: number | null;
  matrix?: number[][] | null;
  consistency_index?: number | null;
};

export type SubmitResponse = {
  id: string;
  node_id: string;
  participant_id: string;
  consistency_index: number;
  consistency_ratio: number;
};

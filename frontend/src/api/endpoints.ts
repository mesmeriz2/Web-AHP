/**
 * API 경로 상수 (경로 변경 시 한 곳만 수정)
 */

const ADMIN_PREFIX = "/api/admin";
const PARTICIPANT_PREFIX = "/api/participant";
const USERS_PREFIX = "/api/users";

export const Endpoints = {
  health: "/api/health",

  admin: {
    login: `${ADMIN_PREFIX}/login`,
    projects: `${ADMIN_PREFIX}/projects`,
    project: (id: string) => `${ADMIN_PREFIX}/projects/${id}`,
    projectArchive: (id: string) => `${ADMIN_PREFIX}/projects/${id}/archive`,
    projectRestore: (id: string) => `${ADMIN_PREFIX}/projects/${id}/restore`,
    projectParticipants: (id: string) => `${ADMIN_PREFIX}/projects/${id}/participants`,
    projectSummary: (id: string) => `${ADMIN_PREFIX}/projects/${id}/summary`,
    projectResults: (id: string) => `${ADMIN_PREFIX}/projects/${id}/results`,
    projectHierarchy: (id: string) => `${ADMIN_PREFIX}/projects/${id}/hierarchy`,
    projectHierarchyNode: (projectId: string, nodeId: string) =>
      `${ADMIN_PREFIX}/projects/${projectId}/hierarchy/${nodeId}`,

    templates: `${ADMIN_PREFIX}/templates`,
    template: (id: string) => `${ADMIN_PREFIX}/templates/${id}`,
    templatesFromProject: `${ADMIN_PREFIX}/templates/from-project`,
  },

  users: {
    login: `${USERS_PREFIX}/login`,
    me: `${USERS_PREFIX}/me`,
    changePassword: `${USERS_PREFIX}/me/password`,
    list: USERS_PREFIX,
    create: USERS_PREFIX,
    user: (id: string) => `${USERS_PREFIX}/${id}`,
  },

  participant: {
    tasks: (code: string) => `${PARTICIPANT_PREFIX}/${encodeURIComponent(code)}/tasks`,
    submit: `${PARTICIPANT_PREFIX}/submit`,
  },
} as const;

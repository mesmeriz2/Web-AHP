import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { FiArrowLeft, FiEdit2, FiRefreshCw, FiPlus, FiSave } from "react-icons/fi";

import { useAuth } from "../contexts/AuthContext";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "../api/client";
import { Endpoints } from "../api/endpoints";
import type {
  HierarchyNodeInput,
  HierarchyTreeNode,
  ProjectCreateResponse,
  ProjectListItem,
  ProjectResults,
  TemplateDetail,
  TemplateListItem,
} from "../types/api";
import Layout from "../components/common/Layout";
import Sidebar, { AdminSectionId } from "../components/common/Sidebar";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import Alert from "../components/common/Alert";
import ProjectCard from "../components/admin/ProjectCard";
import TemplateCard from "../components/admin/TemplateCard";
import HierarchyManageModal from "../components/admin/HierarchyManageModal";
import ParticipantsModal from "../components/admin/ParticipantsModal";
import HierarchyStructureDiagram from "../components/common/HierarchyStructureDiagram";
import HierarchyNodeEditRow from "../components/common/HierarchyNodeEditRow";
import UserManagement from "../components/admin/UserManagement";
import ProfileSection from "../components/admin/ProfileSection";
import type { NodeType } from "../types/hierarchy";
import { nodeTypeOptions } from "../types/hierarchy";

type LocalHierarchyNode = {
  id: string;
  name: string;
  node_type: NodeType;
  children: LocalHierarchyNode[];
};

const createTempId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const createLocalNode = (nodeType: NodeType, name = "새 항목"): LocalHierarchyNode => ({
  id: createTempId(),
  name,
  node_type: nodeType,
  children: [],
});

const updateLocalNode = (
  node: LocalHierarchyNode,
  nodeId: string,
  updater: (target: LocalHierarchyNode) => LocalHierarchyNode
): LocalHierarchyNode => {
  if (node.id === nodeId) {
    return updater(node);
  }
  return { ...node, children: node.children.map((child) => updateLocalNode(child, nodeId, updater)) };
};

const removeLocalNode = (node: LocalHierarchyNode, nodeId: string): LocalHierarchyNode | null => {
  if (node.id === nodeId) {
    return null;
  }
  const nextChildren = node.children
    .map((child) => removeLocalNode(child, nodeId))
    .filter((child): child is LocalHierarchyNode => child !== null);
  return { ...node, children: nextChildren };
};

const flattenHierarchy = (root: HierarchyTreeNode | null): HierarchyTreeNode[] => {
  if (!root) {
    return [];
  }
  const result: HierarchyTreeNode[] = [root];
  (root.children || []).forEach((child) => result.push(...flattenHierarchy(child)));
  return result;
};

const buildHierarchyPayload = (node: LocalHierarchyNode): Record<string, unknown> => ({
  name: node.name,
  node_type: node.node_type,
  children: node.children.length > 0 ? node.children.map(buildHierarchyPayload) : undefined,
});

const hierarchyInputToLocal = (h: HierarchyNodeInput): LocalHierarchyNode => ({
  id: createTempId(),
  name: h.name,
  node_type: h.node_type as NodeType,
  children: (h.children ?? []).map(hierarchyInputToLocal),
});

const HierarchyBuilder = ({
  title,
  root,
  setRoot,
}: {
  title: string;
  root: LocalHierarchyNode | null;
  setRoot: (node: LocalHierarchyNode | null) => void;
}) => {
  const addRoot = () => setRoot(createLocalNode("goal", "목표"));

  const updateNode = (nodeId: string, updates: Partial<LocalHierarchyNode>) => {
    if (!root) {
      return;
    }
    setRoot(updateLocalNode(root, nodeId, (target) => ({ ...target, ...updates })));
  };

  const addChild = (nodeId: string, nodeType: NodeType) => {
    if (!root) {
      return;
    }
    setRoot(
      updateLocalNode(root, nodeId, (target) => ({
        ...target,
        children: [...target.children, createLocalNode(nodeType)],
      }))
    );
  };

  const removeNode = (nodeId: string) => {
    if (!root) {
      return;
    }
    const nextRoot = removeLocalNode(root, nodeId);
    setRoot(nextRoot);
  };

  const renderNode = (node: LocalHierarchyNode, depth = 0, parentNodeType?: NodeType) => {
    const availableOptions =
      parentNodeType === "goal"
        ? nodeTypeOptions.filter((opt) => opt.value !== "goal")
        : nodeTypeOptions;

    return (
      <div
        key={node.id}
        className="border-l-2 border-[var(--color-border)] pl-4 ml-4 mb-4"
        style={{ marginLeft: `${depth * 1.5}rem` }}
      >
        <HierarchyNodeEditRow
          nodeType={node.node_type}
          name={node.name}
          nodeTypeOptions={availableOptions}
          onNodeTypeChange={(value) => updateNode(node.id, { node_type: value as NodeType })}
          onNameChange={(value) => updateNode(node.id, { name: value })}
          onAddChild={() => addChild(node.id, "criteria")}
          onRemove={() => removeNode(node.id)}
          placeholder="이름"
        />
        {node.children.map((child) => renderNode(child, depth + 1, node.node_type))}
      </div>
    );
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {!root ? (
        <Button variant="primary" onClick={addRoot}>
          <FiPlus className="w-4 h-4 mr-1" />
          루트 생성
        </Button>
      ) : (
        <div className="form-stack">
          {renderNode(root)}
          <Button variant="outline" onClick={() => setRoot(null)}>
            루트 초기화
          </Button>
        </div>
      )}
    </Card>
  );
};

const AdminPage = () => {
  const { token, user, isSuperAdmin, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSectionId>("projects");
  const [projectTab, setProjectTab] = useState<"create" | "list">("list");
  const [templateTab, setTemplateTab] = useState<"list" | "create" | "from-project" | "detail" | "edit">("list");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [participantCount, setParticipantCount] = useState("4");
  const [templateId, setTemplateId] = useState("");
  const [createdProject, setCreatedProject] = useState<ProjectCreateResponse | null>(null);
  const [results, setResults] = useState<Record<string, ProjectResults>>({});
  const [resultsHierarchy, setResultsHierarchy] = useState<Record<string, HierarchyTreeNode>>({});
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateProjectId, setTemplateProjectId] = useState("");
  const [templateFromProjectName, setTemplateFromProjectName] = useState("");
  const [templateFromProjectDescription, setTemplateFromProjectDescription] = useState("");
  const [projectHierarchy, setProjectHierarchy] = useState<HierarchyTreeNode | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [editValues, setEditValues] = useState<Record<string, { name: string; node_type: NodeType }>>({});
  const [newChildValues, setNewChildValues] = useState<Record<string, { name: string; node_type: NodeType }>>({});
  const [rootValues, setRootValues] = useState<{ name: string; node_type: NodeType }>({
    name: "목표",
    node_type: "goal",
  });
  const [projectHierarchyRoot, setProjectHierarchyRoot] = useState<LocalHierarchyNode | null>(null);
  const [templateHierarchyRoot, setTemplateHierarchyRoot] = useState<LocalHierarchyNode | null>(null);
  const [selectedTemplateDetail, setSelectedTemplateDetail] = useState<TemplateDetail | null>(null);
  const [editTemplateId, setEditTemplateId] = useState("");
  const [editTemplateName, setEditTemplateName] = useState("");
  const [editTemplateDescription, setEditTemplateDescription] = useState("");
  const [editTemplateHierarchyRoot, setEditTemplateHierarchyRoot] = useState<LocalHierarchyNode | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [selectedProjectForParticipants, setSelectedProjectForParticipants] = useState<string | null>(null);
  const [participantsData, setParticipantsData] = useState<any[]>([]);
  const [hierarchyModalProject, setHierarchyModalProject] = useState<ProjectListItem | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    loadProjects();
    loadTemplates();
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    if (activeSection === 'projects') {
      loadProjects();
    } else if (activeSection === 'templates') {
      loadTemplates();
    }
  }, [activeSection, token]);

  const handleTokenExpired = () => {
    logout();
    setMessage("세션이 만료되었습니다. 다시 로그인해주세요.");
  };

  const handleApiError = (error: unknown, defaultMessage: string) => {
    if (error instanceof Error) {
      const apiError = error as Error & { isTokenExpired?: boolean };
      if (apiError.isTokenExpired) {
        handleTokenExpired();
        return;
      }
      setMessage(error.message);
    } else {
      setMessage(defaultMessage);
    }
  };

  const loadProjects = async () => {
    try {
      setMessage(null);
      const data = await apiGet<ProjectListItem[]>(Endpoints.admin.projects, { token });
      setProjects(data);
    } catch (error) {
      handleApiError(error, "프로젝트 목록 조회 오류");
    }
  };

  const loadTemplates = async () => {
    try {
      setMessage(null);
      const data = await apiGet<TemplateListItem[]>(Endpoints.admin.templates, { token });
      setTemplates(data);
    } catch (error) {
      handleApiError(error, "템플릿 목록 조회 오류");
    }
  };

  const handleCreateProject = async () => {
    try {
      setMessage(null);
      const count = Number(participantCount);
      const payload: Record<string, unknown> = {
        name: projectName,
        description: projectDescription || undefined,
        participant_count: count,
      };

      if (templateId.trim()) {
        payload.template_id = templateId.trim();
      } else if (projectHierarchyRoot) {
        payload.hierarchy = buildHierarchyPayload(projectHierarchyRoot);
      } else {
        throw new Error("계층 구조를 생성하거나 템플릿을 선택하세요.");
      }

      const data = await apiPost<ProjectCreateResponse, typeof payload>(Endpoints.admin.projects, payload, {
        token,
      });
      setCreatedProject(data);
      setProjectName("");
      setProjectDescription("");
      setTemplateId("");
      setProjectHierarchyRoot(null);
      await loadProjects();
    } catch (error) {
      handleApiError(error, "프로젝트 생성 오류");
    }
  };

  const handleCreateTemplate = async () => {
    try {
      setMessage(null);
      if (!templateHierarchyRoot) {
        throw new Error("템플릿 계층 구조를 먼저 구성하세요.");
      }
      const payload = {
        name: templateName,
        description: templateDescription || undefined,
        hierarchy: buildHierarchyPayload(templateHierarchyRoot),
      };
      const data = await apiPost<TemplateListItem, typeof payload>(Endpoints.admin.templates, payload, {
        token,
      });
      setTemplates((prev) => [data, ...prev]);
      setTemplateName("");
      setTemplateDescription("");
      setTemplateHierarchyRoot(null);
      await loadTemplates();
    } catch (error) {
      handleApiError(error, "템플릿 생성 오류");
    }
  };

  const handleCreateTemplateFromProject = async () => {
    try {
      setMessage(null);

      if (!templateProjectId) {
        setMessage("프로젝트를 선택하세요.");
        return;
      }

      const payload = {
        project_id: templateProjectId,
        name: templateFromProjectName,
        description: templateFromProjectDescription || undefined,
      };
      const data = await apiPost<TemplateListItem, typeof payload>(Endpoints.admin.templatesFromProject, payload, {
        token,
      });
      setTemplates((prev) => [data, ...prev]);
      setTemplateProjectId("");
      setTemplateFromProjectName("");
      setTemplateFromProjectDescription("");
      await loadTemplates();
      setMessage("템플릿이 성공적으로 저장되었습니다.");
    } catch (error) {
      handleApiError(error, "템플릿 저장 오류");
    }
  };

  const fetchTemplateDetail = async (id: string): Promise<TemplateDetail | null> => {
    try {
      setMessage(null);
      const data = await apiGet<TemplateDetail>(Endpoints.admin.template(id), { token });
      return data;
    } catch (error) {
      handleApiError(error, "템플릿 상세 조회 오류");
      return null;
    }
  };

  const handleViewTemplate = async (id: string) => {
    const detail = await fetchTemplateDetail(id);
    if (detail) {
      setSelectedTemplateDetail(detail);
      setTemplateTab("detail");
    }
  };

  const handleEditTemplate = async (id: string) => {
    const detail = await fetchTemplateDetail(id);
    if (detail) {
      setEditTemplateId(detail.id);
      setEditTemplateName(detail.name);
      setEditTemplateDescription(detail.description ?? "");
      setEditTemplateHierarchyRoot(hierarchyInputToLocal(detail.hierarchy));
      setTemplateTab("edit");
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editTemplateId || !editTemplateHierarchyRoot) {
      setMessage("템플릿 계층 구조를 입력하세요.");
      return;
    }
    try {
      setMessage(null);
      const payload = {
        name: editTemplateName,
        description: editTemplateDescription || undefined,
        hierarchy: buildHierarchyPayload(editTemplateHierarchyRoot),
      };
      await apiPut<TemplateListItem, typeof payload>(
        Endpoints.admin.template(editTemplateId),
        payload,
        { token }
      );
      setEditTemplateId("");
      setEditTemplateName("");
      setEditTemplateDescription("");
      setEditTemplateHierarchyRoot(null);
      setTemplateTab("list");
      await loadTemplates();
      setMessage("템플릿이 수정되었습니다.");
    } catch (error) {
      handleApiError(error, "템플릿 수정 오류");
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm("이 템플릿을 삭제하시겠습니까?")) {
      return;
    }
    try {
      setMessage(null);
      await apiDelete(Endpoints.admin.template(id), { token });
      if (selectedTemplateDetail?.id === id) {
        setSelectedTemplateDetail(null);
        setTemplateTab("list");
      }
      await loadTemplates();
      setMessage("템플릿이 삭제되었습니다.");
    } catch (error) {
      handleApiError(error, "템플릿 삭제 오류");
    }
  };

  const handleTemplateBackToList = () => {
    setSelectedTemplateDetail(null);
    setEditTemplateId("");
    setEditTemplateName("");
    setEditTemplateDescription("");
    setEditTemplateHierarchyRoot(null);
    setTemplateTab("list");
  };

  const fetchResults = async (projectId: string) => {
    try {
      setMessage(null);
      const data = await apiGet<ProjectResults>(
        Endpoints.admin.projectResults(projectId),
        { token }
      );
      setResults((prev) => ({ ...prev, [projectId]: data }));
      try {
        const hierarchy = await apiGet<HierarchyTreeNode>(
          Endpoints.admin.projectHierarchy(projectId),
          { token }
        );
        setResultsHierarchy((prev) => ({ ...prev, [projectId]: hierarchy }));
      } catch {
        setResultsHierarchy((prev) => {
          const next = { ...prev };
          delete next[projectId];
          return next;
        });
      }
    } catch (error) {
      handleApiError(error, "결과 조회 오류");
    }
  };

  const archiveProject = async (projectId: string) => {
    try {
      setMessage(null);
      await apiPost(Endpoints.admin.projectArchive(projectId), {}, { token });
      await loadProjects();
    } catch (error) {
      handleApiError(error, "프로젝트 보관 오류");
    }
  };

  const restoreProject = async (projectId: string) => {
    try {
      setMessage(null);
      await apiPost(Endpoints.admin.projectRestore(projectId), {}, { token });
      await loadProjects();
    } catch (error) {
      handleApiError(error, "프로젝트 복원 오류");
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm("정말로 이 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      return;
    }
    try {
      setMessage(null);
      await apiDelete(Endpoints.admin.project(projectId), { token });
      await loadProjects();
    } catch (error) {
      handleApiError(error, "프로젝트 삭제 오류");
    }
  };

  const openHierarchyModal = (project: ProjectListItem) => {
    setProjectHierarchy(null);
    setHierarchyModalProject(project);
    setSelectedProjectId(project.id);
    loadHierarchy(project.id);
  };

  const viewParticipants = async (projectId: string) => {
    try {
      setMessage(null);
      if (!token) {
        setMessage("로그인이 필요합니다.");
        return;
      }
      const data = await apiGet<any>(
        Endpoints.admin.projectParticipants(projectId),
        { token }
      );
      if (data && data.participants) {
        setParticipantsData(data.participants);
        setSelectedProjectForParticipants(projectId);
        setParticipantsModalOpen(true);
      } else {
        setMessage("참여자 정보를 불러올 수 없습니다.");
      }
    } catch (error) {
      handleApiError(error, "참여자 정보 조회 오류");
    }
  };

  const loadHierarchy = async (projectId: string) => {
    try {
      setMessage(null);
      const data = await apiGet<HierarchyTreeNode>(Endpoints.admin.projectHierarchy(projectId), {
        token,
      });
      setProjectHierarchy(data);
      const flattened = flattenHierarchy(data);
      setEditValues(
        flattened.reduce(
          (acc, node) => ({
            ...acc,
            [node.id]: { name: node.name, node_type: node.node_type },
          }),
          {} as Record<string, { name: string; node_type: NodeType }>
        )
      );
    } catch (error) {
      setProjectHierarchy(null);
      handleApiError(error, "계층 조회 오류");
    }
  };

  const updateHierarchyNode = async (nodeId: string) => {
    try {
      const values = editValues[nodeId];
      if (!values) {
        return;
      }
      await apiPatch(Endpoints.admin.projectHierarchyNode(selectedProjectId, nodeId), values, {
        token,
      });
      await loadHierarchy(selectedProjectId);
    } catch (error) {
      handleApiError(error, "노드 수정 오류");
    }
  };

  const addHierarchyChild = async (parentId: string) => {
    try {
      const values = newChildValues[parentId] || { name: "새 항목", node_type: "criteria" as NodeType };
      await apiPost(
        Endpoints.admin.projectHierarchy(selectedProjectId),
        { ...values, parent_id: parentId },
        { token }
      );
      setNewChildValues((prev) => ({ ...prev, [parentId]: { name: "새 항목", node_type: "criteria" } }));
      await loadHierarchy(selectedProjectId);
    } catch (error) {
      handleApiError(error, "하위 노드 추가 오류");
    }
  };

  const addHierarchyRoot = async (overrideValues?: { name: string; node_type: NodeType }) => {
    try {
      const payload = (overrideValues ?? rootValues);
      await apiPost(
        Endpoints.admin.projectHierarchy(selectedProjectId),
        { ...payload, parent_id: null },
        { token }
      );
      await loadHierarchy(selectedProjectId);
    } catch (error) {
      handleApiError(error, "루트 생성 오류");
    }
  };

  const deleteHierarchyNode = async (nodeId: string) => {
    try {
      await apiDelete(Endpoints.admin.projectHierarchyNode(selectedProjectId, nodeId), { token });
      await loadHierarchy(selectedProjectId);
    } catch (error) {
      handleApiError(error, "노드 삭제 오류");
    }
  };

  const maxWeight = useMemo(() => {
    const values = Object.values(results).flatMap((item) => item.alternative_weights);
    return values.reduce((maxValue, item) => Math.max(maxValue, item.weight), 0) || 1;
  }, [results]);

  const templateOptions = useMemo(
    () => [
      { value: "", label: "템플릿 선택 (선택사항)" },
      ...templates.map((template) => ({
        value: template.id,
        label: `${template.name} (${template.id})`,
      })),
    ],
    [templates]
  );

  return (
    <Layout
      showSidebar={true}
      sidebar={
        <Sidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      }
    >
      <div className="space-y-6">
        {message && (
          <Alert variant="error" onClose={() => setMessage(null)}>
            {message}
          </Alert>
        )}

        {activeSection === "projects" && (
          <Card>
            <div className="tab-list mb-6" role="tablist" aria-label="프로젝트 관리 탭">
              <button
                type="button"
                onClick={() => setProjectTab("list")}
                className={`tab-button ${projectTab === "list" ? "is-active" : ""}`}
                role="tab"
                aria-selected={projectTab === "list"}
              >
                프로젝트 목록
              </button>
              <button
                type="button"
                onClick={() => setProjectTab("create")}
                className={`tab-button ${projectTab === "create" ? "is-active" : ""}`}
                role="tab"
                aria-selected={projectTab === "create"}
              >
                프로젝트 생성
              </button>
            </div>
            {projectTab === "create" && (
              <div className="form-stack">
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="프로젝트 이름"
                  label="프로젝트 이름"
                />
                <Input
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="설명"
                  label="설명"
                />
                <div className="project-form-row">
                  <Input
                    value={participantCount}
                    onChange={(e) => setParticipantCount(e.target.value)}
                    placeholder="참여 인원"
                    label="참여 인원"
                    type="number"
                  />
                  <Select
                    options={templateOptions}
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    label="템플릿"
                  />
                </div>
                <HierarchyBuilder
                  title="계층 구조 생성"
                  root={projectHierarchyRoot}
                  setRoot={setProjectHierarchyRoot}
                />
                <Button variant="primary" onClick={handleCreateProject} className="w-full">
                  <FiPlus className="w-4 h-4 mr-1" />
                  프로젝트 생성
                </Button>
                {createdProject && (
                  <Card className="bg-[var(--color-bg-tertiary)]">
                    <h3 className="font-semibold mb-2">생성된 프로젝트 정보</h3>
                    <div className="space-y-1 text-sm">
                      <p>프로젝트 코드: {createdProject.project_code}</p>
                      <p>관리자 코드: {createdProject.admin_code}</p>
                      <p>참여자 코드: {createdProject.participant_codes.join(", ")}</p>
                    </div>
                  </Card>
                )}
              </div>
            )}
            {projectTab === "list" && (
              <div className="space-y-4">
                {projects.length === 0 ? (
                  <p className="text-[var(--color-text-secondary)]">프로젝트가 없습니다. 프로젝트 생성 탭에서 새 프로젝트를 만드세요.</p>
                ) : (
                  projects.map((project) => {
                    const result = results[project.id];
                    const showParticipants = selectedProjectForParticipants === project.id && participantsModalOpen;
                    const showResults = result && !showParticipants;
                    return (
                      <div key={project.id}>
                        <ProjectCard
                          project={project}
                          onManageHierarchy={() => openHierarchyModal(project)}
                          onFetchResults={() => {
                            if (selectedProjectForParticipants === project.id) {
                              setParticipantsModalOpen(false);
                              setSelectedProjectForParticipants(null);
                              setParticipantsData([]);
                            }
                            fetchResults(project.id);
                          }}
                          onViewParticipants={() => {
                            if (results[project.id]) {
                              setResults((prev) => {
                                const newResults = { ...prev };
                                delete newResults[project.id];
                                return newResults;
                              });
                              setResultsHierarchy((prev) => {
                                const next = { ...prev };
                                delete next[project.id];
                                return next;
                              });
                            }
                            viewParticipants(project.id);
                          }}
                          onArchive={() => archiveProject(project.id)}
                          onRestore={() => restoreProject(project.id)}
                          onDelete={() => deleteProject(project.id)}
                          results={showResults ? result : undefined}
                          hierarchy={showResults ? resultsHierarchy[project.id] : undefined}
                          maxWeight={maxWeight}
                          isSuperAdmin={isSuperAdmin}
                        />
                        {showParticipants && (
                          <ParticipantsModal
                            isOpen={participantsModalOpen}
                            onClose={() => {
                              setParticipantsModalOpen(false);
                              setSelectedProjectForParticipants(null);
                              setParticipantsData([]);
                            }}
                            projectName={project.name}
                            participants={participantsData}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </Card>
        )}

        {hierarchyModalProject && (
          <HierarchyManageModal
            isOpen={!!hierarchyModalProject}
            onClose={() => setHierarchyModalProject(null)}
            projectName={hierarchyModalProject.name}
            projectId={hierarchyModalProject.id}
            respondedCount={hierarchyModalProject.responded_count ?? 0}
            hierarchy={selectedProjectId === hierarchyModalProject.id ? projectHierarchy : null}
            editValues={editValues}
            newChildValues={newChildValues}
            rootValues={rootValues}
            onEditValueChange={(nodeId, value) =>
              setEditValues((prev) => ({ ...prev, [nodeId]: value }))
            }
            onNewChildValueChange={(parentId, value) =>
              setNewChildValues((prev) => ({ ...prev, [parentId]: value }))
            }
            onRootValueChange={setRootValues}
            onUpdateNode={updateHierarchyNode}
            onDeleteNode={deleteHierarchyNode}
            onAddChild={addHierarchyChild}
            onAddRoot={addHierarchyRoot}
          />
        )}

        {activeSection === "templates" && (
          <Card>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">템플릿 관리</h2>
              {(templateTab === "detail" || templateTab === "edit") && (
                <Button variant="outline" size="sm" onClick={handleTemplateBackToList}>
                  <FiArrowLeft className="w-4 h-4 mr-1" />
                  목록으로
                </Button>
              )}
            </div>

            {(templateTab === "list" || templateTab === "create" || templateTab === "from-project") && (
              <div className="tab-list mb-6">
                <button
                  type="button"
                  className={`tab-button ${templateTab === "list" ? "is-active" : ""}`}
                  onClick={() => setTemplateTab("list")}
                >
                  템플릿 목록
                </button>
                <button
                  type="button"
                  className={`tab-button ${templateTab === "create" ? "is-active" : ""}`}
                  onClick={() => setTemplateTab("create")}
                >
                  템플릿 생성
                </button>
                <button
                  type="button"
                  className={`tab-button ${templateTab === "from-project" ? "is-active" : ""}`}
                  onClick={() => setTemplateTab("from-project")}
                >
                  프로젝트에서 저장
                </button>
              </div>
            )}

            {templateTab === "list" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">템플릿 목록</h3>
                  <Button variant="outline" size="sm" onClick={loadTemplates}>
                    <FiRefreshCw className="w-4 h-4 mr-1" />
                    새로고침
                  </Button>
                </div>
                {templates.length === 0 ? (
                  <p className="text-[var(--color-text-secondary)] py-8 text-center">
                    템플릿이 없습니다.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onView={handleViewTemplate}
                        onEdit={handleEditTemplate}
                        onDelete={handleDeleteTemplate}
                        canEdit={isSuperAdmin || template.owner_id === user?.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {templateTab === "detail" && selectedTemplateDetail && (
              <div className="form-stack">
                <h3 className="text-lg font-semibold">{selectedTemplateDetail.name}</h3>
                {selectedTemplateDetail.description && (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {selectedTemplateDetail.name} | {selectedTemplateDetail.description}
                  </p>
                )}
                <p className="text-sm text-[var(--color-text-muted)]">
                  생성일: {new Date(selectedTemplateDetail.created_at).toLocaleDateString()}
                  {selectedTemplateDetail.owner_username && ` | 소유자: ${selectedTemplateDetail.owner_username}`}
                </p>
                <div className="mt-4">
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
                    <Typography variant="body2" fontWeight={500} color="text.secondary" sx={{ mb: 1.5 }}>
                      구조도
                    </Typography>
                    <HierarchyStructureDiagram node={selectedTemplateDetail.hierarchy} depth={0} />
                  </Paper>
                </div>
                {(isSuperAdmin || selectedTemplateDetail.owner_id === user?.id) && (
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => handleEditTemplate(selectedTemplateDetail.id)}>
                      <FiEdit2 className="w-4 h-4 mr-1" />
                      수정
                    </Button>
                  </div>
                )}
              </div>
            )}

            {templateTab === "edit" && (
              <form
                className="form-stack max-w-2xl"
                onSubmit={(e) => e.preventDefault()}
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              >
                <h3 className="text-lg font-semibold mb-4">템플릿 수정</h3>
                <Input
                  value={editTemplateName}
                  onChange={(e) => setEditTemplateName(e.target.value)}
                  placeholder="템플릿 이름"
                  label="템플릿 이름"
                />
                <Input
                  value={editTemplateDescription}
                  onChange={(e) => setEditTemplateDescription(e.target.value)}
                  placeholder="설명"
                  label="설명"
                />
                <HierarchyBuilder
                  title="템플릿 계층 구조"
                  root={editTemplateHierarchyRoot}
                  setRoot={setEditTemplateHierarchyRoot}
                />
                <Button variant="primary" onClick={handleUpdateTemplate} type="button" className="w-full">
                  <FiSave className="w-4 h-4 mr-1" />
                  수정 저장
                </Button>
              </form>
            )}

            {templateTab === "create" && (
              <div>
                <h3 className="text-lg font-semibold mb-4">새 템플릿 생성</h3>
                <form
                  className="form-stack max-w-2xl"
                  onSubmit={(e) => e.preventDefault()}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                >
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="템플릿 이름"
                    label="템플릿 이름"
                  />
                  <Input
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="설명"
                    label="설명"
                  />
                  <HierarchyBuilder
                    title="템플릿 계층 구조"
                    root={templateHierarchyRoot}
                    setRoot={setTemplateHierarchyRoot}
                  />
                  <Button variant="primary" onClick={handleCreateTemplate} type="button" className="w-full">
                    <FiSave className="w-4 h-4 mr-1" />
                    템플릿 저장
                  </Button>
                </form>
              </div>
            )}

            {templateTab === "from-project" && (
              <div>
                <h3 className="text-lg font-semibold mb-4">프로젝트에서 템플릿 저장</h3>
                <form
                  className="form-stack max-w-2xl"
                  onSubmit={(e) => e.preventDefault()}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                >
                  <Select
                    options={[
                      { value: "", label: "프로젝트 선택" },
                      ...projects.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                    value={templateProjectId}
                    onChange={(e) => setTemplateProjectId(e.target.value)}
                    label="프로젝트 선택"
                  />
                  <Input
                    value={templateFromProjectName}
                    onChange={(e) => setTemplateFromProjectName(e.target.value)}
                    placeholder="템플릿 이름"
                    label="템플릿 이름"
                  />
                  <Input
                    value={templateFromProjectDescription}
                    onChange={(e) => setTemplateFromProjectDescription(e.target.value)}
                    placeholder="설명"
                    label="설명"
                  />
                  <Button variant="primary" onClick={handleCreateTemplateFromProject} type="button" className="w-full">
                    <FiSave className="w-4 h-4 mr-1" />
                    프로젝트에서 템플릿 저장
                  </Button>
                </form>
              </div>
            )}
          </Card>
        )}

        {activeSection === "users" && <UserManagement />}

        {activeSection === "profile" && <ProfileSection />}
      </div>
    </Layout>
  );
};

export default AdminPage;

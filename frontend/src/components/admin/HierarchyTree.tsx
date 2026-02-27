import React, { useRef, useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { FiPlus } from "react-icons/fi";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";
import HierarchyStructureDiagram from "../common/HierarchyStructureDiagram";
import HierarchyNodeEditRow from "../common/HierarchyNodeEditRow";
import type { NodeType } from "../../types/hierarchy";
import { nodeTypeOptions } from "../../types/hierarchy";
import {
  HIERARCHY_EDIT_DEBOUNCE_MS,
  HIERARCHY_AUTO_SAVE_DELAY_MS,
} from "../../constants/hierarchy";

interface HierarchyTreeNode {
  id: string;
  name: string;
  node_type: NodeType;
  parent_id?: string | null;
  sort_order: number;
  children?: HierarchyTreeNode[];
}

interface HierarchyTreeProps {
  hierarchy: HierarchyTreeNode | null;
  editValues: Record<string, { name: string; node_type: NodeType }>;
  newChildValues: Record<string, { name: string; node_type: NodeType }>;
  rootValues: { name: string; node_type: NodeType };
  onEditValueChange: (nodeId: string, value: { name: string; node_type: NodeType }) => void;
  onNewChildValueChange: (parentId: string, value: { name: string; node_type: NodeType }) => void;
  onRootValueChange: (value: { name: string; node_type: NodeType }) => void;
  onUpdateNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
  /** 루트 생성. values 전달 시 해당 값으로 생성(디바운스 미반영 시 클릭 대비) */
  onAddRoot: (values?: { name: string; node_type: NodeType }) => void;
}

const HierarchyTree: React.FC<HierarchyTreeProps> = ({
  hierarchy,
  editValues,
  newChildValues,
  rootValues,
  onEditValueChange,
  onNewChildValueChange,
  onRootValueChange,
  onUpdateNode,
  onDeleteNode,
  onAddChild,
  onAddRoot,
}) => {
  const saveTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const editDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const rootDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 노드별 로컬 편집값. 키 입력 시 즉시 반영해 IME 깨짐 방지, 부모에는 디바운스 후 반영 */
  const [localEditValues, setLocalEditValues] = useState<
    Record<string, { name: string; node_type: NodeType }>
  >(() => ({ ...editValues }));
  const localEditValuesRef = useRef(localEditValues);

  /** 루트 생성 폼용 로컬값 (한글 입력 시 동일 이슈 방지) */
  const [localRootValues, setLocalRootValues] = useState(rootValues);
  const localRootValuesRef = useRef(localRootValues);

  localEditValuesRef.current = localEditValues;
  localRootValuesRef.current = localRootValues;

  // hierarchy·editValues가 바뀌면(프로젝트 전환·재조회·커밋 반영) 부모 editValues로 로컬 동기화
  useEffect(() => {
    setLocalEditValues({ ...editValues });
  }, [hierarchy, editValues]);

  // 루트 폼 표시 시 부모 rootValues로 로컬 동기화
  useEffect(() => {
    if (!hierarchy) {
      setLocalRootValues(rootValues);
    }
  }, [hierarchy, rootValues]);

  // 컴포넌트 언마운트 시 모든 타이머 정리
  useEffect(() => {
    return () => {
      Object.values(saveTimeoutsRef.current).forEach((timeout) => clearTimeout(timeout));
      saveTimeoutsRef.current = {};
      Object.values(editDebounceRef.current).forEach((timeout) => clearTimeout(timeout));
      editDebounceRef.current = {};
      if (rootDebounceRef.current) {
        clearTimeout(rootDebounceRef.current);
        rootDebounceRef.current = null;
      }
    };
  }, []);

  const scheduleAutoSave = useCallback(
    (nodeId: string) => {
      if (saveTimeoutsRef.current[nodeId]) {
        clearTimeout(saveTimeoutsRef.current[nodeId]);
      }
      saveTimeoutsRef.current[nodeId] = setTimeout(() => {
        onUpdateNode(nodeId);
        delete saveTimeoutsRef.current[nodeId];
      }, HIERARCHY_AUTO_SAVE_DELAY_MS);
    },
    [onUpdateNode]
  );

  /** 로컬 변경을 디바운스 후 부모에 반영하고 자동 저장 예약 */
  const commitEditDebounced = useCallback(
    (nodeId: string) => {
      if (editDebounceRef.current[nodeId]) {
        clearTimeout(editDebounceRef.current[nodeId]);
      }
      editDebounceRef.current[nodeId] = setTimeout(() => {
        delete editDebounceRef.current[nodeId];
        const values = localEditValuesRef.current[nodeId];
        if (values) {
          onEditValueChange(nodeId, values);
          scheduleAutoSave(nodeId);
        }
      }, HIERARCHY_EDIT_DEBOUNCE_MS);
    },
    [onEditValueChange, scheduleAutoSave]
  );

  const handleEditChange = useCallback(
    (nodeId: string, value: { name: string; node_type: NodeType }) => {
      setLocalEditValues((prev) => ({ ...prev, [nodeId]: value }));
      commitEditDebounced(nodeId);
    },
    [commitEditDebounced]
  );

  const handleRootValueChange = useCallback(
    (value: { name: string; node_type: NodeType }) => {
      setLocalRootValues(value);
      if (rootDebounceRef.current) {
        clearTimeout(rootDebounceRef.current);
      }
      rootDebounceRef.current = setTimeout(() => {
        rootDebounceRef.current = null;
        onRootValueChange(localRootValuesRef.current);
      }, HIERARCHY_EDIT_DEBOUNCE_MS);
    },
    [onRootValueChange]
  );

  const renderNode = (node: HierarchyTreeNode, depth = 0, parentNodeType?: NodeType) => {
    const fromParent = editValues[node.id] ?? { name: node.name, node_type: node.node_type };
    const editValue = localEditValues[node.id] ?? fromParent;
    const availableOptions =
      parentNodeType === "goal"
        ? nodeTypeOptions.filter((opt) => opt.value !== "goal")
        : nodeTypeOptions;

    return (
      <Box
        key={node.id}
        sx={{
          borderLeft: 2,
          borderColor: "divider",
          pl: 2,
          ml: 2,
          mb: 1,
          marginLeft: `${depth * 1.5}rem`,
        }}
      >
        <HierarchyNodeEditRow
          nodeType={editValue.node_type}
          name={editValue.name}
          nodeTypeOptions={availableOptions}
          onNodeTypeChange={(value) =>
            handleEditChange(node.id, { ...editValue, node_type: value as NodeType })
          }
          onNameChange={(value) => handleEditChange(node.id, { ...editValue, name: value })}
          onAddChild={() => onAddChild(node.id)}
          onRemove={() => onDeleteNode(node.id)}
          placeholder="이름"
        />

        {node.children && node.children.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {node.children.map((child) => renderNode(child, depth + 1, node.node_type))}
          </Box>
        )}
      </Box>
    );
  };

  if (!hierarchy) {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          계층 정보가 없습니다. 루트 노드를 생성하세요.
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Box sx={{ flexShrink: 0, width: 72, minWidth: 72 }}>
            <Select
              options={nodeTypeOptions}
              value={localRootValues.node_type}
              onChange={(e) =>
                handleRootValueChange({
                  ...localRootValues,
                  node_type: e.target.value as NodeType,
                })
              }
              sx={{
                "& .MuiInputBase-root": {
                  height: 36,
                  minHeight: 36,
                  maxHeight: 36,
                  bgcolor: "action.hover",
                  "&.Mui-focused": { bgcolor: "background.paper" },
                },
                "& .MuiOutlinedInput-input, & .MuiSelect-select": {
                  py: 0.5,
                  boxSizing: "border-box",
                },
              }}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Input
              value={localRootValues.name}
              onChange={(e) =>
                handleRootValueChange({ ...localRootValues, name: e.target.value })
              }
              placeholder="루트 이름"
            />
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <Button
              variant="primary"
              onClick={() => {
                if (rootDebounceRef.current) {
                  clearTimeout(rootDebounceRef.current);
                  rootDebounceRef.current = null;
                  onRootValueChange(localRootValuesRef.current);
                }
                onAddRoot(localRootValuesRef.current);
              }}
              startIcon={<FiPlus size={16} />}
            >
              루트 생성
            </Button>
          </Box>
        </Box>
      </Paper>
    );
  }

  return (
    <Box sx={{ "& > * + *": { mt: 2 } }}>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
        <Typography variant="body2" fontWeight={500} color="text.secondary" sx={{ mb: 1.5 }}>
          구조도
        </Typography>
        <HierarchyStructureDiagram node={hierarchy} depth={0} />
      </Paper>
      <Box sx={{ "& > * + *": { mt: 1 } }}>
        <Typography variant="body2" fontWeight={500} color="text.secondary" sx={{ mb: 1 }}>
          편집
        </Typography>
        {renderNode(hierarchy)}
      </Box>
    </Box>
  );
};

export default HierarchyTree;

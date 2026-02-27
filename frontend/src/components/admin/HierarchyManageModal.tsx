import React, { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { FiX, FiEdit2, FiArrowLeft } from "react-icons/fi";
import Button from "../common/Button";
import HierarchyStructureDiagram from "../common/HierarchyStructureDiagram";
import HierarchyTree from "./HierarchyTree";
import type { HierarchyTreeNode } from "../../types/api";
import type { NodeType } from "../../types/hierarchy";

interface HierarchyManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectId: string;
  respondedCount: number;
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
  onAddRoot: (values?: { name: string; node_type: NodeType }) => void;
}

const HierarchyManageModal: React.FC<HierarchyManageModalProps> = ({
  isOpen,
  onClose,
  projectName,
  respondedCount,
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
  const [mode, setMode] = useState<"view" | "edit">("view");

  useEffect(() => {
    if (isOpen) {
      setMode("view");
    }
  }, [isOpen]);

  const canEdit = respondedCount === 0;

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>계층구조 관리 — {projectName}</span>
        <IconButton aria-label="닫기" onClick={onClose} size="small">
          <FiX size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {mode === "view" && (
          <Box sx={{ "& > * + *": { mt: 2 } }}>
            {!hierarchy ? (
              <Typography color="text.secondary">계층 구조를 불러오는 중이거나 없습니다.</Typography>
            ) : (
              <>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
                  <Typography variant="body2" fontWeight={500} color="text.secondary" sx={{ mb: 1.5 }}>
                    구조도
                  </Typography>
                  <HierarchyStructureDiagram node={hierarchy} depth={0} />
                </Paper>
                {!canEdit && (
                  <Typography variant="body2" color="warning.main">
                    설문 응답이 시작되어 수정할 수 없습니다.
                  </Typography>
                )}
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setMode("edit")}
                    disabled={!canEdit}
                    startIcon={<FiEdit2 size={16} />}
                  >
                    수정
                  </Button>
                </Box>
              </>
            )}
          </Box>
        )}

        {mode === "edit" && hierarchy && (
          <Box sx={{ "& > * + *": { mt: 2 } }}>
            <Button variant="outline" size="sm" onClick={() => setMode("view")} startIcon={<FiArrowLeft size={16} />}>
              보기로 돌아가기
            </Button>
            <HierarchyTree
              hierarchy={hierarchy}
              editValues={editValues}
              newChildValues={newChildValues}
              rootValues={rootValues}
              onEditValueChange={onEditValueChange}
              onNewChildValueChange={onNewChildValueChange}
              onRootValueChange={onRootValueChange}
              onUpdateNode={onUpdateNode}
              onDeleteNode={onDeleteNode}
              onAddChild={onAddChild}
              onAddRoot={onAddRoot}
            />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HierarchyManageModal;

import React from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Button from "./Button";
import Input from "./Input";
import Select from "./Select";
export interface NodeTypeOption {
  value: string;
  label: string;
}

interface HierarchyNodeEditRowProps {
  nodeType: string;
  name: string;
  nodeTypeOptions: NodeTypeOption[];
  onNodeTypeChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onAddChild: () => void;
  onRemove: () => void;
  placeholder?: string;
}

const selectSx = {
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
};

const HierarchyNodeEditRow: React.FC<HierarchyNodeEditRowProps> = ({
  nodeType,
  name,
  nodeTypeOptions,
  onNodeTypeChange,
  onNameChange,
  onAddChild,
  onRemove,
  placeholder = "이름",
}) => {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: "background.paper" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ flexShrink: 0, width: 72, minWidth: 72 }}>
          <Select
            options={nodeTypeOptions}
            value={nodeType}
            onChange={(e) => onNodeTypeChange(e.target.value)}
            sx={selectSx}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={placeholder}
          />
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
          <Button variant="outline" size="sm" onClick={onAddChild}>
            하위 추가
          </Button>
          <Button variant="danger" size="sm" onClick={onRemove}>
            삭제
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default HierarchyNodeEditRow;

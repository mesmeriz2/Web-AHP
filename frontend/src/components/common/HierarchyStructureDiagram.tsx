import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { HierarchyNodeBase } from "../../types/hierarchy";
import { typeLabel } from "../../types/hierarchy";

interface HierarchyStructureDiagramProps {
  node: HierarchyNodeBase;
  depth?: number;
}

const HierarchyStructureDiagram: React.FC<HierarchyStructureDiagramProps> = ({
  node,
  depth = 0,
}) => {
  const label = typeLabel[node.node_type as keyof typeof typeLabel] ?? node.node_type;
  const children = node.children ?? [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          width: "fit-content",
          marginLeft: `${depth * 1.25}rem`,
        }}
      >
        <Typography component="span" variant="body2" fontWeight={500}>
          {node.name}
        </Typography>
        <Typography component="span" variant="caption" color="text.disabled">
          ({label})
        </Typography>
      </Box>
      {children.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            pl: 1,
            borderLeft: 2,
            borderColor: "divider",
            ml: 1,
          }}
        >
          {children.map((child, i) => (
            <HierarchyStructureDiagram key={i} node={child} depth={depth + 1} />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default HierarchyStructureDiagram;

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "../common/Card";
import Button from "../common/Button";
import { FiEye, FiEdit2, FiTrash2 } from "react-icons/fi";

interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    description?: string;
    owner_username?: string;
  };
  onView?: (templateId: string) => void;
  onEdit?: (templateId: string) => void;
  onDelete?: (templateId: string) => void;
  canEdit?: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onView,
  onEdit,
  onDelete,
  canEdit = true,
}) => {
  return (
    <Card hover className="transition-shadow">
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" component="h3" fontWeight={600} gutterBottom>
            {template.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {template.name} {template.description ? `| ${template.description}` : ""}
          </Typography>
          {template.owner_username && (
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              소유자: {template.owner_username}
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
        {onView && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(template.id)}
            sx={{ flex: 1 }}
            startIcon={<FiEye size={16} />}
          >
            보기
          </Button>
        )}
        {onEdit && canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(template.id)}
            sx={{ flex: 1 }}
            startIcon={<FiEdit2 size={16} />}
          >
            수정
          </Button>
        )}
        {onDelete && canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(template.id)}
            sx={{ color: "error.main", minWidth: "auto", px: 1 }}
          >
            <FiTrash2 size={16} />
          </Button>
        )}
      </Box>
    </Card>
  );
};

export default TemplateCard;

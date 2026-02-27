import React from "react";
import Chip from "@mui/material/Chip";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantToColor: Record<BadgeVariant, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
  default: "default",
  success: "success",
  warning: "warning",
  error: "error",
  info: "primary",
};

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  className = "",
}) => {
  const color = variantToColor[variant];
  return (
    <Chip
      label={children}
      color={color}
      size="small"
      className={className}
      sx={{ fontWeight: 500, borderRadius: "9999px" }}
    />
  );
};

export default Badge;

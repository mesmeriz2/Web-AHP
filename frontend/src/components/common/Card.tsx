import React from "react";
import MuiCard from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  variant?: "default" | "elevated" | "outlined" | "subtle";
  hover?: boolean;
}

const paddingMap = {
  sm: 2,
  md: 3,
  lg: 4,
};

const Card: React.FC<CardProps> = ({
  children,
  className = "",
  padding = "md",
  variant = "default",
  hover = false,
}) => {
  const elevation = variant === "elevated" ? 4 : variant === "subtle" ? 0 : 2;
  const isOutlined = variant === "outlined";

  return (
    <MuiCard
      variant={isOutlined ? "outlined" : "elevation"}
      elevation={isOutlined ? 0 : elevation}
      className={className}
      sx={{
        borderRadius: 2,
        ...(hover && {
          cursor: "pointer",
          transition: "box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out",
          "&:hover": {
            boxShadow: 4,
            borderColor: "divider",
          },
        }),
      }}
    >
      <CardContent sx={{ p: paddingMap[padding], "&:last-child": { pb: paddingMap[padding] } }}>
        {children}
      </CardContent>
    </MuiCard>
  );
};

export default Card;

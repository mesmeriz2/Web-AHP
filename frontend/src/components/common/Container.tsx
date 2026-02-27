import React from "react";
import MuiContainer from "@mui/material/Container";

type MaxWidth = "sm" | "md" | "lg" | "xl" | false;

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

const maxWidthMap: Record<string, MaxWidth> = {
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "xl",
  "2xl": "xl",
  full: false,
};

const Container: React.FC<ContainerProps> = ({
  children,
  className = "",
  maxWidth = "xl",
}) => {
  const muiMaxWidth = maxWidthMap[maxWidth] ?? "xl";
  const is2xl = maxWidth === "2xl";
  return (
    <MuiContainer
      maxWidth={is2xl ? false : muiMaxWidth}
      className={className}
      sx={{
        py: { xs: 3, lg: 4 },
        pt: { xs: 5, lg: 4 },
        ...(is2xl && { maxWidth: 1536 }),
      }}
    >
      {children}
    </MuiContainer>
  );
};

export default Container;

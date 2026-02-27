import React from "react";
import MuiAlert from "@mui/material/Alert";

type AlertVariant = "info" | "success" | "warning" | "error";

interface AlertProps {
  children: React.ReactNode;
  variant?: AlertVariant;
  onClose?: () => void;
  className?: string;
}

const Alert: React.FC<AlertProps> = ({
  children,
  variant = "info",
  onClose,
  className = "",
}) => {
  return (
    <MuiAlert
      severity={variant}
      onClose={onClose}
      className={className}
      sx={{ borderRadius: 2 }}
    >
      {children}
    </MuiAlert>
  );
};

export default Alert;

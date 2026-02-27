import React from "react";
import MuiButton from "@mui/material/Button";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const variantToMui: Record<ButtonVariant, { variant: "contained" | "outlined" | "text"; color: "primary" | "secondary" | "error" | "inherit" }> = {
  primary: { variant: "contained", color: "primary" },
  secondary: { variant: "contained", color: "secondary" },
  outline: { variant: "outlined", color: "primary" },
  ghost: { variant: "text", color: "inherit" },
  danger: { variant: "contained", color: "error" },
};

const sizeToMui: Record<ButtonSize, "small" | "medium" | "large"> = {
  sm: "small",
  md: "medium",
  lg: "large",
};

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  className = "",
  disabled,
  ...props
}) => {
  const { variant: muiVariant, color } = variantToMui[variant];
  const muiSize = sizeToMui[size];

  return (
    <MuiButton
      variant={muiVariant}
      color={color}
      size={muiSize}
      className={className}
      disabled={disabled}
      {...props}
    >
      {children}
    </MuiButton>
  );
};

export default Button;

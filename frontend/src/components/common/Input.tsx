import React from "react";
import TextField from "@mui/material/TextField";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  className = "",
  id,
  ...props
}) => {
  return (
    <TextField
      id={id}
      label={label}
      error={Boolean(error)}
      helperText={error}
      fullWidth
      variant="outlined"
      size="small"
      className={className}
      {...(props as React.ComponentProps<typeof TextField>)}
    />
  );
};

export default Input;

import React from "react";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import { SxProps, Theme } from "@mui/material/styles";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  error?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (event: { target: { value: string } }) => void;
  sx?: SxProps<Theme>;
  SelectProps?: Partial<React.ComponentProps<typeof TextField>["SelectProps"]>;
}

const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  className = "",
  id,
  value = "",
  onChange,
  sx,
  SelectProps: selectPropsFromParent,
  ...props
}) => {
  return (
    <TextField
      id={id}
      select
      label={label}
      value={value}
      onChange={(e) => onChange?.({ target: { value: e.target.value } })}
      error={Boolean(error)}
      helperText={error}
      fullWidth
      variant="outlined"
      size="small"
      className={className}
      sx={sx}
      SelectProps={{ native: false, ...selectPropsFromParent }}
      {...(props as Partial<React.ComponentProps<typeof TextField>>)}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
};

export default Select;

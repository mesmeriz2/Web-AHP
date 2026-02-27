import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#0ea5e9",
      dark: "#0369a1",
      light: "#67e8f9",
      contrastText: "#03121f",
    },
    secondary: {
      main: "#d946ef",
      dark: "#a21caf",
      light: "#f0abfc",
      contrastText: "#170312",
    },
    error: {
      main: "#dc2626",
      dark: "#b91c1c",
      light: "#ef4444",
    },
    success: {
      main: "#16a34a",
      dark: "#15803d",
      light: "#059669",
    },
    warning: {
      main: "#d97706",
      dark: "#c2410c",
      light: "#ea580c",
    },
    background: {
      default: "#eef2ff",
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a",
      secondary: "#334155",
      disabled: "#64748b",
    },
  },
  typography: {
    fontFamily: '"Sora", "Noto Sans KR", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    h1: { fontSize: "clamp(2rem, 5vw, 3.75rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.02em" },
    h2: { fontSize: "clamp(1.5rem, 3vw, 2.4rem)", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.015em" },
    h3: { fontSize: "clamp(1.2rem, 2vw, 1.6rem)", fontWeight: 600, lineHeight: 1.2 },
    body1: { fontSize: "1rem", lineHeight: 1.5 },
    body2: { fontSize: "0.875rem", lineHeight: 1.5 },
    button: { fontWeight: 600, textTransform: "none", letterSpacing: "0.01em" },
  },
  shape: {
    borderRadius: 12,
  },
  spacing: 8,
  breakpoints: {
    values: {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#eef2ff",
          color: "#0f172a",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          boxShadow: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          fontSize: "var(--font-size-xs)", // 12px
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: "var(--font-size-xs)", // 12px
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: "var(--font-size-xs)", // 12px - pull-down 메뉴 항목
        },
      },
    },
  },
});

export default theme;

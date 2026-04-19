import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import { FiMenu, FiX, FiHome, FiFolder, FiUser } from "react-icons/fi";

interface HeaderProps {
  showSidebarToggle?: boolean;
  sidebarMobileOpen?: boolean;
  onSidebarToggle?: () => void;
}

const navItems = [
  { path: "/",           label: "홈",    icon: FiHome },
  { path: "/participant",label: "참여자", icon: FiUser },
  { path: "/admin",      label: "관리자", icon: FiFolder },
];

const Header: React.FC<HeaderProps> = ({
  showSidebarToggle = false,
  sidebarMobileOpen = false,
  onSidebarToggle,
}) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const shouldUseSidebarToggle =
    location.pathname !== "/" && showSidebarToggle && Boolean(onSidebarToggle);

  const isActive = (path: string) => location.pathname === path;

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/admin":       return "운영 콘솔";
      case "/participant": return "참여자 게이트";
      default:             return "AHP 의사결정 플랫폼";
    }
  };

  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: "var(--color-header-bg)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--color-header-border)",
        zIndex: (t: { zIndex: { drawer: number } }) => t.zIndex.drawer + 1,
        transition: "background-color 350ms ease, border-color 350ms ease",
        "&::after": {
          content: '""',
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "1px",
          background: "var(--color-header-accent-line)",
          pointerEvents: "none",
        },
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 54, sm: 60 },
          px: { xs: 2, sm: 2, lg: 3 },
          maxWidth: 1536,
          mx: "auto",
          width: "100%",
          gap: 1,
        }}
      >
        {/* Hamburger — mobile only */}
        <Box sx={{ display: { lg: "none" }, mr: 0.5 }}>
          {shouldUseSidebarToggle ? (
            <IconButton
              onClick={onSidebarToggle}
              aria-label="사이드바 메뉴"
              size="medium"
              sx={{ border: "1px solid var(--color-header-border)", color: "var(--color-header-text)" }}
            >
              {sidebarMobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </IconButton>
          ) : (
            <IconButton
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="메뉴"
              size="medium"
              sx={{ border: "1px solid var(--color-header-border)", color: "var(--color-header-text)" }}
            >
              {mobileNavOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </IconButton>
          )}
        </Box>

        {/* Logo */}
        <Box
          component={Link}
          to="/"
          sx={{
            flexGrow: 1,
            textDecoration: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 0.3,
            minWidth: 0,
          }}
        >
          <Box
            component="span"
            sx={{
              fontFamily: "var(--font-family)",
              letterSpacing: "0.18em",
              fontSize: { xs: "0.62rem", sm: "0.68rem" },
              textTransform: "uppercase",
              fontWeight: 700,
              color: "var(--color-primary)",
              opacity: 0.7,
              whiteSpace: "nowrap",
            }}
          >
            AHP PLATFORM
          </Box>
          <Typography
            component="span"
            sx={{
              fontSize: { xs: "0.92rem", sm: "1rem" },
              lineHeight: 1.15,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "var(--color-header-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              transition: "color 350ms ease",
            }}
          >
            {getPageTitle()}
          </Typography>
        </Box>

        {/* Desktop nav */}
        <Box sx={{ display: { xs: "none", lg: "flex" }, alignItems: "center", gap: 0.5 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Button
                key={item.path}
                component={Link}
                to={item.path}
                size="small"
                startIcon={<Icon size={14} aria-hidden />}
                sx={{
                  minWidth: 80,
                  px: 1.5,
                  py: 0.7,
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: active ? "var(--color-primary)" : "var(--color-header-border)",
                  bgcolor: active ? "var(--color-primary-pale)" : "transparent",
                  color: active ? "var(--color-primary)" : "var(--color-header-text-muted)",
                  fontWeight: active ? 700 : 500,
                  fontSize: "0.8rem",
                  fontFamily: "var(--font-family)",
                  transition: "all 200ms ease",
                  "&:hover": {
                    borderColor: "var(--color-primary)",
                    bgcolor: "var(--color-primary-pale)",
                    color: "var(--color-primary)",
                  },
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Box>

      </Toolbar>

      {/* Mobile nav */}
      <Collapse in={mobileNavOpen}>
        <Box
          sx={{
            pb: 1.5,
            px: 2,
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
            bgcolor: "var(--color-header-bg)",
            borderTop: "1px solid var(--color-header-border)",
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Button
                key={item.path}
                component={Link}
                to={item.path}
                fullWidth
                startIcon={<Icon size={15} />}
                onClick={() => setMobileNavOpen(false)}
                sx={{
                  justifyContent: "flex-start",
                  border: "1px solid",
                  borderColor: active ? "var(--color-primary)" : "var(--color-header-border)",
                  bgcolor: active ? "var(--color-primary-pale)" : "transparent",
                  color: active ? "var(--color-primary)" : "var(--color-header-text-muted)",
                  fontWeight: active ? 700 : 500,
                  fontFamily: "var(--font-family)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Box>
      </Collapse>
    </AppBar>
  );
};

export default Header;

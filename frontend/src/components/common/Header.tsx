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
  { path: "/", label: "홈", icon: FiHome },
  { path: "/participant", label: "참여자", icon: FiUser },
  { path: "/admin", label: "관리자", icon: FiFolder },
];

const Header: React.FC<HeaderProps> = ({
  showSidebarToggle = false,
  sidebarMobileOpen = false,
  onSidebarToggle,
}) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const shouldUseSidebarToggle = location.pathname !== "/" && showSidebarToggle && Boolean(onSidebarToggle);

  const isActive = (path: string) => location.pathname === path;

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/admin":
        return "운영 콘솔";
      case "/participant":
        return "참여자 게이트";
      default:
        return "AHP Decision Platform";
    }
  };

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <AppBar
      position="sticky"
      sx={{
        bgcolor: "rgba(7, 11, 24, 0.86)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(103, 232, 249, 0.22)",
        boxShadow: "0 16px 38px rgba(7, 11, 24, 0.45)",
        zIndex: (theme: { zIndex: { drawer: number } }) => theme.zIndex.drawer + 1,
        "&::after": {
          content: '""',
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 1,
          background: "linear-gradient(90deg, rgba(103,232,249,0.3), rgba(255,79,216,0.38), rgba(103,232,249,0.3))",
          pointerEvents: "none",
        },
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 56, sm: 64 },
          px: { xs: 2, sm: 2, lg: 3 },
          maxWidth: 1536,
          mx: "auto",
          width: "100%",
        }}
      >
        {/* 햄버거 — 모바일(lg 미만)에서만 표시, 가장 왼쪽 */}
        <Box sx={{ display: { lg: "none" }, mr: 1 }}>
          {shouldUseSidebarToggle ? (
            <IconButton
              color="inherit"
              onClick={onSidebarToggle}
              aria-label="사이드바 메뉴"
              size="large"
              sx={{
                border: "1px solid rgba(148,163,184,0.34)",
                color: "rgba(232,240,255,0.9)",
              }}
            >
              {sidebarMobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </IconButton>
          ) : (
            <IconButton
              color="inherit"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="메뉴"
              size="large"
              sx={{
                border: "1px solid rgba(148,163,184,0.34)",
                color: "rgba(232,240,255,0.9)",
              }}
            >
              {mobileNavOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </IconButton>
          )}
        </Box>

        {/* 로고 — 남은 공간 차지 */}
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
            gap: 0.35,
            minWidth: 0,
          }}
        >
          <Box
            component="span"
            sx={{
              fontFamily: "var(--font-family-display)",
              letterSpacing: "0.14em",
              fontSize: { xs: "0.68rem", sm: "0.76rem" },
              textTransform: "uppercase",
              color: "rgba(103, 232, 249, 0.92)",
              textShadow: "0 0 14px rgba(103,232,249,0.35)",
              whiteSpace: "nowrap",
            }}
          >
            AHP SURVEY SYSTEM
          </Box>
          <Typography
            component="span"
            sx={{
              fontSize: { xs: "0.98rem", sm: "1.08rem" },
              lineHeight: 1.1,
              fontWeight: 700,
              color: "#f8fbff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {getPageTitle()}
          </Typography>
        </Box>

        {/* 데스크탑 nav + 로그아웃 — lg 이상만 */}
        <Box sx={{ display: { xs: "none", lg: "flex" }, alignItems: "center", gap: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Button
                key={item.path}
                component={Link}
                to={item.path}
                variant={active ? "contained" : "text"}
                size="medium"
                startIcon={<Icon size={16} aria-hidden />}
                sx={{
                  minWidth: 90,
                  px: 1.8,
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: active ? "rgba(103,232,249,0.65)" : "rgba(148,163,184,0.28)",
                  bgcolor: active ? "rgba(103,232,249,0.2)" : "rgba(7,11,24,0.25)",
                  color: active ? "#e2f9ff" : "rgba(232,240,255,0.88)",
                  "&:hover": {
                    borderColor: "rgba(103,232,249,0.85)",
                    bgcolor: active ? "rgba(103,232,249,0.26)" : "rgba(103,232,249,0.08)",
                  },
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Box>
      </Toolbar>

      <Collapse in={mobileNavOpen}>
        <Box
          sx={{
            pb: 2,
            px: 2,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            bgcolor: "rgba(7, 11, 24, 0.96)",
            borderTop: "1px solid rgba(103,232,249,0.2)",
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
                variant={active ? "contained" : "text"}
                fullWidth
                startIcon={<Icon size={16} />}
                onClick={() => setMobileNavOpen(false)}
                sx={{
                  border: "1px solid",
                  borderColor: active ? "rgba(103,232,249,0.65)" : "rgba(148,163,184,0.28)",
                  bgcolor: active ? "rgba(103,232,249,0.2)" : "rgba(7,11,24,0.25)",
                  color: active ? "#e2f9ff" : "rgba(232,240,255,0.88)",
                  justifyContent: "flex-start",
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

import React, { useState } from "react";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { FiFolder, FiFileText, FiUsers, FiUser, FiLogOut } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export type AdminSectionId = "projects" | "templates" | "users" | "profile";

interface SidebarItem {
  id: AdminSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

interface SidebarProps {
  activeSection: AdminSectionId;
  onSectionChange: (section: AdminSectionId) => void;
  mobileOpen?: boolean;
  onClose?: () => void;
}

const allSidebarItems: SidebarItem[] = [
  { id: "projects", label: "프로젝트 관리", icon: FiFolder },
  { id: "templates", label: "템플릿 관리", icon: FiFileText },
  { id: "users", label: "사용자 관리", icon: FiUsers },
  { id: "profile", label: "내 정보", icon: FiUser },
];

const APP_VERSION = "1.0.0";
const drawerWidth = 220;

const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
  mobileOpen: mobileOpenProp,
  onClose,
}) => {
  const [mobileOpenInternal, setMobileOpenInternal] = useState(false);
  const mobileOpen = mobileOpenProp ?? mobileOpenInternal;
  const { logout } = useAuth();
  const navigate = useNavigate();

  const closeMobile = () => {
    onClose?.();
    setMobileOpenInternal(false);
  };

  const handleSectionChange = (section: AdminSectionId) => {
    onSectionChange(section);
    closeMobile();
  };

  const listContent = (
    <Box sx={{ py: 1.5, px: 1.5, overflow: "auto", height: "100%", display: "flex", flexDirection: "column" }}>
      <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
        {allSidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <ListItemButton
              key={item.id}
              selected={isActive}
              onClick={() => handleSectionChange(item.id)}
              sx={{
                flexGrow: 0,
                borderRadius: 1.5,
                py: 0.75,
                px: 1.5,
                borderLeft: "3px solid",
                borderColor: isActive ? "primary.light" : "transparent",
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": { bgcolor: "primary.dark" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 34, color: "inherit" }}>
                <Icon size={18} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: 500, fontSize: "0.875rem" }}
              />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ flex: 1 }} />
      <Box sx={{ pb: 1 }}>
        <ListItemButton
          onClick={() => { logout(); navigate("/login"); }}
          sx={{
            borderRadius: 1.5,
            py: 0.75,
            px: 1.5,
            color: "error.main",
            "&:hover": { bgcolor: "rgba(220,38,38,0.08)" },
          }}
        >
          <ListItemIcon sx={{ minWidth: 34, color: "inherit" }}>
            <FiLogOut size={18} />
          </ListItemIcon>
          <ListItemText
            primary="로그아웃"
            primaryTypographyProps={{ fontWeight: 500, fontSize: "0.875rem" }}
          />
        </ListItemButton>
      </Box>
      <Box sx={{ pt: 0, pb: 1, textAlign: "center" }}>
        <Typography
          variant="caption"
          sx={{ color: "text.disabled", opacity: 0.5, fontSize: "0.7rem" }}
        >
          v{APP_VERSION}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={closeMobile}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", lg: "none" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            top: { xs: 56, sm: 64 },
            height: { xs: "calc(100vh - 56px)", sm: "calc(100vh - 64px)" },
            borderRight: 1,
            borderColor: "divider",
          },
        }}
      >
        {listContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", lg: "block" },
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            top: { xs: 56, sm: 64 },
            height: { xs: "calc(100vh - 56px)", sm: "calc(100vh - 64px)" },
            borderRight: 1,
            borderColor: "divider",
          },
        }}
      >
        {listContent}
      </Drawer>
    </>
  );
};

export default Sidebar;

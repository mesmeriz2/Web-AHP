import React, { useState } from "react";
import Box from "@mui/material/Box";

import Header from "./Header";
import Container from "./Container";

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  sidebar?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  showSidebar = false,
  sidebar,
}) => {
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header
        showSidebarToggle={showSidebar}
        sidebarMobileOpen={sidebarMobileOpen}
        onSidebarToggle={() => setSidebarMobileOpen((v) => !v)}
      />
      <Box sx={{ display: "flex", position: "relative" }}>
        {showSidebar && sidebar && (
          <>
            <Box sx={{ display: { xs: "none", lg: "block" }, flexShrink: 0, width: 220 }}>
              {sidebar}
            </Box>
            <Box sx={{ display: { lg: "none" } }}>
              {React.isValidElement(sidebar)
                ? React.cloneElement(sidebar as React.ReactElement<{ mobileOpen?: boolean; onClose?: () => void }>, {
                    mobileOpen: sidebarMobileOpen,
                    onClose: () => setSidebarMobileOpen(false),
                  })
                : sidebar}
            </Box>
          </>
        )}
        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <Container>{children}</Container>
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;

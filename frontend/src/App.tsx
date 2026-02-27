import { Route, Routes, Link } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { FiArrowRight } from "react-icons/fi";

import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/common/Layout";
import ProtectedRoute from "./components/common/ProtectedRoute";
import AdminPage from "./pages/AdminPage";
import ParticipantPage from "./pages/ParticipantPage";
import LoginPage from "./pages/LoginPage";

const HomeContent = () => (
  <Box className="landing-shell">
    <Box className="landing-bg" aria-hidden>
      <Box className="landing-grid" />
      <Box className="landing-orb landing-orb--cyan" />
      <Box className="landing-orb landing-orb--magenta" />
      <Box className="landing-orb landing-orb--indigo" />
    </Box>

    <Box className="landing-content">
      <Box className="landing-eyebrow">AHP 의사결정 설문 플랫폼</Box>
      <Typography component="h1" className="landing-title">
        기준 설계부터{" "}
        <span className="landing-highlight">우선순위 도출</span>
        까지
      </Typography>
      <Typography component="p" className="landing-subtitle">
        쌍대비교 설문을 통해 팀의 의사결정을 체계적으로 정렬합니다.
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} className="landing-cta-row">
        <Button
          component={Link}
          to="/admin"
          variant="contained"
          size="large"
          endIcon={<FiArrowRight size={16} />}
          sx={{
            bgcolor: "primary.light",
            color: "#03121f",
            fontWeight: 700,
            px: 3,
            "&:hover": { bgcolor: "primary.main" },
          }}
        >
          관리자 콘솔 시작
        </Button>
        <Button
          component={Link}
          to="/participant"
          variant="outlined"
          size="large"
          sx={{
            color: "rgba(232,240,255,0.95)",
            borderColor: "rgba(103,232,249,0.58)",
            px: 3,
            "&:hover": {
              borderColor: "rgba(103,232,249,0.9)",
              bgcolor: "rgba(103,232,249,0.08)",
            },
          }}
        >
          참여자 설문 입장
        </Button>
      </Stack>
    </Box>
  </Box>
);

const App = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Layout><HomeContent /></Layout>} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="/participant" element={<ParticipantPage />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;

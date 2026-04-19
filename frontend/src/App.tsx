import { Route, Routes } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import AdminPage from "./pages/AdminPage";
import ParticipantPage from "./pages/ParticipantPage";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
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
  </ThemeProvider>
);

export default App;

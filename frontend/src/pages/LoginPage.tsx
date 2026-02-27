import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { useAuth } from "../contexts/AuthContext";
import Layout from "../components/common/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Alert from "../components/common/Alert";

const APP_VERSION = "1.0.0";

const LoginPage = () => {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!loginId.trim() || !password.trim()) {
      setMessage("아이디와 비밀번호를 입력하세요.");
      return;
    }
    try {
      setMessage(null);
      setLoading(true);
      await login(loginId, password);
      navigate("/admin", { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인 오류");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-12">
        <Card>
          <h2 className="text-2xl font-bold mb-6">관리자 로그인</h2>
          <div className="form-stack-lg">
            <Input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="아이디 또는 이메일"
              label="아이디 또는 이메일"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="비밀번호"
              label="비밀번호"
            />
            <Button variant="primary" onClick={handleLogin} className="w-full" disabled={loading}>
              {loading ? "로그인 중..." : "로그인"}
            </Button>
            {message && (
              <Alert variant="error" onClose={() => setMessage(null)}>
                {message}
              </Alert>
            )}
          </div>
          <Box sx={{ mt: 3, textAlign: "center" }}>
            <Typography variant="caption" sx={{ color: "text.disabled", opacity: 0.6 }}>
              v{APP_VERSION}
            </Typography>
          </Box>
        </Card>
      </div>
    </Layout>
  );
};

export default LoginPage;

import { useState } from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";

import { useAuth } from "../../contexts/AuthContext";
import { apiPatch } from "../../api/client";
import { Endpoints } from "../../api/endpoints";
import Card from "../common/Card";
import Button from "../common/Button";
import Input from "../common/Input";
import Alert from "../common/Alert";

const ProfileSection = () => {
  const { token, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageVariant, setMessageVariant] = useState<"error" | "success">("error");

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      setMessage("현재 비밀번호와 새 비밀번호를 입력하세요.");
      setMessageVariant("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("새 비밀번호가 일치하지 않습니다.");
      setMessageVariant("error");
      return;
    }
    if (newPassword.length < 4) {
      setMessage("비밀번호는 4자 이상이어야 합니다.");
      setMessageVariant("error");
      return;
    }
    try {
      await apiPatch(Endpoints.users.changePassword, {
        current_password: currentPassword,
        new_password: newPassword,
      }, { token });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("비밀번호가 변경되었습니다.");
      setMessageVariant("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "비밀번호 변경 오류");
      setMessageVariant("error");
    }
  };

  if (!user) {
    return null;
  }

  const roleLabel = user.role === "super_admin" ? "Super Admin" : "Admin";

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-6">내 정보</h2>

      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ width: 80 }}>사용자명</Typography>
            <Typography variant="body1" fontWeight={500}>{user.username}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ width: 80 }}>이메일</Typography>
            <Typography variant="body1">{user.email}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ width: 80 }}>역할</Typography>
            <Chip label={roleLabel} size="small" color={user.role === "super_admin" ? "primary" : "default"} variant="outlined" />
          </Box>
        </Box>
      </Box>

      <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>비밀번호 변경</Typography>

        {message && (
          <Box sx={{ mb: 2 }}>
            <Alert variant={messageVariant} onClose={() => setMessage(null)}>
              {message}
            </Alert>
          </Box>
        )}

        <div className="form-stack" style={{ maxWidth: 400 }}>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="현재 비밀번호"
            label="현재 비밀번호"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호"
            label="새 비밀번호"
          />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="새 비밀번호 확인"
            label="새 비밀번호 확인"
          />
          <Button variant="primary" onClick={handleChangePassword}>
            비밀번호 변경
          </Button>
        </div>
      </Box>
    </Card>
  );
};

export default ProfileSection;

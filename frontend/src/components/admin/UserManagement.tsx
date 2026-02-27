import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { FiPlus, FiRefreshCw } from "react-icons/fi";

import { useAuth } from "../../contexts/AuthContext";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../api/client";
import { Endpoints } from "../../api/endpoints";
import type { UserListItem } from "../../types/api";
import Card from "../common/Card";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";
import Alert from "../common/Alert";

const UserManagement = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [messageVariant, setMessageVariant] = useState<"error" | "success">("error");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("admin");

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState("");

  const loadUsers = async () => {
    try {
      const data = await apiGet<UserListItem[]>(Endpoints.users.list, { token });
      setUsers(data);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "사용자 목록 조회 오류", "error");
    }
  };

  useEffect(() => {
    loadUsers();
  }, [token]);

  const showMessage = (msg: string, variant: "error" | "success" = "error") => {
    setMessage(msg);
    setMessageVariant(variant);
  };

  const handleCreate = async () => {
    if (!newEmail || !newUsername || !newPassword) {
      showMessage("모든 필드를 입력하세요.");
      return;
    }
    try {
      await apiPost(Endpoints.users.create, {
        email: newEmail,
        username: newUsername,
        password: newPassword,
        role: newRole,
      }, { token });
      setNewEmail("");
      setNewUsername("");
      setNewPassword("");
      setNewRole("admin");
      setShowCreateForm(false);
      showMessage("사용자가 생성되었습니다.", "success");
      await loadUsers();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "사용자 생성 오류");
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      if (isActive) {
        await apiDelete(Endpoints.users.user(userId), { token });
      } else {
        await apiPatch(Endpoints.users.user(userId), { is_active: true }, { token });
      }
      showMessage(isActive ? "계정이 비활성화되었습니다." : "계정이 활성화되었습니다.", "success");
      await loadUsers();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "상태 변경 오류");
    }
  };

  const handleRoleChange = async (userId: string, newRoleValue: string) => {
    try {
      await apiPatch(Endpoints.users.user(userId), { role: newRoleValue }, { token });
      showMessage("역할이 변경되었습니다.", "success");
      await loadUsers();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "역할 변경 오류");
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!editPassword || editPassword.length < 4) {
      showMessage("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    try {
      await apiPatch(Endpoints.users.user(userId), { password: editPassword }, { token });
      setEditingUserId(null);
      setEditPassword("");
      showMessage("비밀번호가 초기화되었습니다.", "success");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "비밀번호 초기화 오류");
    }
  };

  return (
    <Card>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">사용자 관리</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadUsers}>
            <FiRefreshCw className="w-4 h-4 mr-1" />
            새로고침
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
            <FiPlus className="w-4 h-4 mr-1" />
            사용자 추가
          </Button>
        </div>
      </div>

      {message && (
        <Alert variant={messageVariant} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      {showCreateForm && (
        <Box sx={{ mb: 3, p: 2, borderRadius: 1, border: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>새 사용자 생성</Typography>
          <div className="form-stack" style={{ maxWidth: 480 }}>
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="이메일"
              label="이메일"
            />
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="사용자명"
              label="사용자명"
            />
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="비밀번호"
              label="비밀번호"
            />
            <Select
              options={[
                { value: "admin", label: "Admin" },
                { value: "super_admin", label: "Super Admin" },
              ]}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              label="역할"
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={handleCreate}>생성</Button>
              <Button variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>취소</Button>
            </div>
          </div>
        </Box>
      )}

      <Box sx={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.85rem", fontWeight: 600 }}>사용자명</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.85rem", fontWeight: 600 }}>이메일</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.85rem", fontWeight: 600 }}>역할</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.85rem", fontWeight: 600 }}>상태</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.85rem", fontWeight: 600 }}>가입일</th>
              <th style={{ textAlign: "right", padding: "8px 12px", fontSize: "0.85rem", fontWeight: 600 }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>{u.username}</td>
                <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>{u.email}</td>
                <td style={{ padding: "8px 12px" }}>
                  <Select
                    options={[
                      { value: "admin", label: "Admin" },
                      { value: "super_admin", label: "Super Admin" },
                    ]}
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  />
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <Chip
                    label={u.is_active ? "활성" : "비활성"}
                    color={u.is_active ? "success" : "default"}
                    size="small"
                    variant="outlined"
                  />
                </td>
                <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right" }}>
                  <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(u.id, u.is_active)}
                    >
                      {u.is_active ? "비활성화" : "활성화"}
                    </Button>
                    {editingUserId === u.id ? (
                      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                        <Input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="새 비밀번호"
                          style={{ width: 140, fontSize: "0.8rem" }}
                        />
                        <Button variant="primary" size="sm" onClick={() => handleResetPassword(u.id)}>
                          저장
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setEditingUserId(null); setEditPassword(""); }}>
                          취소
                        </Button>
                      </Box>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingUserId(u.id); setEditPassword(""); }}
                      >
                        비밀번호 초기화
                      </Button>
                    )}
                  </Box>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      {users.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          등록된 사용자가 없습니다.
        </Typography>
      )}
    </Card>
  );
};

export default UserManagement;

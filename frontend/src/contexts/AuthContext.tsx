import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiPost } from "../api/client";
import { Endpoints } from "../api/endpoints";

export type UserRole = "super_admin" | "admin";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
};

type UserLoginResponse = {
  token: string;
  expires_at: string;
  user: AuthUser;
};

type AuthContextType = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY_TOKEN = "auth_token";
const STORAGE_KEY_EXPIRES = "auth_expires_at";
const STORAGE_KEY_USER = "auth_user";

const isExpired = (expiresAt: string) => new Date(expiresAt) <= new Date();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const savedExpires = localStorage.getItem(STORAGE_KEY_EXPIRES);
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedToken && savedExpires && !isExpired(savedExpires)) {
      setToken(savedToken);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          // invalid stored user
        }
      }
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_EXPIRES);
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, []);

  const login = useCallback(async (loginId: string, password: string) => {
    const data = await apiPost<UserLoginResponse, { login_id: string; password: string }>(
      Endpoints.users.login,
      { login_id: loginId, password },
    );
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
    localStorage.setItem(STORAGE_KEY_EXPIRES, data.expires_at);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_EXPIRES);
    localStorage.removeItem(STORAGE_KEY_USER);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isSuperAdmin: user?.role === "super_admin",
      login,
      logout,
    }),
    [token, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

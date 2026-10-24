import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("omni_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("omni_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("omni_token");
      if (storedToken) {
        try {
          const res = await api.getMe();
          if (res.data) {
            setUser(res.data);
            localStorage.setItem("omni_user", JSON.stringify(res.data));
          }
        } catch (err) {
          console.error("Token verification failed:", err);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();

    const handleUnauthorized = () => logout();
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const login = async (credentials) => {
    const res = await api.login(credentials);
    const { token: newToken, user: newUser } = res.data;
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("omni_token", newToken);
    localStorage.setItem("omni_user", JSON.stringify(newUser));
    return newUser;
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    const { token: newToken, user: newUser } = res.data;
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("omni_token", newToken);
    localStorage.setItem("omni_user", JSON.stringify(newUser));
    return newUser;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("omni_token");
    localStorage.removeItem("omni_user");
  };

  const isAdmin = user?.role_name?.toLowerCase() === "admin";
  const isFinance = user?.role_name?.toLowerCase() === "finance" || isAdmin;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAdmin, isFinance }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-on-surface">
        <div className="w-12 h-12 rounded-full border-4 border-surface-container-high border-t-primary animate-spin mb-4"></div>
        <p className="text-xs font-semibold text-outline animate-pulse">Memuat OmniLife Nexus Engine...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user.role_name?.toLowerCase();
    const hasRole = allowedRoles.some((r) => r.toLowerCase() === userRole);
    if (!hasRole) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <span className="material-symbols-outlined text-error text-[48px] mb-2">lock</span>
          <h2 className="text-xl font-bold text-on-surface">Akses Ditolak (403 Forbidden)</h2>
          <p className="text-xs text-on-surface-variant max-w-md mt-1">
            Akun Anda ({user.username} - Role: <span className="text-primary font-bold">{user.role_name}</span>) tidak memiliki izin untuk mengakses modul ini.
          </p>
        </div>
      );
    }
  }

  return children;
}

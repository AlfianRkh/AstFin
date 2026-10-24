import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export function Sidebar({ isOpen = false, onClose = () => {} }) {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, logout, isAdmin } = useAuth();
  const [netLiquidity, setNetLiquidity] = useState(0);

  useEffect(() => {
    const fetchLiquidity = async () => {
      try {
        const res = await api.getWallets();
        if (res.data) {
          setNetLiquidity(res.data.total_liquidity || 0);
        }
      } catch (err) {
        // Silently handle if not yet ready
      }
    };
    fetchLiquidity();

    const interval = setInterval(fetchLiquidity, 15000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { path: "/", label: "Dashboard", icon: "grid_view" },
    { path: "/finansial-kas", label: "Finansial & Kas", icon: "account_balance_wallet" },
    { path: "/pengadaan-radar", label: "Pengadaan & Radar", icon: "radar" },
    { path: "/dapur-inventaris", label: "Dapur & Inventaris", icon: "kitchen" },
  ];

  const intelItems = [
    { path: "/ai-insights", label: "Cross-Module AI Insights", icon: "psychology" },
    { path: "/pengaturan-kalibrasi", label: "Pengaturan & Kalibrasi", icon: "tune" },
    ...(isAdmin ? [{ path: "/admin/users", label: "Kelola Role & Pengguna", icon: "admin_panel_settings" }] : []),
  ];

  const formatRupiah = (val) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Sidebar Drawer */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-surface-container-lowest z-50 flex flex-col justify-between shadow-2xl lg:shadow-[0_1px_8px_rgba(0,0,0,0.4)] border-r border-outline-variant/10 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col">
          <div className="h-16 px-space-md flex items-center justify-between bg-surface-container-low/60 border-b border-outline-variant/10">
            <div className="flex items-center gap-space-sm min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-extrabold text-lg shadow-sm shrink-0">
                <span className="material-symbols-outlined text-[24px]">all_inclusive</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-on-surface tracking-tight leading-none truncate">OmniLife Nexus</span>
                <span className="text-[10px] text-primary uppercase tracking-widest mt-1 font-bold">Unified Life OS v2.4</span>
              </div>
            </div>

            {/* Close Button on Mobile Drawer */}
            <button
              onClick={onClose}
              className="lg:hidden w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center transition-colors ml-2"
              aria-label="Tutup menu"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

        <div className="px-space-md pt-space-lg">
          <span className="text-[10px] font-bold text-outline uppercase tracking-wider px-space-sm">Core Operations</span>
          <nav className="mt-space-xs flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = currentPath === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-space-sm px-space-sm py-2.5 rounded-lg transition-colors text-sm font-semibold ${
                    isActive
                      ? "bg-primary-container text-on-primary-container shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="px-space-md pt-space-lg">
          <span className="text-[10px] font-bold text-outline uppercase tracking-wider px-space-sm">Intelligence & System</span>
          <nav className="mt-space-xs flex flex-col gap-1">
            {intelItems.map((item) => {
              const isActive = currentPath === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-space-sm px-space-sm py-2.5 rounded-lg transition-colors text-sm font-semibold ${
                    isActive
                      ? "bg-primary-container text-on-primary-container shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="p-space-md bg-surface-container-lowest flex flex-col gap-space-sm border-t border-outline-variant/10">
        <div className="bg-surface-container-low px-space-sm py-2 rounded-xl flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.15)]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="text-[10px] text-on-surface-variant uppercase font-bold">Net Liquidity</span>
          </div>
          <span className="text-xs text-primary font-bold">{formatRupiah(netLiquidity)}</span>
        </div>

        <div className="flex items-center justify-between p-space-xs rounded-xl bg-surface-container-low/50">
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="w-8 h-8 rounded-full bg-surface-container-high text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
              {user?.username ? user.username.slice(0, 2) : "UN"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-on-surface font-semibold truncate leading-tight">{user?.full_name || user?.username || "Pengguna"}</span>
              <span className="text-[10px] text-secondary truncate uppercase font-bold tracking-wider">{user?.role_name || "User"}</span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Keluar / Logout"
            className="w-7 h-7 rounded-lg text-outline hover:text-error hover:bg-surface-container transition-colors flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  </>
  );
}

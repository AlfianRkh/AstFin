import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Header({ onToggleSidebar, onScanClick, alertCount = 0 }) {
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.2)] z-30 flex items-center justify-between px-3 sm:px-space-md lg:px-space-lg gap-2 sm:gap-space-md border-b border-outline-variant/10">
      {/* Left Section: Mobile Hamburger + Brand / Search */}
      <div className="flex items-center gap-2 sm:gap-space-md flex-1 max-w-xl min-w-0">
        {/* Mobile Hamburger Button */}
        <button
          onClick={onToggleSidebar}
          type="button"
          aria-label="Buka navigasi menu"
          className="lg:hidden w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center shrink-0 transition-colors border border-outline-variant/15 active:scale-95"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>

        {/* Mobile Brand Pill */}
        <div className="flex items-center gap-1.5 lg:hidden shrink-0">
          <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-extrabold text-sm shadow-sm">
            <span className="material-symbols-outlined text-[20px]">all_inclusive</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full min-w-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input
            className="w-full bg-surface-container-low text-xs text-on-surface placeholder:text-outline rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:bg-surface-container transition-all border border-transparent focus:border-outline-variant/30"
            placeholder="Cari transaksi, pantry, radar... (⌘K)"
            type="text"
          />
        </div>

        {/* Desktop Engine Status */}
        <div className="hidden xl:flex items-center gap-2 shrink-0 bg-surface-container-high/60 px-space-sm py-1.5 rounded-full border border-outline-variant/10">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
          <span className="text-[11px] text-on-surface-variant font-medium">Nexus Engine Active · All 5 Modules Synced</span>
        </div>
      </div>

      {/* Right Section: Actions & User Avatar */}
      <div className="flex items-center gap-1.5 sm:gap-space-sm shrink-0">
        <button
          onClick={onScanClick}
          className="bg-primary-container text-on-primary-container text-xs font-semibold px-2.5 sm:px-space-md py-2 rounded-xl flex items-center gap-1.5 hover:bg-primary transition-colors shadow-[0_0_16px_rgba(16,185,129,0.3)] active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">document_scanner</span>
          <span className="hidden sm:inline">+ Pindai Struk AI</span>
          <span className="sm:hidden text-[11px] font-bold">Pindai</span>
        </button>

        <Link
          to="/pengadaan-radar"
          className="hidden md:flex bg-surface-container-high text-on-surface text-xs font-semibold px-space-md py-2 rounded-xl items-center gap-1.5 hover:bg-surface-bright transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>+ Log Radar</span>
        </Link>

        {/* Notification Bell */}
        <div className="relative">
          <button
            aria-label="Notifikasi"
            className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-error-container text-on-error-container text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {alertCount}
            </span>
          )}
        </div>

        {/* User Avatar */}
        <div
          title={user?.full_name || user?.username || "Pengguna"}
          className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs uppercase ml-0.5 shrink-0"
        >
          {user?.username ? user.username.slice(0, 2) : "U"}
        </div>
      </div>
    </header>
  );
}

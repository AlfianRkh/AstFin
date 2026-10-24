import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Header({ onScanClick, alertCount = 0 }) {
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.2)] z-40 flex items-center justify-between px-space-lg gap-space-md border-b border-outline-variant/10">
      <div className="flex items-center gap-space-md flex-1 max-w-xl">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
          <input
            className="w-full bg-surface-container-low text-xs text-on-surface placeholder:text-outline rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:bg-surface-container transition-all border border-transparent focus:border-outline-variant/30"
            placeholder="Cari transaksi, struk kasir, stok pantry, produk radar, atau kontak hutang... (⌘K)"
            type="text"
          />
        </div>
        <div className="hidden xl:flex items-center gap-2 shrink-0 bg-surface-container-high/60 px-space-sm py-1.5 rounded-full border border-outline-variant/10">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
          <span className="text-[11px] text-on-surface-variant font-medium">Nexus Engine Active · All 5 Modules Synced</span>
        </div>
      </div>
      <div className="flex items-center gap-space-sm shrink-0">
        <button
          onClick={onScanClick}
          className="bg-primary-container text-on-primary-container text-xs font-semibold px-space-md py-2 rounded-lg flex items-center gap-1.5 hover:bg-primary transition-colors shadow-[0_0_16px_rgba(16,185,129,0.3)] active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">document_scanner</span>
          <span>+ Pindai Struk AI</span>
        </button>
        <Link
          to="/pengadaan-radar"
          className="bg-surface-container-high text-on-surface text-xs font-semibold px-space-md py-2 rounded-lg flex items-center gap-1.5 hover:bg-surface-bright transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>+ Log Harga / Wishlist</span>
        </Link>
        <div className="relative ml-2">
          <button className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-error-container text-on-error-container text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {alertCount}
            </span>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs uppercase ml-1">
          {user?.username ? user.username.slice(0, 2) : "U"}
        </div>
      </div>
    </header>
  );
}

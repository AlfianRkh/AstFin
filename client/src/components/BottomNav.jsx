import React from "react";
import { Link, useLocation } from "react-router-dom";

export function BottomNav({ onScanClick }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { path: "/", label: "Dashboard", icon: "grid_view" },
    { path: "/finansial-kas", label: "Finansial", icon: "account_balance_wallet" },
    { path: "/dapur-inventaris", label: "Dapur", icon: "kitchen" },
    { path: "/compare-harga", label: "Compare", icon: "price_change" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/15 px-2 py-1 flex items-center justify-around shadow-[0_-2px_12px_rgba(0,0,0,0.4)]">
      {/* 2 Tab Pertama */}
      {navItems.slice(0, 2).map((item) => {
        const isActive = currentPath === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-w-[56px] ${
              isActive
                ? "text-primary font-bold scale-105"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[22px] transition-transform ${
                isActive ? "scale-110" : ""
              }`}
            >
              {item.icon}
            </span>
            <span className="text-[10px] tracking-tight mt-0.5 leading-none">
              {item.label}
            </span>
            {isActive && (
              <span className="w-1 h-1 rounded-full bg-primary mt-1"></span>
            )}
          </Link>
        );
      })}

      {/* Floating Center Scan Button */}
      <button
        onClick={onScanClick}
        type="button"
        aria-label="Pindai Struk AI"
        className="flex flex-col items-center justify-center -mt-5 group"
      >
        <div className="w-12 h-12 rounded-full bg-primary text-on-primary shadow-[0_4px_16px_rgba(16,185,129,0.5)] flex items-center justify-center border-2 border-surface group-active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-[24px]">
            document_scanner
          </span>
        </div>
        <span className="text-[9px] font-bold text-primary mt-1 tracking-tight">
          Scan AI
        </span>
      </button>

      {/* 2 Tab Terakhir */}
      {navItems.slice(2, 4).map((item) => {
        const isActive = currentPath === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-w-[56px] ${
              isActive
                ? "text-primary font-bold scale-105"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[22px] transition-transform ${
                isActive ? "scale-110" : ""
              }`}
            >
              {item.icon}
            </span>
            <span className="text-[10px] tracking-tight mt-0.5 leading-none">
              {item.label}
            </span>
            {isActive && (
              <span className="w-1 h-1 rounded-full bg-primary mt-1"></span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

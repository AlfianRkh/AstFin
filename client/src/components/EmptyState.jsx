import React from "react";

export function EmptyState({ icon, title, description, actionText, onAction, secondaryActionText, onSecondaryAction }) {
  return (
    <div className="rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-low/60 p-8 flex flex-col items-center justify-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-outline mb-3 shadow-inner">
        <span className="material-symbols-outlined text-[32px] text-primary/70">{icon}</span>
      </div>
      <h3 className="text-sm font-bold text-on-surface">{title}</h3>
      <p className="text-xs text-on-surface-variant max-w-sm mt-1 leading-relaxed">{description}</p>
      
      <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="bg-primary-container hover:bg-primary text-on-primary-container text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)] active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>{actionText}</span>
          </button>
        )}
        {secondaryActionText && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <span>{secondaryActionText}</span>
          </button>
        )}
      </div>
    </div>
  );
}

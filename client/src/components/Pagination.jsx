import React from "react";

const LIMIT_OPTIONS = [10, 25, 50, 100];

/**
 * Pagination sederhana: pilih jumlah per halaman (default 10, maks 100)
 * dan navigasi halaman sebelumnya / berikutnya.
 */
export function Pagination({ page, limit, total, onPageChange, onLimitChange }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  const btn =
    "px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-surface-container-high text-on-surface hover:bg-surface-bright";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-space-md mt-1 border-t border-outline-variant/10 text-xs text-on-surface-variant">
      <div className="flex items-center gap-2">
        <span>Tampilkan</span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
          className="bg-surface-container-high rounded-lg px-2 py-1 text-xs text-on-surface focus:outline-none"
        >
          {LIMIT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span>
          per halaman · {from}-{to} dari {total}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          <span>Sebelumnya</span>
        </button>
        <span className="font-bold text-on-surface">
          {page} / {totalPages}
        </span>
        <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <span>Berikutnya</span>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}

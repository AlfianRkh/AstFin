import React, { useState, useEffect } from "react";
import { api } from "../../api/client";

export function AdjustCreditLimitModal({ isOpen, onClose, onSuccess, creditCard = null }) {
  const [mode, setMode] = useState("increase"); // "increase" | "set"
  const [increaseAmount, setIncreaseAmount] = useState("");
  const [newCreditLimit, setNewCreditLimit] = useState("");
  const [loading, setLoading] = useState(false);

  const formatRupiah = (val) => "Rp " + Math.round(val || 0).toLocaleString("id-ID");

  const currentLimit = creditCard ? (creditCard.credit_limit || 0) : 0;
  const currentBalance = creditCard ? (creditCard.balance || 0) : 0;

  useEffect(() => {
    if (isOpen && creditCard) {
      setMode("increase");
      setIncreaseAmount("");
      setNewCreditLimit(currentLimit ? currentLimit.toString() : "");
    }
  }, [isOpen, creditCard, currentLimit]);

  if (!isOpen || !creditCard) return null;

  const parsedIncrease = parseFloat(increaseAmount) || 0;
  const parsedNewLimit = parseFloat(newCreditLimit) || 0;

  // Calculat preview
  let simLimit = currentLimit;
  let simBalance = currentBalance;
  if (mode === "increase") {
    simLimit = currentLimit + parsedIncrease;
    simBalance = currentBalance + parsedIncrease;
  } else {
    simLimit = parsedNewLimit;
    const delta = parsedNewLimit - currentLimit;
    simBalance = Math.max(0, currentBalance + delta);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === "increase" && parsedIncrease <= 0) {
      alert("Masukkan nominal penambahan limit yang lebih besar dari 0");
      return;
    }
    if (mode === "set" && parsedNewLimit <= 0) {
      alert("Masukkan nominal plafon limit baru yang valid");
      return;
    }

    setLoading(true);
    try {
      if (mode === "increase") {
        await api.adjustCreditLimit(creditCard.id, {
          increase_amount: parsedIncrease,
        });
        alert(`Limit kartu kredit ${creditCard.name} berhasil dinaikkan +${formatRupiah(parsedIncrease)}! Plafon baru: ${formatRupiah(simLimit)}.`);
      } else {
        await api.adjustCreditLimit(creditCard.id, {
          credit_limit: parsedNewLimit,
        });
        alert(`Plafon kartu kredit ${creditCard.name} berhasil diubah menjadi ${formatRupiah(simLimit)}.`);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Gagal mengubah limit kartu kredit: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl max-w-md w-full p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">upgrade</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">Atur / Tambah Limit Kartu Kredit</h3>
              <p className="text-[11px] text-outline">
                {creditCard.name} {creditCard.account_number ? `· ${creditCard.account_number}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Current status */}
        <div className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/15 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-outline font-medium">Plafon Limit Saat Ini:</span>
            <span className="font-extrabold text-on-surface">{formatRupiah(currentLimit)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-outline font-medium">Sisa Limit Tersedia:</span>
            <span className="font-bold text-secondary">{formatRupiah(currentBalance)}</span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-surface-container-low p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMode("increase")}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === "increase"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>Tambah Limit (+Rp)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("set")}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === "set"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            <span>Ubah Plafon Total</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          {mode === "increase" ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-primary uppercase">
                  Nominal Penambahan Limit (+ Rp)
                </label>
                {parsedIncrease > 0 && (
                  <span className="text-[10px] text-primary font-bold">
                    +{formatRupiah(parsedIncrease)}
                  </span>
                )}
              </div>
              <input
                type="number"
                required
                min="10000"
                value={increaseAmount}
                onChange={(e) => setIncreaseAmount(e.target.value)}
                placeholder="Contoh: 5000000"
                className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-on-surface border border-primary/40 focus:outline-none focus:border-primary font-bold text-sm"
              />

              {/* Quick shortcut increments */}
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {[1000000, 2000000, 5000000, 10000000].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => setIncreaseAmount(inc.toString())}
                    className="bg-surface-container-low hover:bg-surface-bright py-1.5 rounded-lg text-[10px] font-bold text-outline hover:text-primary transition-colors border border-outline-variant/15"
                  >
                    +{inc >= 1000000 ? `${inc / 1000000} Jt` : inc}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-primary uppercase">
                  Plafon Limit Saldo Baru (Rp)
                </label>
                {parsedNewLimit > 0 && (
                  <span className="text-[10px] text-primary font-bold">
                    {formatRupiah(parsedNewLimit)}
                  </span>
                )}
              </div>
              <input
                type="number"
                required
                min="10000"
                value={newCreditLimit}
                onChange={(e) => setNewCreditLimit(e.target.value)}
                placeholder="Contoh: 25000000"
                className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-on-surface border border-primary/40 focus:outline-none focus:border-primary font-bold text-sm"
              />
            </div>
          )}

          {/* Simulation Preview Card */}
          {((mode === "increase" && parsedIncrease > 0) || (mode === "set" && parsedNewLimit > 0)) && (
            <div className="bg-primary/10 border border-primary/25 rounded-xl p-3 flex flex-col gap-1.5 animate-in fade-in duration-150">
              <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">insights</span>
                Simulasi Setelah Pembaruan:
              </span>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-primary/20">
                <span className="text-on-surface-variant font-medium">Plafon Limit Baru:</span>
                <span className="font-extrabold text-on-surface">{formatRupiah(simLimit)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant font-medium">Sisa Limit Tersedia Baru:</span>
                <span className="font-extrabold text-secondary">{formatRupiah(simBalance)}</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-container hover:bg-surface-bright text-on-surface py-2.5 rounded-lg text-xs font-semibold transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-on-primary hover:bg-primary/90 py-2.5 rounded-lg text-xs font-bold disabled:opacity-50 shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <span>Menyimpan...</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Simpan Limit Baru</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

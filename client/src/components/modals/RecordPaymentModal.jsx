import React, { useState, useEffect } from "react";
import { api } from "../../api/client";

export function RecordPaymentModal({ isOpen, onClose, onSuccess, initialDebt = null }) {
  const [debts, setDebts] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [debtId, setDebtId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      Promise.all([api.getDebts(), api.getWallets()])
        .then(([debtRes, walletRes]) => {
          const debtList = (debtRes.data?.debts || []).filter((d) => d.status !== "paid");
          setDebts(debtList);
          const walletList = walletRes.data?.wallets || [];
          setWallets(walletList);

          if (initialDebt) {
            setDebtId(String(initialDebt.id));
            setAmount(String(initialDebt.remaining || ""));
          } else if (debtList.length > 0) {
            setDebtId(String(debtList[0].id));
            setAmount(String(debtList[0].remaining || ""));
          }
          if (walletList.length > 0) {
            setWalletId(String(walletList[0].id));
          }
        })
        .catch(() => {});
    }
  }, [isOpen, initialDebt]);

  if (!isOpen) return null;

  const selectedDebt = debts.find((d) => String(d.id) === String(debtId));
  const maxAmount = selectedDebt ? (selectedDebt.remaining ?? (selectedDebt.total_amount - selectedDebt.paid_amount) ?? 0) : 0;
  const numAmount = parseFloat(amount) || 0;
  const isOverMax = selectedDebt && numAmount > maxAmount;
  const isPiutang = selectedDebt?.type === "piutang";
  const typeLabel = isPiutang ? "Piutang" : "Hutang";
  const remainingAfter = Math.max(0, maxAmount - numAmount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!debtId || !amount || numAmount <= 0) {
      alert("Harap pilih catatan utang/piutang dan masukkan nominal bayar yang valid");
      return;
    }

    if (isOverMax) {
      alert(`Nominal pelunasan (Rp ${numAmount.toLocaleString("id-ID")}) melebihi sisa ${typeLabel.toLowerCase()} (Maksimal: Rp ${maxAmount.toLocaleString("id-ID")})`);
      return;
    }

    setLoading(true);
    try {
      await api.recordDebtPayment({
        debt_id: parseInt(debtId),
        wallet_id: walletId ? parseInt(walletId) : 0,
        amount: numAmount,
        notes: notes.trim() || `Pelunasan ${typeLabel} ${selectedDebt ? selectedDebt.contact_name : ""}`,
      });
      alert(`Pembayaran cicilan / pelunasan ${typeLabel.toLowerCase()} berhasil dicatat!`);
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Gagal mencatat pembayaran: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl max-w-md w-full p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">payments</span>
            <h3 className="text-base font-bold text-on-surface">Catat Pelunasan / Cicilan</h3>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Pilih Catatan Utang / Piutang</label>
            {debts.length === 0 ? (
              <p className="text-outline text-xs">Tidak ada catatan utang/piutang aktif.</p>
            ) : (
              <select
                value={debtId}
                onChange={(e) => {
                  setDebtId(e.target.value);
                  const found = debts.find((d) => String(d.id) === String(e.target.value));
                  if (found) {
                    setAmount(String(found.remaining ?? (found.total_amount - found.paid_amount) ?? ""));
                  }
                }}
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-medium"
              >
                {debts.map((d) => (
                  <option key={d.id} value={d.id}>
                    [{d.type.toUpperCase()}] {d.contact_name} — Sisa: Rp {(d.remaining ?? (d.total_amount - d.paid_amount))?.toLocaleString("id-ID")}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Detail Catatan Terpilih */}
          {selectedDebt && (
            <div className="bg-surface-container-low/70 rounded-xl p-3 border border-outline-variant/15 flex flex-col gap-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isPiutang ? "bg-secondary" : "bg-error"}`}></span>
                  <span>{selectedDebt.contact_name}</span>
                  <span className="text-[10px] text-outline uppercase font-semibold">({typeLabel})</span>
                </span>
                <span className="text-xs font-extrabold text-primary">
                  Sisa: Rp {maxAmount.toLocaleString("id-ID")}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-outline pt-1 border-t border-outline-variant/10">
                <span>Total: Rp {(selectedDebt.total_amount || 0).toLocaleString("id-ID")}</span>
                <span>Sudah Dibayar: Rp {(selectedDebt.paid_amount || 0).toLocaleString("id-ID")}</span>
              </div>

              {numAmount > 0 && (
                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-outline-variant/10">
                  <span className="text-outline">Sisa setelah pelunasan:</span>
                  <span className={`font-bold ${isOverMax ? "text-error" : numAmount >= maxAmount ? "text-success font-extrabold" : "text-primary"}`}>
                    {numAmount >= maxAmount ? "LUNAS (Rp 0)" : `Rp ${remainingAfter.toLocaleString("id-ID")}`}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-outline uppercase">Nominal (Rp)</label>
                {selectedDebt && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(maxAmount))}
                    className="text-[10px] text-primary hover:underline font-bold"
                  >
                    Lunasi Penuh
                  </button>
                )}
              </div>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={`w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border font-bold text-sm focus:outline-none transition-colors ${
                  isOverMax
                    ? "border-error text-error bg-error-container/10 focus:border-error"
                    : "border-outline-variant/20 focus:border-primary"
                }`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-outline uppercase mb-1">
                {isPiutang ? "Masuk ke Rekening" : "Bayar Dari Rekening"}
              </label>
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
              >
                <option value="">-- Tanpa Dompet --</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} (Saldo: Rp {w.balance?.toLocaleString("id-ID")})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Alert Peringatan Jika Nominal Lebih dari Sisa Piutang / Hutang */}
          {isOverMax && (
            <div className="p-2.5 rounded-lg bg-error-container/25 border border-error/40 flex items-start gap-2.5 text-error animate-in fade-in duration-150">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">warning</span>
              <div className="text-[11px] leading-tight flex-1">
                <strong className="block font-bold mb-0.5">Nominal Melebihi Sisa {typeLabel}!</strong>
                Nominal pembayaran (<strong>Rp {numAmount.toLocaleString("id-ID")}</strong>) tidak boleh lebih dari sisa {typeLabel.toLowerCase()} yang harus diselesaikan (Maksimal: <strong>Rp {maxAmount.toLocaleString("id-ID")}</strong>).
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Catatan / Bukti Transfer</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Cicilan termin 2 via transfer BCA"
              className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-container hover:bg-surface-bright text-on-surface py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || debts.length === 0 || isOverMax || numAmount <= 0}
              className={`flex-1 py-2 rounded-lg text-xs font-bold shadow-md transition-all ${
                isOverMax || debts.length === 0 || numAmount <= 0
                  ? "bg-surface-container-highest text-outline cursor-not-allowed opacity-80 border border-outline-variant/30"
                  : "bg-primary-container text-on-primary-container hover:bg-primary disabled:opacity-50"
              }`}
            >
              {loading
                ? "Menyimpan..."
                : isOverMax
                ? `⚠️ Melebihi Sisa ${typeLabel}`
                : "Konfirmasi Pembayaran"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

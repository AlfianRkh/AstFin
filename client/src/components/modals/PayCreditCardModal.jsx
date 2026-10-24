import React, { useState, useEffect } from "react";
import { api } from "../../api/client";

export function PayCreditCardModal({ isOpen, onClose, onSuccess, creditCard = null }) {
  const [wallets, setWallets] = useState([]);
  const [sourceWalletId, setSourceWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const formatRupiah = (val) => "Rp " + Math.round(val || 0).toLocaleString("id-ID");

  const creditLimit = creditCard ? (creditCard.credit_limit || 0) : 0;
  const currentBalance = creditCard ? (creditCard.balance || 0) : 0;
  const usedAmount = Math.max(0, creditLimit - currentBalance);

  useEffect(() => {
    if (isOpen) {
      api.getWallets().then((res) => {
        const allWallets = res.data?.wallets || [];
        // Only bank, e-wallet, and cash accounts (exclude credit cards)
        const bankWallets = allWallets.filter(
          (w) => w.type !== "Credit Card" && w.type !== "Kartu Kredit"
        );
        setWallets(bankWallets);
        if (bankWallets.length > 0) {
          setSourceWalletId(bankWallets[0].id);
        }
      }).catch(() => {});

      if (usedAmount > 0) {
        setAmount(usedAmount.toString());
      } else {
        setAmount("");
      }
      setNote(creditCard ? `Pembayaran tagihan ${creditCard.name}` : "");
    }
  }, [isOpen, creditCard]);

  if (!isOpen || !creditCard) return null;

  const selectedSource = wallets.find((w) => w.id === parseInt(sourceWalletId));
  const parsedAmount = parseFloat(amount) || 0;
  const simNewBalance = Math.min(creditLimit, currentBalance + parsedAmount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sourceWalletId) {
      alert("Pilih rekening sumber pembayaran terlebih dahulu");
      return;
    }
    if (parsedAmount <= 0) {
      alert("Masukkan nominal pembayaran yang valid");
      return;
    }
    if (selectedSource && selectedSource.balance < parsedAmount) {
      alert(`Saldo ${selectedSource.name} tidak mencukupi (${formatRupiah(selectedSource.balance)}) untuk membayar ${formatRupiah(parsedAmount)}`);
      return;
    }

    setLoading(true);
    try {
      await api.payCreditCard(creditCard.id, {
        source_wallet_id: parseInt(sourceWalletId),
        amount: parsedAmount,
        note: note.trim() || `Pembayaran tagihan ${creditCard.name}`,
      });
      alert(`Pembayaran ${formatRupiah(parsedAmount)} berhasil! Limit kartu kredit ${creditCard.name} telah dipulihkan.`);
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Gagal melakukan pembayaran kartu kredit: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[24px]">credit_card_heart</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">Bayar Tagihan & Pulihkan Limit</h3>
              <p className="text-[11px] text-outline">
                {creditCard.name} {creditCard.account_number ? `· ${creditCard.account_number}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Status Plafon & Pemakaian Saat Ini */}
        <div className="bg-surface-container-low p-4 rounded-xl border border-secondary/20 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-outline font-medium">Tagihan / Limit Terpakai:</span>
            <span className="text-sm font-extrabold text-error">
              {formatRupiah(usedAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-outline font-medium">Sisa Limit Tersedia Saat Ini:</span>
            <span className="text-xs font-bold text-secondary">
              {formatRupiah(currentBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-outline-variant/15 pt-2">
            <span className="text-outline font-medium">Plafon Limit Semula (Maksimal):</span>
            <span className="text-xs font-bold text-on-surface">
              {formatRupiah(creditLimit)}
            </span>
          </div>

          {/* Quick Pay Buttons */}
          {usedAmount > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAmount(Math.round(usedAmount * 0.5).toString())}
                className="flex-1 bg-surface-container hover:bg-surface-bright text-[11px] py-1.5 rounded-lg font-semibold transition-colors border border-outline-variant/20"
              >
                Bayar 50%
              </button>
              <button
                type="button"
                onClick={() => setAmount(usedAmount.toString())}
                className="flex-1 bg-secondary/20 hover:bg-secondary text-secondary hover:text-on-secondary text-[11px] py-1.5 rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                <span>Bayar Lunas (Reset Limit)</span>
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          {/* Pilih Rekening Pembayar */}
          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">
              Rekening Sumber Pembayaran (Kas/Bank)
            </label>
            {wallets.length === 0 ? (
              <div className="p-3 bg-error-container/20 border border-error-container text-error rounded-lg text-xs">
                Belum ada rekening kas atau bank yang terdaftar untuk membayar.
              </div>
            ) : (
              <select
                value={sourceWalletId}
                onChange={(e) => setSourceWalletId(e.target.value)}
                className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-medium"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.type}) — Saldo: {formatRupiah(w.balance)}
                  </option>
                ))}
              </select>
            )}
            {selectedSource && (
              <p className="text-[10px] text-outline mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] text-primary">account_balance_wallet</span>
                Saldo tersedia di {selectedSource.name}: <strong className="text-on-surface">{formatRupiah(selectedSource.balance)}</strong>
              </p>
            )}
          </div>

          {/* Nominal Pembayaran */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-outline uppercase">
                Nominal Pembayaran (Rp)
              </label>
              {parsedAmount > 0 && (
                <span className="text-[10px] text-secondary font-bold">
                  {formatRupiah(parsedAmount)}
                </span>
              )}
            </div>
            <input
              type="number"
              required
              min="1"
              max={creditLimit}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 2500000"
              className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-secondary font-bold text-sm"
            />
          </div>

          {/* Preview Pemulihan Limit */}
          {parsedAmount > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex flex-col gap-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs">
                <span className="text-primary font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                  Sisa Limit Setelah Dibayar:
                </span>
                <span className="text-sm font-extrabold text-primary">
                  {formatRupiah(simNewBalance)}
                </span>
              </div>
              <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((simNewBalance / creditLimit) * 100))}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-on-surface-variant">
                {simNewBalance >= creditLimit
                  ? "✨ Sisa limit Anda akan kembali penuh 100% ke limit semula (" + formatRupiah(creditLimit) + ")."
                  : `Limit dipulihkan sebesar ${formatRupiah(parsedAmount)}.`}
              </p>
            </div>
          )}

          {/* Catatan / Keterangan */}
          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Catatan Transaksi</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Pembayaran tagihan bulanan via BCA"
              className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
            />
          </div>

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
              disabled={loading || wallets.length === 0}
              className="flex-1 bg-secondary text-on-secondary hover:bg-secondary/90 py-2.5 rounded-lg text-xs font-bold disabled:opacity-50 shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <span>Memproses...</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Konfirmasi Pembayaran</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

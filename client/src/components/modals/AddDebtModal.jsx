import React, { useState, useEffect, useMemo } from "react";
import { api } from "../../api/client";

export function AddDebtModal({ isOpen, onClose, onSuccess, initialData = null, onOpenWallet = null }) {
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [type, setType] = useState("hutang"); // 'hutang' (saya berhutang / pakai kartu kredit), 'piutang' (orang lain pinjam ke saya)
  const [totalAmount, setTotalAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");
  const [wallets, setWallets] = useState([]);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingWallets(true);
      api.getWallets()
        .then((res) => {
          const list = Array.isArray(res?.data?.wallets)
            ? res.data.wallets
            : Array.isArray(res?.wallets)
            ? res.wallets
            : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
            ? res
            : [];
          setWallets(list);

          const targetType = initialData?.type || type;
          if (initialData?.walletId) {
            setSelectedWalletId(String(initialData.walletId));
          } else {
            if (targetType === "hutang") {
              const firstCard = list.find((w) => w.type === "Credit Card" || w.type === "Kartu Kredit");
              if (firstCard) setSelectedWalletId(String(firstCard.id));
            } else if (targetType === "piutang") {
              const firstBank = list.find((w) => w.type !== "Credit Card" && w.type !== "Kartu Kredit") || list[0];
              if (firstBank) setSelectedWalletId(String(firstBank.id));
            }
          }
        })
        .catch((err) => {
          console.error("Gagal memuat dompet:", err);
        })
        .finally(() => {
          setLoadingWallets(false);
        });

      if (initialData) {
        if (initialData.type) setType(initialData.type);
        if (initialData.contactName) setContactName(initialData.contactName);
        if (initialData.totalAmount) setTotalAmount(String(initialData.totalAmount));
        if (initialData.notes) setNotes(initialData.notes);
      }
    }
  }, [isOpen, initialData]);

  // Credit Cards filtered from all wallets
  const creditCards = useMemo(() => {
    return wallets.filter((w) => w.type === "Credit Card" || w.type === "Kartu Kredit");
  }, [wallets]);

  // Bank & Cash Wallets
  const bankWallets = useMemo(() => {
    return wallets.filter((w) => w.type !== "Credit Card" && w.type !== "Kartu Kredit");
  }, [wallets]);

  // Selected Wallet Details
  const selectedWallet = useMemo(() => {
    if (!selectedWalletId) return null;
    return wallets.find((w) => String(w.id) === String(selectedWalletId)) || null;
  }, [selectedWalletId, wallets]);

  const isSelectedCreditCard = selectedWallet?.type === "Credit Card" || selectedWallet?.type === "Kartu Kredit";
  const numAmount = parseFloat(totalAmount) || 0;
  const currentBalance = selectedWallet ? (selectedWallet.balance || 0) : 0;

  // Validation conditions
  const isOverCreditLimit = type === "hutang" && isSelectedCreditCard && numAmount > currentBalance;
  const isOverPiutangBalance = type === "piutang" && selectedWallet && numAmount > currentBalance;
  const isOverLimit = isOverCreditLimit || isOverPiutangBalance;
  const isMissingPiutangWallet = type === "piutang" && !selectedWalletId;
  const remainingAfter = selectedWallet ? currentBalance - numAmount : 0;

  const handleTypeSelect = (newType) => {
    setType(newType);
    if (newType === "piutang") {
      // Auto switch to first bank wallet if none or if currently on credit card
      const firstBank = bankWallets.length > 0 ? bankWallets[0] : (wallets[0] || null);
      if (firstBank && (!selectedWalletId || isSelectedCreditCard)) {
        setSelectedWalletId(String(firstBank.id));
      }
    } else if (newType === "hutang") {
      // Auto select credit card if available
      const firstCard = creditCards[0] || null;
      if (firstCard && !selectedWalletId) {
        setSelectedWalletId(String(firstCard.id));
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contactName.trim() || !totalAmount || numAmount <= 0) {
      alert("Harap masukkan nama kontak dan nominal yang valid");
      return;
    }

    if (type === "piutang" && !selectedWalletId) {
      alert("Harap pilih rekening bank atau dompet penyalur untuk mencatat piutang");
      return;
    }

    if (isOverPiutangBalance) {
      const limitLabel = isSelectedCreditCard ? "sisa limit kartu kredit" : "saldo kas rekening";
      alert(`Nominal piutang (Rp ${numAmount.toLocaleString("id-ID")}) melebihi ${limitLabel} yang tersedia di ${selectedWallet?.name} (Tersedia: Rp ${currentBalance.toLocaleString("id-ID")})`);
      return;
    }

    if (isOverCreditLimit) {
      alert(`Nominal pinjaman (Rp ${numAmount.toLocaleString("id-ID")}) melebihi sisa limit kartu kredit yang tersedia (Rp ${currentBalance.toLocaleString("id-ID")})`);
      return;
    }

    setLoading(true);
    try {
      await api.createDebt({
        wallet_id: selectedWalletId ? parseInt(selectedWalletId) : null,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        type,
        total_amount: numAmount,
        due_date: dueDate,
        notes: notes.trim(),
      });

      setContactName("");
      setContactPhone("");
      setTotalAmount("");
      setNotes("");
      setSelectedWalletId("");
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Gagal mencatat utang/piutang: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">handshake</span>
            <div>
              <h3 className="text-base font-bold text-on-surface">Catat Pinjaman & Buku Utang-Piutang</h3>
              <p className="text-[11px] text-outline">Kelola pinjaman personal atau transaksi kartu kredit berjangka</p>
            </div>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
          {/* Toggle Type: Hutang vs Piutang */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTypeSelect("hutang")}
              className={`py-2 rounded-lg font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                type === "hutang"
                  ? "bg-error-container text-on-error-container border-error shadow-sm"
                  : "bg-surface-container border-outline-variant/20 text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">credit_card</span>
              - Hutang (Saya Berhutang / Kartu Kredit)
            </button>
            <button
              type="button"
              onClick={() => handleTypeSelect("piutang")}
              className={`py-2 rounded-lg font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                type === "piutang"
                  ? "bg-secondary-container text-on-secondary-container border-secondary shadow-sm"
                  : "bg-surface-container border-outline-variant/20 text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">outbox</span>
              + Piutang (Saya Meminjamkan)
            </button>
          </div>

          {/* Kartu Kredit / Sumber Dompet Penyalur */}
          <div className="bg-surface-container-low/70 rounded-xl p-3 border border-outline-variant/15 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-outline uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-[16px]">
                  {type === "piutang" ? "account_balance_wallet" : "credit_score"}
                </span>
                <span>
                  {type === "piutang"
                    ? "Rekening Bank Penyalur Piutang (Saldo Otomatis Terpotong)"
                    : "Sumber Kartu Kredit / Rekening"}
                </span>
              </label>
              {type === "hutang" && creditCards.length === 0 && onOpenWallet && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenWallet();
                  }}
                  className="text-[11px] text-secondary hover:underline font-bold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">add_card</span>
                  <span>+ Tambah Kartu Kredit</span>
                </button>
              )}
            </div>

            {loadingWallets ? (
              <div className="py-2 px-3 text-outline text-xs flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin"></span>
                <span>Memuat daftar rekening & kartu kredit...</span>
              </div>
            ) : (
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className={`w-full bg-surface-container rounded-lg px-3 py-2 text-on-surface border focus:outline-none font-medium transition-colors ${
                  isMissingPiutangWallet
                    ? "border-warning/60 focus:border-warning"
                    : "border-outline-variant/20 focus:border-secondary"
                }`}
              >
                {type === "piutang" ? (
                  <option value="">-- Pilih Rekening Bank / Dompet Penyalur Dana --</option>
                ) : (
                  <option value="">-- Tanpa Kartu Kredit (Catatan Manual / Tunai) --</option>
                )}

                {/* If Piutang, show Bank & Cash first */}
                {type === "piutang" ? (
                  <>
                    {bankWallets.length > 0 && (
                      <optgroup label="🏦 Rekening Bank & Dompet Kas (Saldo Akan Terpotong)">
                        {bankWallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.type}) — Saldo: Rp {(w.balance || 0).toLocaleString("id-ID")}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {creditCards.length > 0 && (
                      <optgroup label="💳 Kartu Kredit (Tarik Tunai / Cash Advance)">
                        {creditCards.map((cc) => (
                          <option key={cc.id} value={cc.id}>
                            💳 {cc.name} — Sisa Limit: Rp {(cc.balance || 0).toLocaleString("id-ID")}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                ) : (
                  <>
                    {creditCards.length > 0 && (
                      <optgroup label="💳 Kartu Kredit Terdaftar (Dengan Batasan Limit)">
                        {creditCards.map((cc) => (
                          <option key={cc.id} value={cc.id}>
                            💳 {cc.name} — Sisa Limit: Rp {(cc.balance || 0).toLocaleString("id-ID")} (Plafon: Rp {(cc.credit_limit || 0).toLocaleString("id-ID")})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {bankWallets.length > 0 && (
                      <optgroup label="🏦 Rekening Bank & Dompet Lainnya">
                        {bankWallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.type}) — Saldo: Rp {(w.balance || 0).toLocaleString("id-ID")}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                )}
              </select>
            )}

            {/* Selected Wallet Detail Visual Indicator */}
            {selectedWallet && (
              <div className="mt-1 bg-surface-container/90 rounded-lg p-2.5 border border-secondary/30 flex flex-col gap-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-secondary text-[16px]">
                      {isSelectedCreditCard ? "credit_card" : "account_balance"}
                    </span>
                    {selectedWallet.name}
                    {selectedWallet.account_number && (
                      <span className="text-[10px] text-outline font-normal">({selectedWallet.account_number})</span>
                    )}
                  </span>
                  <span
                    className={`text-[11px] font-extrabold ${
                      isOverLimit ? "text-error" : "text-secondary"
                    }`}
                  >
                    {isSelectedCreditCard ? "Sisa Limit: " : "Saldo Tersedia: "}
                    Rp {currentBalance.toLocaleString("id-ID")}
                  </span>
                </div>

                {/* Progress bar pemakaian jika kartu kredit */}
                {isSelectedCreditCard && (selectedWallet.credit_limit || 0) > 0 && (
                  <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isOverLimit ? "bg-error" : "bg-secondary"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (((selectedWallet.credit_limit || 0) - currentBalance + numAmount) /
                            (selectedWallet.credit_limit || 1)) *
                            100
                        )}%`,
                      }}
                    ></div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-outline">
                  <span>
                    {isSelectedCreditCard
                      ? `Plafon: Rp ${(selectedWallet.credit_limit || 0).toLocaleString("id-ID")}`
                      : `Tipe: ${selectedWallet.type}`}
                  </span>
                  {numAmount > 0 && (
                    <span className={`font-semibold ${isOverLimit ? "text-error" : "text-secondary"}`}>
                      Sisa setelah {type === "piutang" ? "penyaluran" : "transaksi"}: Rp{" "}
                      {remainingAfter.toLocaleString("id-ID")}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">
              {type === "hutang" ? "Pemberi Pinjaman / Merchant / Bank" : "Nama Peminjam / Pihak Kedua"}
            </label>
            <input
              type="text"
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder={type === "hutang" ? "Contoh: Bank BCA, Dedi Kusuma, Tokopedia PayLater" : "Contoh: Budi Pratama, Rian"}
              className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-secondary"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-outline uppercase mb-1">No. WhatsApp / HP</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="081234567890"
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-secondary"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-outline uppercase">Nominal Pokok (Rp)</label>
                {selectedWallet && (
                  <button
                    type="button"
                    onClick={() => setTotalAmount(String(currentBalance))}
                    className="text-[10px] text-secondary hover:underline font-bold"
                  >
                    {type === "piutang" ? "Set Max Saldo" : isSelectedCreditCard ? "Set Max Limit" : "Set Saldo"}
                  </button>
                )}
              </div>
              <input
                type="number"
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0"
                className={`w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border font-bold text-sm focus:outline-none transition-colors ${
                  isOverLimit
                    ? "border-error focus:border-error text-error bg-error-container/10"
                    : "border-outline-variant/20 focus:border-secondary"
                }`}
              />
            </div>
          </div>

          {/* Validation Warning Alert: Piutang Over Balance */}
          {isOverPiutangBalance && (
            <div className="p-2.5 rounded-lg bg-error-container/25 border border-error/40 flex items-start gap-2.5 text-error animate-in fade-in duration-150">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">warning</span>
              <div className="text-[11px] leading-tight flex-1">
                <strong className="block font-bold mb-0.5">Nominal Melebihi Saldo yang Tersedia!</strong>
                Nominal piutang (<strong>Rp {numAmount.toLocaleString("id-ID")}</strong>) melebihi saldo kas yang tersedia di{" "}
                <strong>{selectedWallet?.name}</strong> (Tersedia: <strong>Rp {currentBalance.toLocaleString("id-ID")}</strong>).
                Nominal transaksi harus disesuaikan agar tidak melebihi saldo kas.
              </div>
            </div>
          )}

          {/* Validation Warning Alert: Hutang Over Credit Limit */}
          {isOverCreditLimit && (
            <div className="p-2.5 rounded-lg bg-error-container/25 border border-error/40 flex items-start gap-2.5 text-error animate-in fade-in duration-150">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">warning</span>
              <div className="text-[11px] leading-tight flex-1">
                <strong className="block font-bold mb-0.5">Melebihi Sisa Limit Kartu Kredit!</strong>
                Nominal pinjaman (<strong>Rp {numAmount.toLocaleString("id-ID")}</strong>) melebihi limit tersedia kartu kredit{" "}
                <strong>{selectedWallet?.name}</strong> (Maksimal: <strong>Rp {currentBalance.toLocaleString("id-ID")}</strong>).
              </div>
            </div>
          )}

          {/* Warning Info if Piutang has no wallet selected */}
          {isMissingPiutangWallet && (
            <div className="p-2.5 rounded-lg bg-warning-container/20 border border-warning/40 flex items-start gap-2 text-warning animate-in fade-in duration-150">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">info</span>
              <div className="text-[11px] leading-tight">
                <strong className="block font-bold mb-0.5">Pilih Rekening Penyalur Piutang</strong>
                Pilih rekening bank atau dompet penyalur dana agar saldo kas dapat dipotong otomatis ketika piutang dicatat.
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Tanggal Jatuh Tempo</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Keterangan / Keperluan Pinjaman</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                type === "piutang"
                  ? "Contoh: Pinjaman modal usaha kecil, pinjaman rekan kerja"
                  : "Contoh: Cicilan part laptop 0% 6 bulan, talangan belanja"
              }
              className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none"
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
              disabled={loading || isOverLimit || isMissingPiutangWallet}
              className={`flex-1 py-2 rounded-lg text-xs font-bold shadow-md transition-all ${
                isOverLimit || isMissingPiutangWallet
                  ? "bg-surface-container-highest text-outline cursor-not-allowed opacity-80 border border-outline-variant/30"
                  : "bg-secondary-container text-on-secondary-container hover:bg-secondary disabled:opacity-50"
              }`}
            >
              {loading
                ? "Menyimpan..."
                : isMissingPiutangWallet
                ? "Pilih Rekening Bank Dahulu"
                : isOverPiutangBalance
                ? "⚠️ Saldo Kas Tidak Mencukupi"
                : isOverCreditLimit
                ? "⚠️ Melebihi Limit Kartu Kredit"
                : type === "piutang"
                ? "+ Catat Piutang & Potong Saldo"
                : "Simpan Catatan Pinjaman"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

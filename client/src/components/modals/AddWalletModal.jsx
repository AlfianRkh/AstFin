import React, { useState } from "react";
import { api } from "../../api/client";

export function AddWalletModal({ isOpen, onClose, onSuccess, initialCategory = "cash" }) {
  // Category tab: "cash" (Rekening Kas/Bank) vs "credit" (Kartu Kredit / PayLater)
  const [categoryTab, setCategoryTab] = useState(initialCategory === "credit" ? "credit" : "cash");
  const [name, setName] = useState("");
  const [type, setType] = useState("Bank");
  const [balance, setBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const formatRupiah = (val) => "Rp " + Math.round(val || 0).toLocaleString("id-ID");

  if (!isOpen) return null;

  const isCredit = categoryTab === "credit";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (isCredit && (!creditLimit || parseFloat(creditLimit) <= 0)) {
      alert("Harap masukkan nominal plafon limit kartu kredit yang valid");
      return;
    }

    setLoading(true);
    try {
      const parsedCreditLimit = isCredit ? (parseFloat(creditLimit) || 0) : 0;
      const parsedBalance = parseFloat(balance);
      const initialAmount = isCredit 
        ? (!isNaN(parsedBalance) && parsedBalance >= 0 ? parsedBalance : parsedCreditLimit)
        : (parsedBalance || 0);

      await api.createWallet({
        name: name.trim(),
        type: isCredit ? "Credit Card" : type,
        initial_amount: initialAmount,
        credit_limit: parsedCreditLimit,
        account_number: accountNumber.trim(),
      });

      setName("");
      setType("Bank");
      setBalance("");
      setCreditLimit("");
      setAccountNumber("");
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Gagal menambahkan dompet: " + err.message);
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
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isCredit ? "bg-secondary/15 text-secondary" : "bg-primary/15 text-primary"
            }`}>
              <span className="material-symbols-outlined text-[24px]">
                {isCredit ? "credit_card" : "account_balance_wallet"}
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">
                {isCredit ? "Tambah Kartu Kredit / PayLater" : "Tambah Rekening Kas & Bank"}
              </h3>
              <p className="text-[11px] text-outline">
                {isCredit ? "Plafon limit kredit dapat dipakai & dipulihkan kembali saat dibayar" : "Kelola saldo rekening kas tunai, bank transfer, atau e-wallet"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Pemisahan Kategori: Rekening vs Kartu Kredit */}
        <div className="grid grid-cols-2 gap-2 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/15">
          <button
            type="button"
            onClick={() => {
              setCategoryTab("cash");
              if (type === "Credit Card") setType("Bank");
            }}
            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              !isCredit
                ? "bg-primary text-on-primary shadow-sm"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_balance</span>
            <span>Rekening Kas & Bank</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCategoryTab("credit");
              setType("Credit Card");
              if (!creditLimit && balance) setCreditLimit(balance);
            }}
            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              isCredit
                ? "bg-secondary text-on-secondary shadow-sm"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">credit_card</span>
            <span>Kartu Kredit / PayLater</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          {/* Info Banner Khusus Kartu Kredit */}
          {isCredit ? (
            <div className="bg-secondary/10 border border-secondary/25 rounded-xl p-3 flex items-start gap-2 text-secondary">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">info</span>
              <div className="text-[11px] leading-relaxed">
                <strong>Aturan Kartu Kredit:</strong> Plafon limit saldo ditentukan di awal. Setiap pemakaian limit akan mengurangi sisa limit. Saat tagihan dibayar, <strong>limit akan otomatis kembali ke limit semula</strong>. Anda juga bisa menaikkan limit saldo sewaktu-waktu.
              </div>
            </div>
          ) : (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-start gap-2 text-primary">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">verified_user</span>
              <div className="text-[11px] leading-relaxed">
                <strong>Likuiditas Kas:</strong> Saldo rekening kas dihitung sebagai total likuiditas kas riil Anda untuk operasional belanja dan transaksi harian.
              </div>
            </div>
          )}

          {/* Nama Dompet */}
          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">
              {isCredit ? "Nama Kartu Kredit / Penerbit" : "Nama Rekening / Dompet"}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isCredit ? "Contoh: BCA Card Platinum, Mandiri Everyday, Tokopedia Card" : "Contoh: BCA Prioritas, Mandiri Utama, GoPay, Dompet Tunai"}
              className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-medium"
            />
          </div>

          {/* Form Fields: Kas vs Kredit */}
          {!isCredit ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-outline uppercase mb-1">Tipe Rekening</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-medium"
                >
                  <option value="Bank">Bank Transfer (BCA, Mandiri, dll)</option>
                  <option value="E-Wallet">E-Wallet (GoPay, OVO, Dana)</option>
                  <option value="Cash">Uang Tunai (Cash / Dompet Fisik)</option>
                  <option value="Investment">Reksa Dana / Kas Pasar Uang</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-primary uppercase mb-1">Saldo Awal Kas (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0"
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-bold"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-secondary uppercase">
                      Plafon Limit Saldo (Rp)
                    </label>
                    {creditLimit && (
                      <span className="text-[10px] text-secondary font-bold">
                        {formatRupiah(creditLimit)}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    min="100000"
                    value={creditLimit}
                    onChange={(e) => {
                      setCreditLimit(e.target.value);
                      if (!balance) setBalance(e.target.value);
                    }}
                    placeholder="Contoh: 20000000"
                    className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-secondary/40 focus:outline-none focus:border-secondary font-bold"
                  />
                  <span className="text-[10px] text-outline mt-1 block">Batas maksimal kredit yang disetujui</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-outline uppercase">
                      Sisa Limit Tersedia Saat Ini (Rp)
                    </label>
                    {balance && (
                      <span className="text-[10px] text-on-surface font-bold">
                        {formatRupiah(balance)}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={creditLimit || undefined}
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder={creditLimit ? `Default: ${creditLimit}` : "Sama dengan plafon"}
                    className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-secondary font-bold"
                  />
                  <span className="text-[10px] text-outline mt-1 block">Kosongkan jika limit masih penuh</span>
                </div>
              </div>

              {/* Shortcut Plafon Preset */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-outline font-semibold">Preset Limit:</span>
                {[5000000, 10000000, 20000000, 50000000].map((lim) => (
                  <button
                    key={lim}
                    type="button"
                    onClick={() => {
                      setCreditLimit(lim.toString());
                      setBalance(lim.toString());
                    }}
                    className="bg-surface-container hover:bg-surface-bright text-[10px] font-bold px-2 py-0.5 rounded text-outline hover:text-secondary transition-colors"
                  >
                    {lim / 1000000} Juta
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nomor Rekening / Kartu */}
          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">
              {isCredit ? "Nomor Kartu (4 Digit Terakhir / Nomor Kartu)" : "Nomor Rekening / No HP Akun (Opsional)"}
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={isCredit ? "Contoh: •••• 5689" : "Contoh: 8201928172 atau 0812345678"}
              className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Actions */}
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
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold disabled:opacity-50 shadow-md transition-all flex items-center justify-center gap-1.5 ${
                isCredit 
                  ? "bg-secondary text-on-secondary hover:bg-secondary/90" 
                  : "bg-primary text-on-primary hover:bg-primary/90"
              }`}
            >
              {loading ? (
                <span>Menyimpan...</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>{isCredit ? "Simpan Kartu Kredit" : "Simpan Rekening Kas"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

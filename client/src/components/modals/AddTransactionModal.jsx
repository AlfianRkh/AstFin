import React, { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "../../api/client";

const DEFAULT_EXPENSE_CATEGORIES = [
  "Belanja Dapur & Groceries",
  "Makanan & Minuman",
  "Transportasi & Bensin",
  "Tagihan & Utilitas",
  "Gadget & Setup",
  "Kesehatan & Medis",
  "Pendidikan & Kursus",
  "Hiburan & Rekreasi",
];

const DEFAULT_INCOME_CATEGORIES = [
  "Top-Up Saldo / Setoran Awal",
  "Refund / Pembatalan Transaksi Kartu Kredit",
  "Gaji & Honorarium",
  "Bonus & Tunjangan",
  "Penjualan & Bisnis",
  "Investasi & Dividen",
];

export function AddTransactionModal({ isOpen, onClose, onSuccess, initialData = null, onOpenWallet = null }) {
  const [wallets, setWallets] = useState([]);
  const [walletId, setWalletId] = useState("");
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [saveCategoryToDb, setSaveCategoryToDb] = useState(true);
  const [savedCategories, setSavedCategories] = useState([]);
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.toISOString().split("T")[0];
  });
  const [loading, setLoading] = useState(false);

  // Fetch wallets from database
  const fetchWallets = useCallback(async () => {
    setLoadingWallets(true);
    try {
      const res = await api.getWallets();
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
      if (list.length > 0) {
        setWalletId((curr) => {
          if (initialData?.walletId) return String(initialData.walletId);
          const targetAmount = parseFloat(initialData?.amount) || 0;
          if (targetAmount > 0) {
            // Otomatis pilih dompet yang saldonya mencukupi
            const capable = list.find((w) => (w.balance || 0) >= targetAmount);
            if (capable) return String(capable.id);
            // Jika tidak ada yang cukup, pilih dompet dengan saldo tertinggi
            const highest = [...list].sort((a, b) => (b.balance || 0) - (a.balance || 0))[0];
            return String(highest.id);
          }
          const exists = list.some((w) => String(w.id) === String(curr));
          return exists ? String(curr) : String(list[0].id);
        });
      }
    } catch (err) {
      console.error("Gagal memuat daftar dompet:", err);
    } finally {
      setLoadingWallets(false);
    }
  }, [initialData]);

  // Fetch custom categories from database
  const fetchCategories = useCallback(async () => {
    try {
      const cats = await api.getTransactionCategories();
      const list = Array.isArray(cats?.data) ? cats.data : Array.isArray(cats) ? cats : [];
      setSavedCategories(list);
    } catch (err) {
      console.warn("Kategori kustom belum tersedia atau gagal dimuat:", err);
    }
  }, []);

  // When modal opens or initialData changes
  // When modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      fetchWallets();
      fetchCategories();

      if (initialData) {
        if (initialData.type) setType(initialData.type);
        if (initialData.walletId) setWalletId(String(initialData.walletId));
        if (initialData.amount !== undefined && initialData.amount !== null && initialData.amount !== "") {
          setAmount(String(initialData.amount));
        }
        if (initialData.category) setCategory(initialData.category);
        if (initialData.merchant) setMerchant(initialData.merchant);
        if (initialData.notes) setNotes(initialData.notes);
      } else {
        // Defaults
        setType("expense");
        setCategory(DEFAULT_EXPENSE_CATEGORIES[0]);
        setCustomCategory("");
        setAmount("");
        setMerchant("");
        setNotes("");
      }
    }
  }, [isOpen, initialData, fetchWallets, fetchCategories]);

  const isFromRadar = Boolean(initialData?.fromRadar || initialData?.lockType);
  const radarProduct = initialData?.radarProduct;
  const radarTotalQty = Math.max(1, radarProduct?.qty !== undefined && radarProduct?.qty !== null ? radarProduct.qty : 1);
  const [buyQty, setBuyQty] = useState(1);

  const handleSetBuyQty = (targetQty) => {
    const clamped = Math.max(1, Math.min(radarTotalQty, targetQty));
    setBuyQty(clamped);
    const unitPrice = parseFloat(radarProduct?.current_price || initialData?.amount) || 0;
    const newTotal = unitPrice * clamped;
    setAmount(String(newTotal));
    const title = radarProduct?.title || initialData?.radarItemTitle || "Produk";
    const plat = radarProduct?.platform || "E-Commerce";
    setNotes(`Pengadaan barang Price Radar: ${title} (Beli: ${clamped} dari ${radarTotalQty} unit, Platform: ${plat})`);
  };

  // Handle switching transaction type (expense <-> income)
  const handleTypeChange = (newType) => {
    if (isFromRadar) return; // Kunci pada pengeluaran jika dari radar
    if (newType === type) return;
    setType(newType);
    setCategory(newType === "expense" ? DEFAULT_EXPENSE_CATEGORIES[0] : DEFAULT_INCOME_CATEGORIES[0]);
    setCustomCategory("");
    setSaveCategoryToDb(true);
  };

  // Build the list of categories dynamically based on type
  const availableCategories = useMemo(() => {
    const baseList = type === "expense" ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
    const customList = savedCategories
      .filter((c) => c.type === type && !baseList.includes(c.name))
      .map((c) => c.name);

    return [...baseList, ...customList, "Lain-lain"];
  }, [type, savedCategories]);

  // Credit Card Expense Cancellation / Refund Selection State
  const [creditCardExpenses, setCreditCardExpenses] = useState([]);
  const [loadingCCExpenses, setLoadingCCExpenses] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);

  const selectedWallet = wallets.find((w) => String(w.id) === String(walletId));
  const isCreditCard = selectedWallet && (selectedWallet.type === "Credit Card" || selectedWallet.type === "Kartu Kredit");
  const availableBalance = selectedWallet ? (selectedWallet.balance || 0) : 0;
  const parsedAmount = parseFloat(amount) || 0;
  const isOverBalance = type === "expense" && selectedWallet && parsedAmount > availableBalance;

  // Dompet lain yang saldonya mencukupi nominal transaksi
  const capableWallets = useMemo(() => {
    if (parsedAmount <= 0) return [];
    return wallets.filter((w) => String(w.id) !== String(walletId) && (w.balance || 0) >= parsedAmount);
  }, [wallets, walletId, parsedAmount]);

  const allWalletsInsufficient = useMemo(() => {
    if (parsedAmount <= 0 || wallets.length === 0) return false;
    return wallets.every((w) => (w.balance || 0) < parsedAmount);
  }, [wallets, parsedAmount]);

  const highestWallet = useMemo(() => {
    if (wallets.length === 0) return null;
    return [...wallets].sort((a, b) => (b.balance || 0) - (a.balance || 0))[0];
  }, [wallets]);

  // Fetch credit card expenses when choosing income on a credit card
  useEffect(() => {
    if (isOpen && type === "income" && isCreditCard && walletId) {
      setLoadingCCExpenses(true);
      api.getTransactions({ wallet_id: walletId, type: "expense" })
        .then((res) => {
          const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          setCreditCardExpenses(list);
        })
        .catch((err) => {
          console.error("Gagal memuat transaksi kartu kredit:", err);
          setCreditCardExpenses([]);
        })
        .finally(() => setLoadingCCExpenses(false));
    } else {
      setCreditCardExpenses([]);
      setSelectedExpenseIds([]);
    }
  }, [isOpen, type, isCreditCard, walletId]);

  const handleToggleExpense = (tx) => {
    setSelectedExpenseIds((prev) => {
      const exists = prev.includes(tx.id);
      let updated;
      if (exists) {
        updated = prev.filter((id) => id !== tx.id);
      } else {
        updated = [...prev, tx.id];
      }

      // Hitung total nominal transaksi yang terpilih
      const selectedTxs = creditCardExpenses.filter((item) => updated.includes(item.id));
      const totalAmount = selectedTxs.reduce((sum, item) => sum + (item.amount || 0), 0);

      if (updated.length > 0) {
        setAmount(String(totalAmount));
        setCategory("Refund / Pembatalan Transaksi Kartu Kredit");

        // Set nama merchant dari transaksi terpilih
        const merchants = [...new Set(selectedTxs.map((item) => item.merchant || item.category))];
        setMerchant(`Refund: ${merchants.join(", ")}`);

        // Set catatan otomatis
        const noteItems = selectedTxs.map((item) => `#${item.id} (${item.merchant || item.category})`);
        setNotes(`Pembatalan transaksi kartu kredit: ${noteItems.join(", ")}`);
      } else {
        setAmount("");
        setMerchant("");
        setNotes("");
      }

      return updated;
    });
  };

  const handleSelectAllExpenses = () => {
    const allIds = creditCardExpenses.map((t) => t.id);
    setSelectedExpenseIds(allIds);
    const totalAmount = creditCardExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    setAmount(String(totalAmount));
    setCategory("Refund / Pembatalan Transaksi Kartu Kredit");
    setMerchant(`Refund / Cancel (${allIds.length} transaksi)`);
    setNotes(`Pembatalan transaksi kartu kredit: ${creditCardExpenses.map((t) => `#${t.id}`).join(", ")}`);
  };

  const handleDeselectAllExpenses = () => {
    setSelectedExpenseIds([]);
    setAmount("");
    setMerchant("");
    setNotes("");
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!walletId || !amount || parseFloat(amount) <= 0) {
      alert("Harap pilih dompet dan masukkan nominal yang valid");
      return;
    }

    if (type === "expense") {
      if (isCreditCard && !dueDate) {
        alert("Harap pilih tanggal tagihan / jatuh tempo kartu kredit");
        return;
      }
      if (isOverBalance) {
        const limitLabel = isCreditCard ? "sisa limit kartu kredit yang tersedia" : "batas saldo yang tersedia";
        alert(`Nominal transaksi (Rp ${parsedAmount.toLocaleString("id-ID")}) melebihi ${limitLabel} di ${selectedWallet?.name || "dompet"} (Tersedia: Rp ${availableBalance.toLocaleString("id-ID")})`);
        return;
      }
    }

    let finalCategory = category;
    if (category === "Lain-lain") {
      const cleanCustom = customCategory.trim();
      if (!cleanCustom) {
        alert("Harap masukkan nama kategori untuk opsi 'Lain-lain'");
        return;
      }
      finalCategory = cleanCustom;
    }

    setLoading(true);
    try {
      await api.createTransaction({
        wallet_id: parseInt(walletId),
        type,
        amount: parseFloat(amount),
        category: finalCategory,
        merchant: merchant.trim() || (type === "income" ? "Pemasukan / Setoran Kas" : "Pengeluaran Kas"),
        notes: notes.trim(),
        transaction_date: date,
        due_date: type === "expense" && isCreditCard ? dueDate : "",
        save_category: category === "Lain-lain" && saveCategoryToDb,
        cancelled_transaction_ids: type === "income" && isCreditCard ? selectedExpenseIds : [],
      });

      // Jika transaksi berasal dari pengadaan Price Radar, update status/qty radar
      if (initialData?.radarItemId) {
        try {
          const remainingQty = radarTotalQty - buyQty;
          if (remainingQty <= 0) {
            await api.updateRadarItem(initialData.radarItemId, { qty: 0, status: "bought" });
          } else {
            await api.updateRadarItem(initialData.radarItemId, { qty: remainingQty, status: "monitoring" });
          }
        } catch (err) {
          console.warn("Gagal memperbarui status item radar:", err);
        }
      }

      // Update locally if user saved new category so it's instantly available
      if (category === "Lain-lain" && saveCategoryToDb) {
        setSavedCategories((prev) => [
          ...prev,
          { id: Date.now(), name: finalCategory, type }
        ]);
      }

      setAmount("");
      setMerchant("");
      setNotes("");
      setCustomCategory("");
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Gagal mencatat transaksi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl max-w-md w-full p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">receipt_long</span>
            <div>
              <h3 className="text-base font-bold text-on-surface">Catat Transaksi Kas Manual</h3>
              <p className="text-[11px] text-outline">Mutasi kas, belanja pengeluaran, atau isi saldo rekening</p>
            </div>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
          {/* Mode Pengadaan Radar atau Toggle Jenis Transaksi */}
          {isFromRadar ? (
            <div className="bg-gradient-to-br from-primary/15 via-surface-container-low to-secondary/10 border border-primary/40 rounded-2xl p-3.5 shadow-md flex flex-col gap-2.5 animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold shadow-md shrink-0">
                    <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] bg-primary text-on-primary font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Pengadaan Price Radar
                      </span>
                      {radarProduct?.platform && (
                        <span className="text-[10px] bg-secondary-container text-on-secondary-container font-bold px-2 py-0.5 rounded-full">
                          {radarProduct.platform}
                        </span>
                      )}
                      {radarProduct?.deal_score && (
                        <span className="text-[10px] bg-primary-container text-on-primary-container font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[12px]">bolt</span>
                          Deal Score {radarProduct.deal_score}
                        </span>
                      )}
                      {radarProduct?.category && (
                        <span className="text-[10px] bg-surface-container-highest text-on-surface-variant font-medium px-2 py-0.5 rounded-full">
                          {radarProduct.category}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-on-surface truncate mt-1">
                      {radarProduct?.title || initialData?.radarItemTitle || merchant || "Produk Pilihan"}
                    </h4>
                    {radarProduct?.description && (
                      <p className="text-[11px] text-on-surface-variant line-clamp-1">
                        {radarProduct.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-outline block">
                    {buyQty > 1 ? `Total (${buyQty} Unit)` : "Harga Produk"}
                  </span>
                  <span className="text-sm font-black text-primary">
                    Rp {Number((radarProduct?.current_price || initialData?.amount || 0) * buyQty).toLocaleString("id-ID")}
                  </span>
                  {buyQty > 1 && (
                    <span className="text-[10px] text-outline block font-medium">
                      @ Rp {Number(radarProduct?.current_price || initialData?.amount || 0).toLocaleString("id-ID")}/unit
                    </span>
                  )}
                </div>
              </div>

              {/* Price Details Grid (Target, ATH, Tabungan, Total Qty) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-outline-variant/15 text-[11px]">
                <div className="bg-surface-container/70 rounded-lg p-1.5 px-2">
                  <span className="text-[9px] uppercase font-bold text-outline block">Target Harga</span>
                  <span className="font-bold text-on-surface">
                    {radarProduct?.target_price ? `Rp ${Number(radarProduct.target_price).toLocaleString("id-ID")}` : "-"}
                  </span>
                </div>
                <div className="bg-surface-container/70 rounded-lg p-1.5 px-2">
                  <span className="text-[9px] uppercase font-bold text-outline block">Harga Tertinggi</span>
                  <span className="font-bold text-outline line-through">
                    {radarProduct?.all_time_high_price ? `Rp ${Number(radarProduct.all_time_high_price).toLocaleString("id-ID")}` : "-"}
                  </span>
                </div>
                <div className="bg-surface-container/70 rounded-lg p-1.5 px-2">
                  <span className="text-[9px] uppercase font-bold text-outline block">Tabungan Siap</span>
                  <span className="font-bold text-secondary">
                    {radarProduct?.saved_amount ? `Rp ${Number(radarProduct.saved_amount).toLocaleString("id-ID")}` : "Rp 0"}
                  </span>
                </div>
                <div className="bg-surface-container/70 rounded-lg p-1.5 px-2">
                  <span className="text-[9px] uppercase font-bold text-outline block">Kebutuhan Unit</span>
                  <span className="font-bold text-primary">
                    {radarTotalQty} Unit
                  </span>
                </div>
              </div>

              {/* Pemilihan Kuantitas Pembelian (Beli 1 vs Beli Semua) */}
              <div className="bg-surface-container/80 rounded-xl p-2.5 border border-primary/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
                    <span className="material-symbols-outlined text-primary text-[16px]">inventory_2</span>
                    <span>Pilih Qty Pembelian:</span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant">
                    Sisa setelah beli: <strong className="text-secondary">{Math.max(0, radarTotalQty - buyQty)} unit</strong>{" "}
                    {radarTotalQty - buyQty > 0 ? "(tetap aktif di radar)" : "(seluruhnya habis)"}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-surface-container-high rounded-lg border border-outline-variant/30 p-0.5">
                    <button
                      type="button"
                      disabled={buyQty <= 1}
                      onClick={() => handleSetBuyQty(buyQty - 1)}
                      className="w-6 h-6 flex items-center justify-center text-on-surface hover:bg-surface-bright rounded disabled:opacity-30 transition-colors"
                      title="Kurangi 1 unit"
                    >
                      <span className="material-symbols-outlined text-[15px]">remove</span>
                    </button>
                    <span className="w-8 text-center font-black text-xs text-primary">
                      {buyQty}
                    </span>
                    <button
                      type="button"
                      disabled={buyQty >= radarTotalQty}
                      onClick={() => handleSetBuyQty(buyQty + 1)}
                      className="w-6 h-6 flex items-center justify-center text-on-surface hover:bg-surface-bright rounded disabled:opacity-30 transition-colors"
                      title="Tambah 1 unit"
                    >
                      <span className="material-symbols-outlined text-[15px]">add</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSetBuyQty(1)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                      buyQty === 1
                        ? "bg-primary text-on-primary border-primary shadow-xs"
                        : "bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:text-on-surface"
                    }`}
                  >
                    Beli 1 Qty
                  </button>

                  {radarTotalQty > 1 && (
                    <button
                      type="button"
                      onClick={() => handleSetBuyQty(radarTotalQty)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                        buyQty === radarTotalQty
                          ? "bg-primary text-on-primary border-primary shadow-xs"
                          : "bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:text-on-surface"
                      }`}
                    >
                      Beli Semua ({radarTotalQty})
                    </button>
                  )}
                </div>
              </div>

              {radarProduct?.url && (
                <div className="pt-0.5 flex justify-end">
                  <a
                    href={radarProduct.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-primary hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Buka Tautan Produk di {radarProduct.platform || "E-Commerce"}</span>
                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange("expense")}
                className={`py-2 rounded-lg font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                  type === "expense"
                    ? "bg-error-container text-on-error-container border-error shadow-sm"
                    : "bg-surface-container border-outline-variant/20 text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                - Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("income")}
                className={`py-2 rounded-lg font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                  type === "income"
                    ? "bg-primary-container text-on-primary-container border-primary shadow-sm"
                    : "bg-surface-container border-outline-variant/20 text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                + Pemasukan (Isi Saldo)
              </button>
            </div>
          )}

          {/* Dompet / Rekening */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-outline uppercase">Dompet / Rekening</label>
              <button
                type="button"
                onClick={fetchWallets}
                title="Muat ulang dompet"
                className="text-[10px] text-outline hover:text-primary flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[13px]">sync</span>
                <span>Refresh</span>
              </button>
            </div>

            {loadingWallets ? (
              <div className="flex items-center gap-2 py-2.5 px-3 bg-surface-container-low rounded-lg text-outline text-xs">
                <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                <span>Memuat data dompet...</span>
              </div>
            ) : wallets.length === 0 ? (
              <div className="p-3 bg-error-container/20 border border-error/30 rounded-lg flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-error">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  <span className="text-xs font-semibold">Belum ada dompet! Tambah dompet terlebih dahulu.</span>
                </div>
                {onOpenWallet && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenWallet();
                    }}
                    className="text-[11px] bg-primary-container text-on-primary-container font-bold px-2.5 py-1 rounded hover:bg-primary transition-colors shrink-0"
                  >
                    + Buat Dompet
                  </button>
                )}
              </div>
            ) : (
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-medium"
              >
                {wallets.map((w) => {
                  const isCC = w.type === "Credit Card" || w.type === "Kartu Kredit";
                  return (
                    <option key={w.id} value={w.id}>
                      {isCC ? "💳 " : ""}{w.name} ({w.type}) — {isCC ? "Sisa Limit" : "Saldo Kas"}: Rp {(w.balance || 0).toLocaleString("id-ID")} {w.account_number ? `· ${w.account_number}` : ""}
                    </option>
                  );
                })}
              </select>
            )}

            {/* Rekomendasi / Pilihan Otomatis Jika Saldo Dompet Terpilih Kurang */}
            {isOverBalance && capableWallets.length > 0 && (
              <div className="mt-2 p-2.5 rounded-lg bg-secondary/15 border border-secondary/40 flex items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-on-surface flex-1">
                  <span className="material-symbols-outlined text-secondary text-[18px] shrink-0">swap_horiz</span>
                  <div className="text-[11px] leading-tight">
                    <span className="block font-bold text-secondary">Saldo di {selectedWallet?.name} Kurang!</span>
                    Tersedia saldo di <strong>{capableWallets[0].name}</strong> (Rp {(capableWallets[0].balance || 0).toLocaleString("id-ID")}).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWalletId(String(capableWallets[0].id))}
                  className="bg-secondary text-on-secondary px-2.5 py-1.5 rounded-md text-[10px] font-bold shrink-0 hover:bg-secondary-fixed transition-colors shadow-sm"
                >
                  Pilih {capableWallets[0].name}
                </button>
              </div>
            )}

            {/* Info Peringatan Jika Semua Dompet Kurang */}
            {isOverBalance && allWalletsInsufficient && (
              <div className="mt-2 p-2.5 rounded-lg bg-error-container/25 border border-error/40 flex items-start gap-2.5 text-error text-xs animate-in fade-in duration-150">
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                <div className="text-[11px] leading-tight flex-1">
                  <strong className="block font-bold mb-0.5">Saldo Tidak Mencukupi di Seluruh Rekening!</strong>
                  Harga barang (<strong>Rp {parsedAmount.toLocaleString("id-ID")}</strong>) melebihi saldo kas & limit di seluruh rekening Anda. Saldo tertinggi yang tersedia: <strong>Rp {(highestWallet?.balance || 0).toLocaleString("id-ID")}</strong> ({highestWallet?.name}).
                </div>
              </div>
            )}
          </div>

          {/* Khusus Pengeluaran Kartu Kredit: Tanggal Tagihan & Info Limit */}
          {type === "expense" && isCreditCard && (
            <div className="bg-gradient-to-br from-surface-container-low to-secondary/10 p-3 rounded-xl border border-secondary/35 flex flex-col gap-2.5 animate-in fade-in duration-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-secondary font-bold">
                  <span className="material-symbols-outlined text-[17px]">credit_card</span>
                  <span>Transaksi Kartu Kredit / PayLater</span>
                </div>
                <span className="text-[10px] bg-secondary/20 text-secondary px-2 py-0.5 rounded-full font-bold">
                  Sisa Limit: Rp {(selectedWallet?.balance || 0).toLocaleString("id-ID")}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-secondary uppercase mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">event</span>
                  <span>Tanggal Tagihan / Jatuh Tempo (Billing Date) *</span>
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-surface-container rounded-lg px-3 py-2 text-on-surface border border-secondary/40 focus:outline-none focus:border-secondary font-bold text-xs"
                />
                <p className="text-[10px] text-outline mt-1">
                  Tanggal tagihan ini akan otomatis dicatat ke transaksi dan dipantau di Buku Utang & Piutang.
                </p>
              </div>

              {parseFloat(amount) > (selectedWallet?.balance || 0) && (
                <div className="flex items-center gap-1.5 text-error text-[11px] font-bold bg-error-container/20 p-2 rounded-lg border border-error/30">
                  <span className="material-symbols-outlined text-[15px]">warning</span>
                  <span>Peringatan: Nominal transaksi melebihi sisa limit kartu kredit yang tersedia!</span>
                </div>
              )}
            </div>
          )}

          {/* Khusus Pemasukan / Refund Kartu Kredit: Pilih Transaksi yang Dibatalkan */}
          {type === "income" && isCreditCard && (
            <div className="bg-gradient-to-br from-surface-container-low to-primary/10 p-3.5 rounded-xl border border-primary/35 flex flex-col gap-2.5 animate-in fade-in duration-200 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-primary font-bold">
                  <span className="material-symbols-outlined text-[18px]">replay</span>
                  <span>Pilih Transaksi yang Dibatalkan (Cancel / Refund)</span>
                </div>
                {creditCardExpenses.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={handleSelectAllExpenses}
                      className="text-primary hover:underline font-bold px-2 py-0.5 rounded bg-primary/15 transition-colors"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllExpenses}
                      className="text-outline hover:underline font-medium px-2 py-0.5 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-outline leading-tight">
                Pilih satu atau lebih transaksi kartu kredit yang dibatalkan. <strong>Nominal total akan otomatis menyesuaikan</strong> dan sisa limit kartu kredit Anda akan dipulihkan.
              </p>

              {loadingCCExpenses ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-outline bg-surface-container rounded-lg">
                  <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                  <span>Memuat riwayat transaksi kartu kredit...</span>
                </div>
              ) : creditCardExpenses.length === 0 ? (
                <div className="p-3 bg-surface-container rounded-lg text-center text-outline text-[11px]">
                  Belum ada riwayat transaksi pengeluaran pada kartu kredit ini untuk dibatalkan. Anda dapat menginputkan nominal pengembalian secara manual di bawah.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {creditCardExpenses.map((tx) => {
                    const isChecked = selectedExpenseIds.includes(tx.id);
                    const isAlreadyCancelled = tx.notes && tx.notes.includes("[DIBATALKAN");

                    return (
                      <label
                        key={tx.id}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-primary/15 border-primary text-on-surface shadow-xs font-semibold"
                            : "bg-surface-container border-outline-variant/20 hover:border-outline-variant/50 text-on-surface-variant"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleExpense(tx)}
                          className="w-4 h-4 mt-0.5 rounded border-outline-variant/40 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="font-bold text-on-surface truncate">
                              {tx.merchant || tx.category}
                            </span>
                            <span className="font-extrabold text-primary">
                              Rp {(tx.amount || 0).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-outline mt-0.5 flex-wrap">
                            <span>{tx.transaction_date}</span>
                            <span>•</span>
                            <span className="truncate">{tx.category}</span>
                            {isAlreadyCancelled && (
                              <span className="bg-error-container text-on-error-container px-1 rounded text-[9px] font-bold">
                                Pernah Dibatalkan
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {selectedExpenseIds.length > 0 && (
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-primary/25 text-primary font-bold">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    <span>{selectedExpenseIds.length} Transaksi Terpilih:</span>
                  </span>
                  <span className="text-sm font-extrabold">
                    Rp {creditCardExpenses
                      .filter((tx) => selectedExpenseIds.includes(tx.id))
                      .reduce((sum, tx) => sum + (tx.amount || 0), 0)
                      .toLocaleString("id-ID")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Nominal & Kategori Pos - Grid Sejajar Row-by-Row */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 items-end">
            <div className="min-h-[28px] flex items-end justify-between">
              <label className="text-[11px] font-bold text-outline uppercase truncate leading-tight">
                {isFromRadar ? "Nominal Beli (Rp)" : "Nominal (Rp)"}
              </label>
              {selectedWallet && (
                <span className={`text-[10px] font-semibold shrink-0 ml-1 ${isOverBalance ? "text-error font-bold" : "text-on-surface-variant"}`}>
                  Sisa: {availableBalance >= 1000000 ? `${(availableBalance / 1000000).toFixed(1)}jt` : `Rp ${availableBalance.toLocaleString("id-ID")}`}
                </span>
              )}
            </div>
            <div className="min-h-[28px] flex items-end">
              <label className="text-[11px] font-bold text-outline uppercase leading-tight">
                Kategori Pos ({type === "expense" ? "Pengeluaran" : "Pemasukan"})
              </label>
            </div>

            <div>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={`w-full h-10 bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border focus:outline-none font-bold text-sm transition-colors ${
                  isOverBalance
                    ? "border-error text-error focus:border-error bg-error-container/10"
                    : "border-outline-variant/20 focus:border-primary"
                }`}
              />
            </div>
            <div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-medium"
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Info Radar jika dari radar */}
          {isFromRadar && (radarProduct?.current_price || initialData?.amount) && (
            <div className="flex items-center justify-between text-[10px] -mt-1 px-1">
              <span className="text-outline">Harga Radar: Rp {Number(radarProduct?.current_price || initialData?.amount).toLocaleString("id-ID")}</span>
              {amount !== String(radarProduct?.current_price || initialData?.amount) && (
                <button
                  type="button"
                  onClick={() => setAmount(String(radarProduct?.current_price || initialData?.amount))}
                  className="text-primary hover:underline font-bold"
                >
                  Reset ke Harga Produk
                </button>
              )}
            </div>
          )}

          {/* Peringatan Nominal Melebihi Saldo yang Tersedia */}
          {isOverBalance && (
            <div className="p-2.5 rounded-lg bg-error-container/20 border border-error/50 flex items-start gap-2.5 text-error animate-in fade-in duration-150">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5 text-error">warning</span>
              <div className="text-[11px] leading-tight flex-1">
                <span className="block font-bold mb-0.5">Nominal Melebihi Batas Saldo yang Tersedia!</span>
                Nominal pengeluaran (<strong>Rp {parsedAmount.toLocaleString("id-ID")}</strong>) melebihi{" "}
                {isCreditCard ? "sisa limit kartu kredit" : "saldo kas"} yang tersedia di{" "}
                <strong>{selectedWallet?.name}</strong> (tersedia:{" "}
                <strong>Rp {availableBalance.toLocaleString("id-ID")}</strong>). Transaksi tidak dapat disimpan.
              </div>
            </div>
          )}

          {/* Dynamic Input Text & Save Option for "Lain-lain" */}
          {category === "Lain-lain" && (
            <div className="bg-surface-container-low/90 p-3 rounded-xl border border-primary/40 flex flex-col gap-2.5 animate-in fade-in duration-200 shadow-inner">
              <div>
                <label className="block text-[11px] font-bold text-primary uppercase mb-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">edit_note</span>
                  Nama Kategori Baru ({type === "expense" ? "Pengeluaran" : "Pemasukan"})
                </label>
                <input
                  type="text"
                  required
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder={
                    type === "expense"
                      ? "Contoh: Servis Motor, Kado Pernikahan..."
                      : "Contoh: Freelance Desain, Uang Saku..."
                  }
                  className="w-full bg-surface-container rounded-lg px-3 py-2 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary font-medium"
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer select-none text-xs text-on-surface-variant hover:text-on-surface pt-0.5">
                <input
                  type="checkbox"
                  checked={saveCategoryToDb}
                  onChange={(e) => setSaveCategoryToDb(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-outline-variant/40 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                />
                <span className="text-[11px] leading-tight">
                  Simpan kategori ke database agar tersimpan di dropdown ini tanpa menginputkan ulang ketika ada transaksi yang sama
                </span>
              </label>
            </div>
          )}

          {/* Toko / Sumber & Tanggal - Grid Sejajar Row-by-Row */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 items-end">
            <div className="min-h-[28px] flex items-end">
              <label className="text-[11px] font-bold text-outline uppercase leading-tight">
                {type === "income" ? "Sumber Dana / Pengirim" : "Nama Toko / Penerima"}
              </label>
            </div>
            <div className="min-h-[28px] flex items-end">
              <label className="text-[11px] font-bold text-outline uppercase leading-tight">Tanggal</label>
            </div>

            <div>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder={type === "income" ? "Misal: Setoran Tunai, Transfer Rekening" : "Misal: Superindo Merr"}
                className="w-full h-10 bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Catatan Tambahan (Opsional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={type === "income" ? "Contoh: Saldo awal rekening BCA" : "Contoh: Beli bumbu dapur mingguan"}
              className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Tombol Aksi */}
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
              disabled={loading || loadingWallets || wallets.length === 0 || isOverBalance || parsedAmount <= 0}
              className={`flex-1 py-2 rounded-lg text-xs font-bold shadow-md transition-all ${
                isOverBalance || parsedAmount <= 0
                  ? "bg-surface-container-highest text-outline cursor-not-allowed opacity-80 border border-outline-variant/30"
                  : "bg-primary-container text-on-primary-container hover:bg-primary disabled:opacity-50"
              }`}
            >
              {loading
                ? "Menyimpan..."
                : isOverBalance
                ? "⚠️ Saldo Tidak Mencukupi"
                : parsedAmount <= 0
                ? "Masukkan Nominal"
                : isFromRadar
                ? "✓ Catat Pembelian Radar"
                : type === "income"
                ? "+ Simpan Pemasukan (Isi Saldo)"
                : "- Catat Pengeluaran"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

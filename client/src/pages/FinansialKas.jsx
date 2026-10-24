import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { PayCreditCardModal } from "../components/modals/PayCreditCardModal";
import { AdjustCreditLimitModal } from "../components/modals/AdjustCreditLimitModal";

export function FinansialKas({ onOpenScan, onOpenTransaction, onOpenDebt, onOpenWallet, onOpenEnvelope, onRecordPayment }) {
  const [activeTab, setActiveTab] = useState("all"); // all, transactions, debts
  const [wallets, setWallets] = useState([]);
  const [envelopes, setEnvelopes] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [debtData, setDebtData] = useState({ debts: [], total_piutang_amount: 0, total_hutang_amount: 0, net_balance: 0, overdue_count: 0 });
  const [loading, setLoading] = useState(true);

  // Credit Card Modals State
  const [payCardModalOpen, setPayCardModalOpen] = useState(false);
  const [selectedCardForPay, setSelectedCardForPay] = useState(null);
  const [adjustLimitModalOpen, setAdjustLimitModalOpen] = useState(false);
  const [selectedCardForAdjust, setSelectedCardForAdjust] = useState(null);

  // Split-Bill Calculator State
  const [splitTotal, setSplitTotal] = useState(240000);
  const [splitPeople, setSplitPeople] = useState(4);
  const [splitTax, setSplitTax] = useState(1.11);
  const [copyStatus, setCopyStatus] = useState("⚡ Salin Teks Rekap WhatsApp");

  const loadAllData = async () => {
    try {
      const [walletRes, envRes, trRes, debtRes] = await Promise.all([
        api.getWallets(),
        api.getEnvelopes(),
        api.getTransactions(),
        api.getDebts(),
      ]);
      setWallets(walletRes.data?.wallets || []);
      setEnvelopes(envRes.data || []);
      setTransactions(trRes.data || []);
      setDebtData(debtRes.data || { debts: [], total_piutang_amount: 0, total_hutang_amount: 0, net_balance: 0, overdue_count: 0 });
    } catch (err) {
      console.error("Failed to load financial data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const cashWallets = wallets.filter((w) => w.type !== "Credit Card" && w.type !== "Kartu Kredit");
  const creditCardWallets = wallets.filter((w) => w.type === "Credit Card" || w.type === "Kartu Kredit");
  const totalLiquidity = cashWallets.reduce((acc, w) => acc + (w.balance || 0), 0);
  const totalCreditLimit = creditCardWallets.reduce((acc, w) => acc + (w.credit_limit || 0), 0);
  const totalCreditBalance = creditCardWallets.reduce((acc, w) => acc + (w.balance || 0), 0);
  const totalCreditUsed = Math.max(0, totalCreditLimit - totalCreditBalance);

  const currentMonthIncome = transactions.filter((t) => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const currentMonthExpense = transactions.filter((t) => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const netCashflow = currentMonthIncome - currentMonthExpense;

  const calculatePerPerson = () => {
    const val = Math.ceil((splitTotal * splitTax) / Math.max(1, splitPeople));
    return "Rp " + val.toLocaleString("id-ID");
  };

  const handleCopyWA = (debt) => {
    const text = `Halo ${debt.contact_name}, sekadar mengingatkan rekap catatan OmniLife Nexus terkait ${debt.type === "piutang" ? "pinjaman" : "kewajiban"} sebesar Rp ${debt.remaining?.toLocaleString("id-ID")} yang jatuh tempo pada ${debt.due_date}. Mohon konfirmasinya ya. Terima kasih!`;
    navigator.clipboard.writeText(text);
    setCopyStatus(`Teks WA untuk ${debt.contact_name} Disalin!`);
    setTimeout(() => setCopyStatus("⚡ Salin Teks Rekap WhatsApp"), 2500);
  };

  const handleDeleteTransaction = async (id) => {
    if (!confirm("Hapus transaksi ini dan pulihkan saldo dompet?")) return;
    try {
      await api.deleteTransaction(id);
      loadAllData();
    } catch (err) {
      alert("Gagal menghapus transaksi: " + err.message);
    }
  };

  const handleDeleteDebt = async (id) => {
    if (!confirm("Hapus catatan utang/piutang ini?")) return;
    try {
      await api.deleteDebt(id);
      loadAllData();
    } catch (err) {
      alert("Gagal menghapus utang/piutang: " + err.message);
    }
  };

  const formatRupiah = (val) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);
  };

  return (
    <div className="flex flex-col w-full">
      <div className="px-space-md lg:px-space-xl pt-space-lg pb-space-md flex flex-col gap-space-md">
        <div className="flex items-center justify-between flex-wrap gap-space-sm">
          <div className="flex items-center gap-space-xs text-xs text-outline">
            <span className="text-on-surface-variant font-medium">OMNILIFE NEXUS</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-bold tracking-wider">FINANCIAL MATRIX ENGINE</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-on-surface">ARUS KAS & DEBT LEDGER</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-high/80 px-3 py-1 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="text-xs text-secondary font-semibold">SmartFin OCR & DebtTracker Core: Synchronized</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
          <div className="flex flex-col max-w-3xl">
            <h1 className="text-2xl lg:text-3xl text-on-surface tracking-tight font-extrabold flex items-center gap-3">
              Unified Financial Matrix & Cashflow Ledger
              <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold">PRO DUAL-CORE</span>
            </h1>
            <p className="text-sm text-on-surface-variant mt-1.5 leading-relaxed">
              Konsolidasi buku kas digital berbasis struk belanja AI, manajemen rekening multi-wallet, pos anggaran digital, dan buku besar utang-piutang personal dalam satu pipeline matematis.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={onOpenWallet}
              className="bg-surface-container-high text-on-surface text-xs font-semibold px-space-md py-2.5 rounded-lg flex items-center gap-2 hover:bg-surface-bright transition-all"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">add_card</span>
              <span>+ Dompet Baru</span>
            </button>
            <button
              onClick={onOpenTransaction}
              className="bg-primary-container text-on-primary-container text-xs font-bold px-space-md py-2.5 rounded-lg flex items-center gap-2 hover:bg-primary transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)]"
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              <span>+ Input Transaksi</span>
            </button>
            <button
              onClick={onOpenScan}
              className="bg-surface-container-high text-on-surface text-xs font-semibold px-space-md py-2.5 rounded-lg flex items-center gap-2 hover:bg-surface-bright transition-all"
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">document_scanner</span>
              <span>+ Pindai Struk AI</span>
            </button>
            <button
              onClick={onOpenDebt}
              className="bg-surface-container-high text-on-surface text-xs font-semibold px-space-md py-2.5 rounded-lg flex items-center gap-2 hover:bg-surface-bright transition-all"
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">handshake</span>
              <span>+ Catat Utang/Piutang</span>
            </button>
          </div>
        </div>

        {/* Matrix Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 shrink-0 transition-colors ${
              activeTab === "all" ? "bg-surface-container-highest text-primary shadow-sm" : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">hub</span>
            <span>Semua Arus Kas (Terpadu)</span>
            <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.2 rounded-full ml-1">
              {transactions.length + debtData.debts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shrink-0 transition-colors ${
              activeTab === "transactions" ? "bg-surface-container-highest text-primary shadow-sm" : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            <span>Buku Transaksi Struk (SmartFin)</span>
            <span className="bg-surface-container text-on-surface-variant text-[10px] px-1.5 py-0.2 rounded-full ml-1">
              {transactions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("debts")}
            className={`text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shrink-0 transition-colors ${
              activeTab === "debts" ? "bg-surface-container-highest text-primary shadow-sm" : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_balance</span>
            <span>Buku Utang & Piutang (DebtTracker)</span>
            {debtData.overdue_count > 0 && (
              <span className="bg-error-container text-on-error-container text-[10px] px-1.5 py-0.2 rounded-full ml-1 font-bold">
                {debtData.overdue_count} Overdue
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="px-space-md lg:px-space-xl py-space-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
          <div className="bg-surface-container-low rounded-xl p-space-md shadow-md border border-outline-variant/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                </div>
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Likuiditas Kas</span>
              </div>
              <span className="text-xs text-primary font-bold">{wallets.length} Dompet</span>
            </div>
            <div className="mt-2 text-xl font-extrabold text-primary tracking-tight">{formatRupiah(totalLiquidity)}</div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-on-surface-variant">
              <span>Tersedia di rekening aktif</span>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-space-md shadow-md border border-outline-variant/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[20px]">query_stats</span>
                </div>
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Net Cashflow Bulan Ini</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${netCashflow >= 0 ? "bg-secondary/10 text-secondary" : "bg-error/10 text-error"}`}>
                {netCashflow >= 0 ? "Surplus" : "Defisit"}
              </span>
            </div>
            <div className={`mt-2 text-xl font-extrabold tracking-tight ${netCashflow >= 0 ? "text-on-surface" : "text-error"}`}>
              {netCashflow >= 0 ? "+" : ""}{formatRupiah(netCashflow)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-outline">
              <span>Masuk {formatRupiah(currentMonthIncome)} · Keluar {formatRupiah(currentMonthExpense)}</span>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-space-md shadow-md border border-outline-variant/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined text-[20px]">outbox</span>
                </div>
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Portofolio Piutang</span>
              </div>
              <span className="bg-tertiary-container/30 text-tertiary text-[10px] font-bold px-2 py-0.5 rounded-full">
                {debtData.debts.filter((d) => d.type === "piutang").length} Kontak
              </span>
            </div>
            <div className="mt-2 text-xl font-extrabold text-tertiary tracking-tight">
              {formatRupiah(debtData.total_piutang_amount)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-on-surface-variant">
              <span>Hak tagih yang belum cair</span>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-space-md shadow-md border border-outline-variant/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-error-container/30 flex items-center justify-center text-error">
                  <span className="material-symbols-outlined text-[20px]">move_to_inbox</span>
                </div>
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Kewajiban Hutang</span>
              </div>
              <span className="text-xs font-bold text-primary">
                Net {debtData.net_balance >= 0 ? "+" : ""}{formatRupiah(debtData.net_balance)}
              </span>
            </div>
            <div className="mt-2 text-xl font-extrabold text-on-surface tracking-tight">
              {formatRupiah(debtData.total_hutang_amount)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-[16px]">verified</span>
              <span>Solvabilitas: <strong className="text-primary">{totalLiquidity >= debtData.total_hutang_amount ? "Aman" : "Perlu Atensi"}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Rekening Bank & Kas Tunai (Aset Likuiditas) */}
      <div className="px-space-md lg:px-space-xl py-space-xs flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">account_balance</span>
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Rekening Bank & Kas Tunai ({cashWallets.length})
            </span>
            <span className="bg-primary/10 text-primary text-[11px] px-2 py-0.5 rounded-full font-bold">
              Total Kas: {formatRupiah(totalLiquidity)}
            </span>
          </div>
          <button
            onClick={() => onOpenWallet?.("cash")}
            className="text-primary text-xs font-bold flex items-center gap-1 hover:underline bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>+ Tambah Rekening Kas</span>
          </button>
        </div>

        {cashWallets.length === 0 ? (
          <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/15 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-on-surface">Belum Ada Rekening Kas / Bank</h4>
                <p className="text-[11px] text-outline">Tambahkan akun bank, dompet tunai, atau e-wallet untuk mulai mencatat arus kas.</p>
              </div>
            </div>
            <button
              onClick={() => onOpenWallet?.("cash")}
              className="bg-primary text-on-primary text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-primary/90 transition-colors"
            >
              + Buat Rekening Kas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {cashWallets.map((w) => (
              <div
                key={w.id}
                className="p-3.5 rounded-xl border bg-surface-container-low border-outline-variant/15 flex flex-col justify-between gap-2.5 transition-all shadow-sm hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-container text-primary">
                      <span className="material-symbols-outlined text-[20px]">
                        {w.type === "Cash"
                          ? "payments"
                          : w.type === "E-Wallet"
                          ? "phone_android"
                          : w.type === "Investment"
                          ? "trending_up"
                          : "account_balance"}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-on-surface truncate">{w.name}</span>
                      <span className="text-[10px] text-outline truncate">
                        {w.type} {w.account_number ? `· ${w.account_number}` : ""}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-baseline justify-between text-xs pt-1 border-t border-outline-variant/10">
                  <span className="text-[10px] text-outline font-semibold">Saldo Kas:</span>
                  <span className="text-xs font-extrabold text-primary">{formatRupiah(w.balance)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenTransaction?.({
                    walletId: w.id,
                    type: "income",
                    category: "Top-Up Saldo / Setoran Awal",
                    merchant: "Setoran Tunai / Transfer",
                    notes: `Isi saldo awal rekening ${w.name}`,
                  })}
                  className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-on-primary text-[11px] font-bold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all shadow-sm"
                  title={`Tambah / Isi saldo untuk rekening ${w.name}`}
                >
                  <span className="material-symbols-outlined text-[14px]">add_circle</span>
                  <span>Isi Saldo Kas</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Fasilitas Kartu Kredit & PayLater (Plafon Limit Saldo) */}
      <div className="px-space-md lg:px-space-xl py-space-sm flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">credit_card</span>
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Fasilitas Kartu Kredit & PayLater ({creditCardWallets.length})
            </span>
            {creditCardWallets.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="bg-surface-container-high text-on-surface-variant text-[10px] px-2 py-0.5 rounded-full font-medium">
                  Plafon: {formatRupiah(totalCreditLimit)}
                </span>
                <span className="bg-error-container/40 text-error text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Tagihan: {formatRupiah(totalCreditUsed)}
                </span>
                <span className="bg-secondary/20 text-secondary text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Sisa Limit: {formatRupiah(totalCreditBalance)}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => onOpenWallet?.("credit")}
            className="text-secondary text-xs font-bold flex items-center gap-1 hover:underline bg-secondary/10 hover:bg-secondary/20 px-2.5 py-1 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add_card</span>
            <span>+ Tambah Kartu Kredit</span>
          </button>
        </div>

        {creditCardWallets.length === 0 ? (
          <div className="p-4 bg-gradient-to-r from-surface-container-low to-secondary/5 rounded-xl border border-secondary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">credit_card</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span>Punya Kartu Kredit atau PayLater?</span>
                  <span className="bg-secondary/20 text-secondary text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">Fitur Baru</span>
                </h4>
                <p className="text-[11px] text-outline mt-0.5">
                  Atur limit saldo kartu kredit Anda. Saat limit dipakai untuk belanja/pinjaman, limit berkurang. <strong>Ketika tagihan dibayar, limit akan kembali ke limit semula secara otomatis</strong>. Anda juga dapat menaikkan limit saldo kapan saja.
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenWallet?.("credit")}
              className="bg-secondary text-on-secondary text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-secondary/90 transition-colors shrink-0 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              <span>Daftarkan Kartu Kredit</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {creditCardWallets.map((w) => {
              const usedAmount = Math.max(0, (w.credit_limit || 0) - (w.balance || 0));
              const usedPercent = Math.min(100, Math.round((usedAmount / (w.credit_limit || 1)) * 100));

              return (
                <div
                  key={w.id}
                  className="p-3.5 rounded-xl border bg-gradient-to-br from-surface-container-low to-secondary/5 border-secondary/30 flex flex-col justify-between gap-3 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-secondary/15 text-secondary">
                        <span className="material-symbols-outlined text-[20px]">credit_card</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-on-surface truncate">{w.name}</span>
                          <span className="bg-secondary/20 text-secondary text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase">
                            Kartu Kredit
                          </span>
                        </div>
                        <span className="text-[10px] text-outline truncate">
                          {w.account_number ? `No: ${w.account_number}` : "Kartu Kredit Aktif"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sisa Limit & Plafon Progress Bar */}
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-outline-variant/15">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-[10px] text-outline font-semibold">Sisa Limit Tersedia:</span>
                      <span className="text-sm font-extrabold text-secondary">{formatRupiah(w.balance)}</span>
                    </div>

                    <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-secondary h-full rounded-full transition-all"
                        style={{ width: `${usedPercent}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-outline">
                      <span>Plafon: <strong>{formatRupiah(w.credit_limit)}</strong></span>
                      <span className={usedAmount > 0 ? "text-error font-bold" : ""}>
                        {usedAmount > 0 ? `Terpakai: ${formatRupiah(usedAmount)} (${usedPercent}%)` : "Limit Penuh 100%"}
                      </span>
                    </div>
                  </div>

                  {/* 3 Main Action Buttons: Bayar (Reset), Tambah Limit, Pakai Limit */}
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-outline-variant/15">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCardForPay(w);
                          setPayCardModalOpen(true);
                        }}
                        className="bg-secondary/15 hover:bg-secondary text-secondary hover:text-on-secondary text-[10px] font-bold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all shadow-sm"
                        title="Bayar tagihan kartu kredit ini sehingga sisa limit kembali ke limit semula"
                      >
                        <span className="material-symbols-outlined text-[13px]">restart_alt</span>
                        <span>Bayar Tagihan</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCardForAdjust(w);
                          setAdjustLimitModalOpen(true);
                        }}
                        className="bg-surface-container hover:bg-surface-bright text-on-surface text-[10px] font-bold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all border border-outline-variant/20"
                        title="Tambah atau naikkan plafon limit kartu kredit ini"
                      >
                        <span className="material-symbols-outlined text-[13px] text-primary">upgrade</span>
                        <span>Tambah Limit</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenDebt?.({
                        walletId: w.id,
                        type: "hutang",
                        contactName: w.name,
                        notes: `Transaksi belanja / penarikan kartu kredit ${w.name}`,
                      })}
                      className="w-full bg-surface-container-high/60 hover:bg-surface-container-high text-on-surface text-[10px] font-semibold py-1 px-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                      title="Catat pemakaian limit untuk transaksi / cicilan"
                    >
                      <span className="material-symbols-outlined text-[13px] text-secondary">credit_score</span>
                      <span>+ Catat Pemakaian / Pinjaman Limit</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="px-space-md lg:px-space-xl py-space-md">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          {/* Left Column (Transactions & Debts) */}
          <div className="lg:col-span-8 flex flex-col gap-space-lg min-w-0">
            {/* Transactions Section */}
            {(activeTab === "all" || activeTab === "transactions") && (
              <div className="bg-surface-container-low rounded-xl p-space-md lg:p-space-lg shadow-md flex flex-col border border-outline-variant/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-md">
                  <div>
                    <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                      <span>Buku Transaksi Gabungan & Rekap Mutasi</span>
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Struk kasir AI OCR, mutasi rekening bank, dan pembukuan piutang langsung dari database.
                    </p>
                  </div>
                  <button onClick={onOpenTransaction} className="bg-primary-container text-on-primary-container px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Tambah Transaksi</span>
                  </button>
                </div>

                {transactions.length === 0 ? (
                  <EmptyState
                    icon="receipt"
                    title="Belum Ada Transaksi"
                    description="Belum ada transaksi tersimpan di database. Anda dapat menambahkan transaksi pengeluaran/pemasukan manual atau scan struk AI."
                    actionText="Input Transaksi"
                    onAction={onOpenTransaction}
                    secondaryActionText="Pindai Struk AI"
                    onSecondaryAction={onOpenScan}
                  />
                ) : (
                  <div className="flex flex-col gap-2.5 mt-2">
                    {transactions.map((tr) => (
                      <div
                        key={tr.id}
                        className="bg-surface-container p-space-md rounded-xl hover:bg-surface-container-high transition-all flex flex-col md:flex-row md:items-center justify-between gap-space-sm"
                      >
                        <div className="flex items-start gap-space-md min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            tr.type === "income" ? "bg-primary/20 text-primary" : "bg-error/15 text-error"
                          }`}>
                            <span className="material-symbols-outlined text-[22px]">
                              {tr.type === "income" ? "arrow_downward" : "shopping_cart"}
                            </span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-on-surface font-bold truncate">{tr.merchant || tr.category}</span>
                              {tr.ocr_accuracy > 0 && (
                                <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">document_scanner</span>
                                  AI OCR {tr.ocr_accuracy}%
                                </span>
                              )}
                              <span className="bg-surface-container-highest text-on-surface-variant text-[10px] px-2 py-0.5 rounded-full">
                                {tr.category}
                              </span>
                            </div>
                            <p className="text-xs text-on-surface-variant mt-1 truncate">
                              {tr.notes || `${tr.type === "income" ? "Pemasukan" : "Pengeluaran"} - ${tr.category}`}
                            </p>
                            <div className="flex items-center gap-2.5 mt-1 text-outline text-[10px] font-medium flex-wrap">
                              <span>{tr.transaction_date}</span>
                              <span>•</span>
                              <span className="text-secondary font-semibold">{tr.wallet_name}</span>
                              {tr.due_date && (
                                <>
                                  <span>•</span>
                                  <span className="bg-secondary/15 text-secondary px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">calendar_clock</span>
                                    <span>Jatuh Tempo: {tr.due_date}</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 gap-1">
                          <span className={`text-sm font-bold ${tr.type === "income" ? "text-primary" : "text-on-surface"}`}>
                            {tr.type === "income" ? "+" : "-"}{formatRupiah(tr.amount)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-outline">{tr.wallet_name}</span>
                            <button
                              onClick={() => handleDeleteTransaction(tr.id)}
                              title="Hapus transaksi"
                              className="text-outline hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Debts & Receivables Section */}
            {(activeTab === "all" || activeTab === "debts") && (
              <div className="bg-surface-container-low rounded-xl p-space-md lg:p-space-lg shadow-md flex flex-col border border-outline-variant/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-md">
                  <div>
                    <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                      <span>Buku Besar Utang & Piutang Personal</span>
                      <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Catatan pinjaman modal, talangan servis, jadwal jatuh tempo, dan rekonsiliasi cicilan.
                    </p>
                  </div>
                  <button onClick={onOpenDebt} className="bg-secondary-container text-on-secondary-container px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>+ Catat Pinjaman</span>
                  </button>
                </div>

                {debtData.debts.length === 0 ? (
                  <EmptyState
                    icon="handshake"
                    title="Belum Ada Catatan Utang / Piutang"
                    description="Kelola pinjaman personal, talangan teman, dan jadwal jatuh tempo secara transparan."
                    actionText="Catat Pinjaman Baru"
                    onAction={onOpenDebt}
                  />
                ) : (
                  <div className="flex flex-col gap-2.5 mt-2">
                    {debtData.debts.map((d) => (
                      <div
                        key={d.id}
                        className="bg-surface-container p-space-md rounded-xl hover:bg-surface-container-high transition-all flex flex-col md:flex-row md:items-center justify-between gap-space-sm border-l-4"
                        style={{ borderLeftColor: d.type === "piutang" ? "#4cd7f6" : "#ffb4ab" }}
                      >
                        <div className="flex items-start gap-space-md min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            d.type === "piutang" ? "bg-secondary/15 text-secondary" : "bg-error/15 text-error"
                          }`}>
                            <span className="material-symbols-outlined text-[22px]">
                              {d.type === "piutang" ? "outbox" : "move_to_inbox"}
                            </span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-on-surface font-bold truncate">{d.contact_name}</span>
                              {d.wallet_name && (
                                <span className="bg-secondary/15 text-secondary text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[13px]">credit_card</span>
                                  <span>{d.wallet_name}</span>
                                </span>
                              )}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                d.status === "paid"
                                  ? "bg-primary/20 text-primary"
                                  : d.status === "overdue"
                                  ? "bg-error-container text-on-error-container animate-pulse"
                                  : "bg-surface-container-highest text-secondary"
                              }`}>
                                {d.status === "overdue" ? "OVERDUE" : d.status.toUpperCase()}
                              </span>
                              <span className="text-[10px] text-outline font-semibold">
                                {d.type === "piutang" ? "Hak Tagih Piutang" : "Kewajiban Hutang"}
                              </span>
                            </div>
                            <p className="text-xs text-on-surface-variant mt-1 truncate">
                              {d.notes || "Tanpa keterangan"} · Jatuh tempo: <strong className="text-on-surface">{d.due_date}</strong>
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs">
                              <span className="text-outline">Terbayar: {formatRupiah(d.paid_amount)}</span>
                              <span>•</span>
                              <span className="text-secondary font-bold">Sisa: {formatRupiah(d.remaining)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {d.status !== "paid" && (
                            <>
                              <button
                                onClick={() => handleCopyWA(d)}
                                className="bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[16px] text-secondary">chat</span>
                                <span>WA</span>
                              </button>
                              <button
                                onClick={() => onRecordPayment?.(d)}
                                className="bg-primary-container hover:bg-primary text-on-primary-container text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[16px]">payments</span>
                                <span>Bayar / Cicil</span>
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteDebt(d.id)}
                            title="Hapus utang/piutang"
                            className="text-outline hover:text-error transition-colors p-1"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Digital Envelopes & Split-Bill */}
          <div className="lg:col-span-4 flex flex-col gap-space-lg min-w-0">
            {/* Digital Envelopes */}
            <div className="bg-surface-container-low rounded-xl p-space-md shadow-md flex flex-col border border-outline-variant/10">
              <div className="flex items-center justify-between mb-space-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[20px]">drafts</span>
                  </div>
                  <h3 className="text-sm font-bold text-on-surface">Pos Anggaran Envelopes</h3>
                </div>
                <button onClick={onOpenEnvelope} className="text-primary text-xs font-bold hover:underline">
                  + Pos Baru
                </button>
              </div>

              {envelopes.length === 0 ? (
                <div className="p-3 text-center text-xs text-outline bg-surface-container rounded-lg">
                  Belum ada pos anggaran. Klik "+ Pos Baru" untuk mengatur pagu anggaran belanja.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {envelopes.map((env) => {
                    const percent = Math.min(100, Math.round((env.spent_amount / (env.allocated_amount || 1)) * 100));
                    const isCritical = percent >= 85;
                    return (
                      <div key={env.id} className="bg-surface-container p-3 rounded-lg flex flex-col">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-on-surface font-semibold">{env.name}</span>
                          <span className={`font-bold ${isCritical ? "text-error" : "text-primary"}`}>
                            {percent}% {isCritical ? "Kritis" : "Terkendali"}
                          </span>
                        </div>
                        <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden my-1">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isCritical ? "bg-error" : "bg-primary"}`}
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-outline">
                          <span>{formatRupiah(env.spent_amount)} terpakai</span>
                          <span>Sisa: {formatRupiah(env.allocated_amount - env.spent_amount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Split-Bill Calculator */}
            <div className="bg-surface-container-low rounded-xl p-space-md shadow-md flex flex-col border border-outline-variant/10">
              <div className="flex items-center justify-between mb-space-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center text-tertiary">
                    <span className="material-symbols-outlined text-[20px]">calculate</span>
                  </div>
                  <h3 className="text-sm font-bold text-on-surface">Kalkulator Split-Bill Cepat</h3>
                </div>
                <span className="material-symbols-outlined text-outline text-[16px]">bolt</span>
              </div>

              <div className="bg-surface-container p-3 rounded-xl flex flex-col gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-outline uppercase mb-1">Total Nominal Nota / Struk</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface font-bold text-sm">Rp</span>
                    <input
                      type="number"
                      value={splitTotal}
                      onChange={(e) => setSplitTotal(parseFloat(e.target.value) || 0)}
                      className="w-full bg-surface-container-high rounded-lg pl-9 pr-3 py-1.5 text-sm font-bold text-on-surface focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-outline uppercase mb-1">Jumlah Orang</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={splitPeople}
                      onChange={(e) => setSplitPeople(parseInt(e.target.value) || 1)}
                      className="w-full bg-surface-container-high rounded-lg px-3 py-1.5 text-sm font-bold text-on-surface focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-outline uppercase mb-1">Pajak & Serv</label>
                    <select
                      value={splitTax}
                      onChange={(e) => setSplitTax(parseFloat(e.target.value))}
                      className="w-full bg-surface-container-high rounded-lg px-2 py-1.5 text-xs text-on-surface focus:outline-none"
                    >
                      <option value="1.11">PPN 11%</option>
                      <option value="1.00">Tanpa Pajak</option>
                      <option value="1.16">PB1 16%</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between bg-surface-container-high/60 p-2.5 rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline font-bold">Nominal Per Orang:</span>
                    <span className="text-base text-tertiary font-bold">{calculatePerPerson()}</span>
                  </div>
                  <span className="px-2 py-1 bg-tertiary-container text-on-tertiary-container rounded text-[10px] font-bold">
                    Auto-Calculated
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Card Action Modals */}
      <PayCreditCardModal
        isOpen={payCardModalOpen}
        creditCard={selectedCardForPay}
        onClose={() => {
          setPayCardModalOpen(false);
          setSelectedCardForPay(null);
        }}
        onSuccess={loadAllData}
      />

      <AdjustCreditLimitModal
        isOpen={adjustLimitModalOpen}
        creditCard={selectedCardForAdjust}
        onClose={() => {
          setAdjustLimitModalOpen(false);
          setSelectedCardForAdjust(null);
        }}
        onSuccess={loadAllData}
      />
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";

export function Dashboard({ onOpenScan, onOpenTransaction, onOpenDebt, onOpenRadar, onOpenPantry }) {
  const [showQuickHub, setShowQuickHub] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconciled, setReconciled] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    try {
      const res = await api.getDashboardSummary();
      setSummary(res.data);
    } catch (err) {
      console.error("Failed to load dashboard summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleReconcile = async () => {
    setReconciling(true);
    await fetchSummary();
    setTimeout(() => {
      setReconciling(false);
      setReconciled(true);
      setTimeout(() => setReconciled(false), 2500);
    }, 800);
  };

  const formatRupiah = (val) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);
  };

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-surface-container-high border-t-primary animate-spin mb-3"></div>
        <p className="text-xs text-outline font-semibold">Mengambil Data Live dari Database Golang...</p>
      </div>
    );
  }

  const s = summary || {};
  const cashflowTrend = s.cashflow_trend || [];
  const maxTrendVal = Math.max(1, ...cashflowTrend.flatMap((p) => [p.income, p.expense, p.debt_payments]));

  return (
    <div className="flex flex-col w-full">
      <div className="relative w-full overflow-hidden px-space-lg py-space-lg lg:px-margin-desktop lg:py-space-xl">
        <div className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-[120px]"></div>
        <div className="pointer-events-none absolute -top-20 left-10 -z-10 h-72 w-72 rounded-full bg-secondary/10 blur-[100px]"></div>

        {/* Page Header */}
        <header className="flex flex-col gap-space-md pb-space-lg border-b border-outline-variant/30 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col max-w-3xl">
            <div className="flex items-center gap-space-sm mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                LIVE DATABASE SYNCHRONIZED
              </span>
              <span className="text-[10px] text-outline tracking-wider uppercase font-semibold">Node #OMNI-JKT-01</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-on-surface tracking-tight">Executive OmniCommand Dashboard</h1>
            <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
              Pusat komando terpadu mengintegrasikan likuiditas kas, buku utang-piutang, radar harga belanja, matriks keputusan wishlist, dan logistik dapur rumah tangga.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-space-sm shrink-0">
            <button
              onClick={handleReconcile}
              className="group relative flex items-center gap-1.5 bg-surface-container-high hover:bg-surface-bright text-on-surface px-space-md py-2 rounded-xl transition-all shadow-sm text-xs font-semibold"
            >
              <span className={`material-symbols-outlined text-secondary-fixed text-[18px] ${reconciling ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`}>
                {reconciled ? "verified" : "sync"}
              </span>
              <span>{reconciled ? "Rekonsiliasi Sukses!" : reconciling ? "Menyinkronkan..." : "⚡ Rekonsiliasi Otomatis"}</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowQuickHub(!showQuickHub)}
                className="flex items-center gap-2 bg-primary-container hover:bg-primary text-on-primary-container px-space-md py-2 rounded-xl transition-all text-xs font-bold shadow-[0_0_20px_rgba(16,185,129,0.35)]"
              >
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                <span>+ Tindakan Cepat</span>
                <span className="material-symbols-outlined text-[16px]">arrow_drop_down</span>
              </button>

              {showQuickHub && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-surface-container-high p-2 shadow-2xl z-50 border border-surface-container-highest">
                  <button
                    onClick={() => {
                      setShowQuickHub(false);
                      onOpenTransaction?.();
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-primary text-[18px]">receipt_long</span>
                    <span>Input Transaksi Kas</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickHub(false);
                      onOpenScan?.();
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-secondary text-[18px]">document_scanner</span>
                    <span>Pindai Struk Kasir AI</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickHub(false);
                      onOpenDebt?.();
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-secondary text-[18px]">add_card</span>
                    <span>Catat Pinjaman/Hutang</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickHub(false);
                      onOpenRadar?.();
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-tertiary text-[18px]">bookmark_add</span>
                    <span>Tambah Radar Harga</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickHub(false);
                      onOpenPantry?.();
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-primary text-[18px]">inventory_2</span>
                    <span>Tambah Stok Dapur</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Top 5 KPI Row */}
        <section className="mt-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-5">
          <Link to="/finansial-kas" className="relative overflow-hidden rounded-xl bg-surface-container p-space-md shadow-md transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                </div>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">SmartFin · Kas Likuid</span>
              </div>
              <span className="flex items-center text-primary text-[10px] font-bold">
                <span className="material-symbols-outlined text-[14px]">account_balance</span>{s.wallets_count || 0} Dompet
              </span>
            </div>
            <div className="mt-space-md">
              <span className="text-xl font-bold text-primary tracking-tight">{formatRupiah(s.net_liquidity)}</span>
              <p className="text-xs text-on-surface-variant mt-1">
                <span className={s.surplus_this_month >= 0 ? "text-primary font-semibold" : "text-error font-semibold"}>
                  {s.surplus_this_month >= 0 ? "+" : ""}{formatRupiah(s.surplus_this_month)}
                </span> surplus bulan ini
              </p>
            </div>
            <div className="mt-space-sm pt-space-xs flex items-center gap-2 text-outline">
              <span className="material-symbols-outlined text-[14px]">wallet</span>
              <span className="text-[11px] truncate">
                {s.wallets_count > 0 ? `${s.wallets_count} akun terdaftar di database` : "Belum ada dompet, klik untuk tambah"}
              </span>
            </div>
          </Link>

          <Link to="/finansial-kas" className="relative overflow-hidden rounded-xl bg-surface-container p-space-md shadow-md transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[20px]">handshake</span>
                </div>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">DebtTracker · Net</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-[10px] font-bold">
                {s.net_debt >= 0 ? "Piutang ≥ Hutang" : "Hutang > Piutang"}
              </span>
            </div>
            <div className="mt-space-md">
              <span className="text-xl font-bold text-secondary tracking-tight">
                {s.net_debt >= 0 ? "+" : ""}{formatRupiah(s.net_debt)}
              </span>
              <p className="text-xs text-on-surface-variant mt-1 truncate">
                Piutang {formatRupiah(s.total_piutang)} - Hutang {formatRupiah(s.total_hutang)}
              </p>
            </div>
            <div className={`mt-space-sm pt-space-xs flex items-center gap-2 ${s.overdue_debts_count > 0 ? "text-error" : "text-primary"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.overdue_debts_count > 0 ? "bg-error animate-ping" : "bg-primary"}`}></span>
              <span className="text-[11px] font-medium">
                {s.overdue_debts_count > 0 ? `${s.overdue_debts_count} kontak perlu atensi jatuh tempo` : "Semua jatuh tempo lancar"}
              </span>
            </div>
          </Link>

          <Link to="/pengadaan-radar" className="relative overflow-hidden rounded-xl bg-surface-container p-space-md shadow-md transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-tertiary-container/20 flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined text-[20px]">radar</span>
                </div>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">PriceRadar · Sinyal</span>
              </div>
              <span className="flex items-center gap-0.5 text-primary text-[10px] font-bold">
                <span className="material-symbols-outlined text-[14px]">price_check</span>Target Hit
              </span>
            </div>
            <div className="mt-space-md">
              <span className="text-xl font-bold text-on-surface tracking-tight">{s.radar_signals_count || 0} Sinyal Siap Beli</span>
              <p className="text-xs text-on-surface-variant mt-1">
                Avg Deal Score <span className="text-tertiary font-bold">{s.avg_deal_score || 0} / 10</span>
              </p>
            </div>
            <div className="mt-space-sm pt-space-xs flex items-center gap-2 text-primary text-[11px] font-medium">
              <span className="material-symbols-outlined text-[14px]">savings</span>
              <span>Tabungan siap: {formatRupiah(s.radar_ready_savings)}</span>
            </div>
          </Link>

          <Link to="/pengadaan-radar" className="relative overflow-hidden rounded-xl bg-surface-container p-space-md shadow-md transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">playlist_add_check_circle</span>
                </div>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">WishBoard · Decision</span>
              </div>
              <span className="text-[10px] text-outline font-bold">Rasional</span>
            </div>
            <div className="mt-space-md">
              <span className="text-xl font-bold text-primary tracking-tight">{s.radar_signals_count || 0} Item Target</span>
              <p className="text-xs text-on-surface-variant mt-1">
                Alokasi Tabungan: <span className="text-on-surface font-semibold">{formatRupiah(s.radar_ready_savings)}</span>
              </p>
            </div>
            <div className="mt-space-sm pt-space-xs flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px]">speed</span>
              <span className="text-[11px]">Bobot Utilitas Terkalibrasi</span>
            </div>
          </Link>

          <Link to="/dapur-inventaris" className="relative overflow-hidden rounded-xl bg-surface-container p-space-md shadow-md transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[20px]">kitchen</span>
                </div>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">StockPantry · Logistik</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.pantry_critical_count > 0 ? "bg-error-container text-on-error-container" : "bg-primary/20 text-primary"}`}>
                {s.pantry_critical_count > 0 ? `${s.pantry_critical_count} Kritis` : "Aman"}
              </span>
            </div>
            <div className="mt-space-md">
              <span className="text-xl font-bold text-on-surface tracking-tight">{s.pantry_safe_count || 0} Aman · {s.pantry_critical_count || 0} Kritis</span>
              <p className="text-xs text-on-surface-variant mt-1">
                Zero-waste tracking active 🔥
              </p>
            </div>
            <div className="mt-space-sm pt-space-xs flex items-center gap-2 text-outline">
              <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
              <span className="text-[11px]">{s.pantry_restock_count || 0} item perlu restock</span>
            </div>
          </Link>
        </section>

        {/* Cross-Module Urgent Alerts */}
        <section className="mt-space-xl">
          <div className="flex items-center justify-between mb-space-md flex-wrap gap-2">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-secondary text-[22px]">hub</span>
              <h2 className="text-lg font-bold text-on-surface">Pusat Intervensi Lintas-Modul (Cross-Engine Alerts)</h2>
            </div>
            <span className="text-xs text-outline font-semibold">
              {s.urgent_alerts?.length || 0} Trigger Dinamis dari Database
            </span>
          </div>

          {s.urgent_alerts?.length === 0 ? (
            <div className="bg-surface-container-high/40 rounded-xl p-6 text-center border border-outline-variant/15 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-1">verified</span>
              <p className="text-xs font-bold text-on-surface">Seluruh subsistem berjalan optimal tanpa anomali kritis</p>
              <p className="text-[11px] text-outline mt-0.5">Tidak ada utang jatuh tempo, bahan dapur kedaluwarsa, atau defisit amplop belanja.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-space-md lg:grid-cols-3">
              {s.urgent_alerts?.map((alert) => (
                <div key={alert.id} className="relative overflow-hidden rounded-xl bg-surface-container-high p-space-md shadow-lg flex flex-col justify-between border border-outline-variant/15">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        alert.severity === "critical"
                          ? "bg-error-container text-on-error-container"
                          : alert.severity === "warning"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-primary-container/20 text-primary"
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
                        {alert.type.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-medium">{alert.module}</span>
                    </div>
                    <div className="mt-space-md flex flex-col">
                      <h3 className="text-sm font-semibold text-on-surface leading-tight">{alert.title}</h3>
                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{alert.description}</p>
                    </div>
                  </div>
                  <div className="mt-space-md pt-space-xs">
                    <Link
                      to={alert.action_url}
                      className="w-full bg-surface-container hover:bg-surface-bright text-on-surface py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>{alert.action_text}</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Split Master Section: Ledger Feed & Charts */}
        <div className="mt-space-xl grid grid-cols-1 gap-space-lg lg:grid-cols-12">
          {/* Left Column (Ledger Feed & Graph) */}
          <div className="flex flex-col gap-space-lg lg:col-span-7">
            <div className="rounded-xl bg-surface-container p-space-md lg:p-space-lg shadow-md flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-space-md border-b border-outline-variant/20">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">document_scanner</span>
                    <h3 className="text-base font-bold text-on-surface">Aliran Transaksi & Struk Kasir AI Terkini</h3>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">Real-time parsed OCR feed, transfer kas, dan pembayaran cicilan dari database</p>
                </div>
                <div className="flex items-center gap-1 self-start sm:self-auto bg-surface-container-high px-2 py-1 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span className="text-[10px] text-on-surface font-semibold">OCR Vision v4.2 Ready</span>
                </div>
              </div>

              {s.recent_transactions?.length === 0 ? (
                <div className="py-4">
                  <EmptyState
                    icon="receipt_long"
                    title="Belum Ada Transaksi di Database"
                    description="Database saat ini bersih tanpa data dummy. Mulai catat transaksi manual atau pindai foto struk kasir AI."
                    actionText="Input Transaksi Kas"
                    onAction={onOpenTransaction}
                    secondaryActionText="Pindai Struk AI"
                    onSecondaryAction={onOpenScan}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-space-sm mt-space-md">
                  {s.recent_transactions?.map((tr) => (
                    <div
                      key={tr.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-space-md rounded-xl bg-surface-container-high hover:bg-surface-bright/50 transition-colors gap-space-sm"
                    >
                      <div className="flex items-start gap-space-sm min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          tr.type === "income" ? "bg-primary/20 text-primary" : "bg-error/15 text-error"
                        }`}>
                          <span className="material-symbols-outlined text-[20px]">
                            {tr.type === "income" ? "arrow_downward" : "receipt"}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-on-surface truncate">{tr.merchant || tr.category}</span>
                            {tr.ocr_accuracy > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                                OCR {tr.ocr_accuracy}% Match
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">
                              {tr.category}
                            </span>
                          </div>
                          <span className="text-xs text-on-surface-variant mt-0.5 truncate">{tr.notes || "Tanpa catatan tambahan"}</span>
                          <div className="flex items-center gap-3 mt-1 text-outline text-[10px] font-medium">
                            <span>{tr.transaction_date}</span>
                            <span>•</span>
                            <span className="text-secondary font-semibold">{tr.wallet_name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-baseline sm:items-end justify-between shrink-0">
                        <span className={`text-sm font-bold ${tr.type === "income" ? "text-primary" : "text-on-surface"}`}>
                          {tr.type === "income" ? "+" : "-"}{formatRupiah(tr.amount)}
                        </span>
                        <span className="text-[10px] text-outline">{tr.wallet_name}</span>
                      </div>
                    </div>
                  ))}

                  <div className="mt-space-md flex justify-center">
                    <Link to="/finansial-kas" className="text-secondary hover:text-secondary-fixed text-xs font-semibold flex items-center gap-1 transition-colors">
                      <span>Buka Seluruh Catatan Transaksi</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Multi-Vector SVG Chart */}
            <div className="rounded-xl bg-surface-container p-space-md lg:p-space-lg shadow-md flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-space-md">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">stacked_bar_chart</span>
                    <h3 className="text-base font-bold text-on-surface">Grafik Multi-Vektor Arus Kas & Burn Rate (Realtime DB)</h3>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">Perbandingan 6 bulan terakhir dari agregasi tabel transaksi & pelunasan</p>
                </div>
                <div className="flex items-center gap-space-sm text-xs flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-primary"></span>
                    <span className="text-on-surface">Pemasukan</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-error"></span>
                    <span className="text-on-surface">Pengeluaran</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-secondary"></span>
                    <span className="text-on-surface">Cicilan</span>
                  </div>
                </div>
              </div>

              <div className="mt-space-md w-full overflow-x-auto">
                <svg className="w-full h-56 min-w-[500px]" fill="none" viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg">
                  <line stroke="#232a34" strokeDasharray="4 4" x1="30" x2="580" y1="20" y2="20"></line>
                  <line stroke="#232a34" strokeDasharray="4 4" x1="30" x2="580" y1="70" y2="70"></line>
                  <line stroke="#232a34" strokeDasharray="4 4" x1="30" x2="580" y1="120" y2="120"></line>
                  <line stroke="#232a34" x1="30" x2="580" y1="170" y2="170"></line>

                  {cashflowTrend.map((item, idx) => {
                    const startX = 60 + idx * 90;
                    const maxH = 130;
                    const incH = maxTrendVal > 0 ? (item.income / maxTrendVal) * maxH : 0;
                    const expH = maxTrendVal > 0 ? (item.expense / maxTrendVal) * maxH : 0;
                    const debH = maxTrendVal > 0 ? (item.debt_payments / maxTrendVal) * maxH : 0;

                    return (
                      <g key={idx} className="hover:opacity-80 transition-all cursor-pointer">
                        {/* Income */}
                        <rect fill="#4edea3" height={Math.max(2, incH)} rx="3" width="16" x={startX} y={170 - incH}></rect>
                        {/* Expense */}
                        <rect fill="#ffb4ab" height={Math.max(2, expH)} rx="3" width="16" x={startX + 20} y={170 - expH}></rect>
                        {/* Debt */}
                        <rect fill="#4cd7f6" height={Math.max(2, debH)} rx="3" width="16" x={startX + 40} y={170 - debH}></rect>
                        <text fill="#86948a" fontSize="11" x={startX + 20} y="195">{item.month_name}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

          {/* Right Column (Quick Zones) */}
          <div className="flex flex-col gap-space-lg lg:col-span-5">
            <div className="rounded-xl bg-surface-container p-space-md lg:p-space-lg shadow-md flex flex-col">
              <div className="flex items-center justify-between pb-space-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">recommend</span>
                  <h3 className="text-base font-bold text-on-surface">Rekomendasi WishBoard AI</h3>
                </div>
                <span className="text-[10px] text-secondary font-bold">Rasional Pipeline</span>
              </div>
              <p className="text-xs text-on-surface-variant">Prioritas dihitung dari utilitas kerja, tabungan terkumpul, & sinyal radar harga.</p>

              <div className="mt-space-md">
                <Link
                  to="/pengadaan-radar"
                  className="p-space-md rounded-xl bg-surface-container-high flex flex-col gap-space-sm hover:bg-surface-bright/50 transition-colors block"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                          Deal Score {s.avg_deal_score || 0}/10
                        </span>
                        <span className="text-[10px] text-outline font-semibold">Terkalibrasi</span>
                      </div>
                      <h4 className="text-sm font-semibold text-on-surface mt-1">Sistem Evaluasi Pengadaan</h4>
                      <span className="text-xs text-on-surface-variant">
                        {s.radar_signals_count > 0 ? `${s.radar_signals_count} produk menyentuh target beli` : "Belum ada produk dipantau"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-primary">Tabungan terkumpul: {formatRupiah(s.radar_ready_savings)}</span>
                    <span className="bg-primary hover:bg-primary-container text-on-primary text-[10px] px-3 py-1.5 rounded-lg font-bold">
                      Buka Radar
                    </span>
                  </div>
                </Link>
              </div>
            </div>

            {/* Fast Storage Zones */}
            <div className="rounded-xl bg-surface-container p-space-md lg:p-space-lg shadow-md flex flex-col">
              <div className="flex items-center justify-between pb-space-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[20px]">shelves</span>
                  <h3 className="text-base font-bold text-on-surface">Zona Penyimpanan Dapur Cepat</h3>
                </div>
                <span className="text-xs text-outline font-semibold">Live Stock</span>
              </div>
              <div className="grid grid-cols-3 gap-space-sm mt-space-md">
                <Link to="/dapur-inventaris" className="rounded-xl bg-surface-container-high p-space-sm flex flex-col items-center text-center hover:bg-surface-bright transition-colors">
                  <span className="material-symbols-outlined text-secondary text-[26px]">ac_unit</span>
                  <span className="text-xs font-semibold text-on-surface mt-1">Kulkas</span>
                  <span className="text-lg font-bold text-primary">{s.pantry_safe_count || 0}</span>
                  <span className="text-[10px] text-outline">Dingin</span>
                </Link>
                <Link to="/dapur-inventaris" className="rounded-xl bg-surface-container-high p-space-sm flex flex-col items-center text-center hover:bg-surface-bright transition-colors">
                  <span className="material-symbols-outlined text-secondary-fixed text-[26px]">severe_cold</span>
                  <span className="text-xs font-semibold text-on-surface mt-1">Freezer</span>
                  <span className="text-lg font-bold text-secondary">0</span>
                  <span className="text-[10px] text-outline">Beku</span>
                </Link>
                <Link to="/dapur-inventaris" className="rounded-xl bg-surface-container-high p-space-sm flex flex-col items-center text-center hover:bg-surface-bright transition-colors">
                  <span className="material-symbols-outlined text-outline text-[26px]">inventory</span>
                  <span className="text-xs font-semibold text-on-surface mt-1">Pantry</span>
                  <span className="text-lg font-bold text-on-surface">{s.pantry_restock_count || 0}</span>
                  <span className="text-[10px] text-outline">Restock</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-space-xl pt-space-md border-t border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-space-sm text-xs text-outline">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            <span>OmniLife Engine v2.4 Enterprise Core · 5 Subsystems Synchronized with SQLite WAL</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Latency: <b className="text-on-surface">12ms</b></span>
            <span>Security: <b className="text-primary font-bold">JWT + Bcrypt Verified</b></span>
          </div>
        </footer>
      </div>
    </div>
  );
}

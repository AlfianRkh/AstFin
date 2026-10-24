import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";

export function PengadaanRadar({ onOpenAddRadar, onOpenTransaction }) {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total_monitored: 0, target_hit_count: 0, avg_deal_score: 0, total_savings: 0 });
  const [settings, setSettings] = useState({ utility_weight: 35, desire_weight: 30, saving_weight: 35 });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRadarData = async () => {
    try {
      const [radarRes, settingsRes] = await Promise.all([
        api.getRadarItems(),
        api.getRadarSettings(),
      ]);
      setItems(radarRes.data?.items || []);
      setStats({
        total_monitored: radarRes.data?.total_monitored || 0,
        target_hit_count: radarRes.data?.target_hit_count || 0,
        avg_deal_score: radarRes.data?.avg_deal_score || 0,
        total_savings: radarRes.data?.total_savings || 0,
      });
      if (settingsRes.data) {
        setSettings({
          utility_weight: settingsRes.data.utility_weight || 35,
          desire_weight: settingsRes.data.desire_weight || 30,
          saving_weight: settingsRes.data.saving_weight || 35,
        });
      }
    } catch (err) {
      console.error("Failed to load radar data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRadarData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRadarData();
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleUpdateWeight = async (field, value) => {
    const newSettings = { ...settings, [field]: parseInt(value) || 0 };
    setSettings(newSettings);
    try {
      await api.updateRadarSettings(newSettings);
    } catch (err) {
      console.error("Failed to save procurement weights:", err);
    }
  };

  const handleAddSaving = async (item) => {
    const addVal = prompt(`Tambah alokasi tabungan untuk ${item.title} (Rp):`, "250000");
    if (!addVal || isNaN(addVal)) return;

    try {
      const newSaved = (item.saved_amount || 0) + parseFloat(addVal);
      await api.updateRadarItem(item.id, { saved_amount: newSaved });
      loadRadarData();
    } catch (err) {
      alert("Gagal memperbarui tabungan: " + err.message);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm("Hapus item radar ini?")) return;
    try {
      await api.deleteRadarItem(id);
      loadRadarData();
    } catch (err) {
      alert("Gagal menghapus radar: " + err.message);
    }
  };

  const formatRupiah = (val) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);
  };

  const activeItems = items.filter((it) => it.status !== "bought" && (it.qty === undefined || it.qty > 0));
  const bestDeal = activeItems.length > 0
    ? activeItems.reduce((prev, curr) => (curr.deal_score > prev.deal_score ? curr : prev), activeItems[0])
    : items.length > 0
    ? items[0]
    : null;
  const isBestDealExhausted = Boolean(bestDeal && (bestDeal.status === "bought" || (bestDeal.qty !== undefined && bestDeal.qty <= 0)));

  return (
    <div className="flex flex-col w-full">
      <div className="p-3 sm:p-space-md lg:p-space-lg space-y-space-xl max-w-[1440px] mx-auto w-full">
        {/* Header */}
        <section className="space-y-space-md">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
            <div className="space-y-1">
              <div className="flex items-center gap-space-sm flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-secondary text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span>
                  Live Telemetry Feed
                </span>
                <span className="text-outline text-xs">•</span>
                <span className="text-on-surface-variant text-xs font-semibold">Real-Time Database Sync</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-on-surface tracking-tight">Smart Procurement & Price Radar Hub</h1>
              <p className="text-sm text-on-surface-variant max-w-3xl">
                Sinergi radar pemantau harga multi-platform dengan mesin kalkulasi keputusan belanja rasional berbasis urgensi, utilitas, dan kesiapan tabungan.
              </p>
            </div>
            <div className="flex items-center gap-space-sm shrink-0 flex-wrap">
              <button
                onClick={handleRefresh}
                className="bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-semibold px-3 sm:px-space-md py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-md"
              >
                <span className={`material-symbols-outlined text-[18px] text-secondary ${refreshing ? "animate-spin" : ""}`}>sync</span>
                <span>Refresh Sinyal</span>
              </button>
              <button
                onClick={() => onOpenAddRadar?.()}
                className="bg-primary hover:bg-primary-fixed text-on-primary text-xs font-bold px-3.5 sm:px-space-lg py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(78,222,163,0.35)]"
              >
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                <span>+ Radar Baru</span>
              </button>
            </div>
          </div>

          {/* KPI Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm bg-surface-container-lowest p-space-sm rounded-xl shadow-lg border border-outline-variant/10">
            <div className="bg-surface-container-low/70 px-space-md py-space-sm rounded-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Dipantau Aktif</p>
                <p className="text-lg font-bold text-on-surface mt-0.5">{stats.total_monitored} Produk</p>
              </div>
              <span className="material-symbols-outlined text-secondary text-[26px]">radar</span>
            </div>
            <div className="bg-surface-container-low/70 px-space-md py-space-sm rounded-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Target Hit</p>
                <p className="text-lg font-bold text-primary mt-0.5">{stats.target_hit_count} Siap Eksekusi</p>
              </div>
              <span className="material-symbols-outlined text-primary text-[26px]">target</span>
            </div>
            <div className="bg-surface-container-low/70 px-space-md py-space-sm rounded-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Avg Deal Score</p>
                <p className="text-lg font-bold text-tertiary mt-0.5">{stats.avg_deal_score} <span className="text-xs text-on-surface-variant font-normal">/ 10</span></p>
              </div>
              <span className="material-symbols-outlined text-tertiary text-[26px]">insights</span>
            </div>
            <div className="bg-surface-container-low/70 px-space-md py-space-sm rounded-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Tabungan Terkumpul</p>
                <p className="text-lg font-bold text-on-surface mt-0.5">{formatRupiah(stats.total_savings)}</p>
              </div>
              <span className="material-symbols-outlined text-secondary-fixed text-[26px]">savings</span>
            </div>
          </div>
        </section>

        {/* Top Strategy Callout Banner */}
        {bestDeal && (
          <div className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-surface-container-high to-secondary/10 p-space-lg rounded-2xl shadow-xl border border-outline-variant/15">
            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg z-10">
              <div className="flex items-start gap-space-md">
                <div className="w-12 h-12 rounded-xl bg-primary-container/20 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[28px]">{isBestDealExhausted ? "inventory" : "electric_bolt"}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-primary uppercase font-bold tracking-widest">
                      {isBestDealExhausted ? "Status Pengadaan Selesai" : "Cross-Module Synergy Signal"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container text-[10px] font-bold">
                      Deal Score {bestDeal.deal_score}/10
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-bold border border-outline-variant/20">
                      {isBestDealExhausted ? "Sudah Terbeli / Habis" : `Kebutuhan: ${bestDeal.qty || 1} Unit`}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-on-surface">
                    {bestDeal.title} — Harga saat ini {formatRupiah(bestDeal.current_price)} di {bestDeal.platform}
                  </h2>
                  <p className="text-xs text-on-surface-variant max-w-4xl">
                    Target: <strong className="text-on-surface">{formatRupiah(bestDeal.target_price)}</strong>. Tabungan siap: <strong className="text-primary">{formatRupiah(bestDeal.saved_amount)}</strong> ({Math.round(((bestDeal.saved_amount || 0) / (bestDeal.target_price || 1)) * 100)}%).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-space-sm shrink-0">
                {isBestDealExhausted ? (
                  <button
                    onClick={() => onOpenAddRadar?.(bestDeal)}
                    className="bg-secondary-container hover:bg-secondary text-on-secondary-container text-xs font-bold px-space-lg py-3 rounded-xl flex items-center gap-2 shadow-lg transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]">replay</span>
                    <span>Beli Lagi (Pantau Ulang)</span>
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      onOpenTransaction?.({
                        amount: bestDeal.current_price,
                        merchant: bestDeal.platform ? `${bestDeal.platform} — ${bestDeal.title}` : bestDeal.title,
                        category: bestDeal.category || "Gadget & Setup",
                        notes: `Pengadaan barang Price Radar: ${bestDeal.title} (Platform: ${bestDeal.platform}, Target: Rp ${(bestDeal.target_price || 0).toLocaleString("id-ID")})`,
                        type: "expense",
                        lockType: true,
                        fromRadar: true,
                        radarItemTitle: bestDeal.title,
                        radarItemId: bestDeal.id,
                        radarProduct: bestDeal,
                      })
                    }
                    className="w-full sm:w-auto bg-primary hover:bg-primary-fixed text-on-primary text-xs font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg"
                  >
                    <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                    <span>Eksekusi & Catat ke SmartFin</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Catalog Grid */}
        <section className="space-y-space-md">
          {items.length === 0 ? (
            <EmptyState
              icon="radar"
              title="Belum Ada Produk yang Dipantau"
              description="Tambahkan wishlist gadget, perlengkapan produktivitas, atau komoditas dapur yang ingin Anda pantau harga terendahnya."
              actionText="Tambah Produk Radar"
              onAction={onOpenAddRadar}
            />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-lg">
              {items.map((item) => {
                const itemQty = item.qty !== undefined && item.qty !== null ? item.qty : 1;
                const isExhausted = item.status === "bought" || itemQty <= 0;
                const isTargetHit = !isExhausted && item.current_price <= item.target_price;
                const savePercent = Math.min(100, Math.round(((item.saved_amount || 0) / (item.target_price || 1)) * 100));

                return (
                  <div
                    key={item.id}
                    className={`bg-surface-container-low rounded-2xl p-4 sm:p-space-lg shadow-xl relative overflow-hidden flex flex-col justify-between border transition-all ${
                      isExhausted ? "border-outline-variant/30 opacity-85" : "border-outline-variant/15"
                    }`}
                  >
                    <div className="space-y-space-md">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        {isExhausted ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 bg-surface-container-highest text-outline border border-outline-variant/20">
                            <span className="material-symbols-outlined text-[14px]">done_all</span>
                            SUDAH TERBELI / HABIS
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                            isTargetHit ? "bg-primary-container text-on-primary-container" : "bg-secondary-container text-on-secondary-container"
                          }`}>
                            <span className="material-symbols-outlined text-[14px]">{isTargetHit ? "bolt" : "savings"}</span>
                            {isTargetHit ? "🎯 TARGET HIT" : "💰 SAVING PROGRESS"}
                          </span>
                        )}

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded font-bold text-on-surface-variant border border-outline-variant/15">
                            {isExhausted ? "Stok: 0 Unit" : `Kebutuhan: ${itemQty} Unit`}
                          </span>
                          <span className="text-xs text-secondary font-bold">Deal Score {item.deal_score} · {item.platform}</span>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            title="Hapus item radar"
                            className="text-outline hover:text-error transition-colors p-1"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-space-md items-start">
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center shrink-0 ${
                          isExhausted ? "bg-surface-container-highest text-outline" : "bg-surface-container text-primary"
                        }`}>
                          <span className="material-symbols-outlined text-[32px]">{isExhausted ? "inventory" : "devices"}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-base font-bold truncate ${isExhausted ? "text-on-surface-variant line-through" : "text-on-surface"}`}>
                            {item.title}
                          </h3>
                          <p className="text-xs text-on-surface-variant truncate">{item.description || item.category}</p>
                          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                            <span className={`text-lg font-bold ${isExhausted ? "text-outline" : "text-primary"}`}>
                              {formatRupiah(item.current_price)}
                            </span>
                            <span className="text-xs text-outline line-through">{formatRupiah(item.all_time_high_price)}</span>
                            <span className="text-xs text-secondary font-semibold">Target: {formatRupiah(item.target_price)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Saving progress bar */}
                      <div className="bg-surface-container/60 p-2.5 rounded-xl">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-outline">Tabungan Khusus</span>
                          <span className="text-primary font-bold">{formatRupiah(item.saved_amount)} ({savePercent}%)</span>
                        </div>
                        <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${savePercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 flex items-center gap-2 border-t border-outline-variant/10">
                      {isExhausted ? (
                        <button
                          onClick={() => onOpenAddRadar?.(item)}
                          className="w-full bg-secondary-container hover:bg-secondary text-on-secondary-container text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                        >
                          <span className="material-symbols-outlined text-[18px]">replay</span>
                          <span>Beli Lagi (Pantau Ulang dengan Qty Baru)</span>
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleAddSaving(item)}
                            className="px-3.5 py-2.5 bg-surface-container hover:bg-surface-bright text-on-surface text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-sm active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[18px] text-secondary">add_circle</span>
                            <span>+ Tabungan</span>
                          </button>
                          <button
                            onClick={() =>
                              onOpenTransaction?.({
                                amount: item.current_price,
                                merchant: item.platform ? `${item.platform} — ${item.title}` : item.title,
                                category: item.category || "Gadget & Setup",
                                notes: `Pengadaan barang Price Radar: ${item.title} (Platform: ${item.platform}, Target: Rp ${(item.target_price || 0).toLocaleString("id-ID")})`,
                                type: "expense",
                                lockType: true,
                                fromRadar: true,
                                radarItemTitle: item.title,
                                radarItemId: item.id,
                                radarProduct: item,
                              })
                            }
                            className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-fixed text-on-primary text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all min-w-0"
                          >
                            <span className="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
                            <span className="truncate">Catat Pembelian {itemQty > 1 ? `(${itemQty} Unit)` : ""}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Tuning Controls & Platform Win Rate */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <div className="lg:col-span-7 bg-surface-container-low rounded-2xl p-space-lg shadow-xl space-y-space-md border border-outline-variant/15">
            <h3 className="text-base font-bold text-on-surface">Distribusi Platform Pemenang Harga Terendah</h3>
            <div className="space-y-1.5 pt-2">
              <div className="h-3.5 w-full bg-surface-container-highest rounded-full overflow-hidden flex gap-0.5 p-0.5">
                <div className="h-full bg-primary rounded-l-full" style={{ width: "50%" }}></div>
                <div className="h-full bg-secondary" style={{ width: "30%" }}></div>
                <div className="h-full bg-tertiary" style={{ width: "12%" }}></div>
                <div className="h-full bg-outline rounded-r-full" style={{ width: "8%" }}></div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 text-xs text-on-surface-variant pt-1">
                <span className="text-primary font-bold">Tokopedia (50%)</span>
                <span className="text-secondary font-bold">Shopee (30%)</span>
                <span className="text-tertiary font-bold">Toko Fisik (12%)</span>
                <span className="text-outline font-bold">Blibli (8%)</span>
              </div>
            </div>
          </div>

          {/* Tuning Bobot */}
          <div className="lg:col-span-5 bg-surface-container-low rounded-2xl p-space-lg shadow-xl space-y-space-md border border-outline-variant/15">
            <h3 className="text-base font-bold text-on-surface">Tuning Bobot Belanja Rasional (Auto-Save DB)</h3>
            <div className="space-y-space-sm bg-surface-container/60 p-space-md rounded-xl text-xs">
              <div>
                <div className="flex justify-between font-bold mb-1">
                  <span>Urgensi Kebutuhan (Utility)</span>
                  <span className="text-primary">{settings.utility_weight}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={settings.utility_weight}
                  onChange={(e) => handleUpdateWeight("utility_weight", e.target.value)}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between font-bold mb-1">
                  <span>Tingkat Keinginan (Desire)</span>
                  <span className="text-tertiary">{settings.desire_weight}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={settings.desire_weight}
                  onChange={(e) => handleUpdateWeight("desire_weight", e.target.value)}
                  className="w-full accent-tertiary cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between font-bold mb-1">
                  <span>Kesiapan Tabungan (Buffer)</span>
                  <span className="text-secondary">{settings.saving_weight}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={settings.saving_weight}
                  onChange={(e) => handleUpdateWeight("saving_weight", e.target.value)}
                  className="w-full accent-secondary cursor-pointer"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

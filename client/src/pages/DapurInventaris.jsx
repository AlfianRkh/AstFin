import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { CheckoutShoppingModal } from "../components/modals/CheckoutShoppingModal";
import { RestockProductModal } from "../components/modals/RestockProductModal";
import { parsePackageInfo } from "../utils/packageHelper";

export function DapurInventaris({ onOpenAddPantry, onOpenScan }) {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total_count: 0, safe_count: 0, critical_count: 0, restock_count: 0 });
  const [shoppingList, setShoppingList] = useState([]);
  const [shoppingStats, setShoppingStats] = useState({ total_count: 0, total_estimated: 0 });
  const [loading, setLoading] = useState(true);
  const [modalCheckout, setModalCheckout] = useState(false);
  const [selectedRestockItem, setSelectedRestockItem] = useState(null);
  const [modalRestock, setModalRestock] = useState(false);
  const [newShoppingName, setNewShoppingName] = useState("");
  const [newShoppingPrice, setNewShoppingPrice] = useState("");

  const loadPantryData = async () => {
    try {
      const [pantryRes, shopRes] = await Promise.all([
        api.getPantryItems(),
        api.getShoppingList(),
      ]);
      setItems(pantryRes.data?.items || []);
      setStats({
        total_count: pantryRes.data?.total_count || 0,
        safe_count: pantryRes.data?.safe_count || 0,
        critical_count: pantryRes.data?.critical_count || 0,
        restock_count: pantryRes.data?.restock_count || 0,
      });
      setShoppingList(shopRes.data?.items || []);
      setShoppingStats({
        total_count: shopRes.data?.total_count || 0,
        total_estimated: shopRes.data?.total_estimated || 0,
      });
    } catch (err) {
      console.error("Failed to load pantry data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPantryData();
  }, []);

  const handleUpdateQty = async (item, delta) => {
    try {
      await api.updatePantryQty(item.id, { delta });
      loadPantryData();
    } catch (err) {
      alert("Gagal mengubah kuantitas: " + err.message);
    }
  };

  const handleConsumeAll = async (item) => {
    try {
      await api.updatePantryQty(item.id, { quantity: 0 });
      alert(`${item.name} telah dihabiskan dan otomatis dimasukkan ke Smart Shopping List!`);
      loadPantryData();
    } catch (err) {
      alert("Gagal memperbarui bahan: " + err.message);
    }
  };

  const handleToggleShopping = async (id) => {
    try {
      await api.toggleShoppingItem(id);
      loadPantryData();
    } catch (err) {
      alert("Gagal memperbarui status checklist: " + err.message);
    }
  };

  const handleOpenRestockModal = (item) => {
    setSelectedRestockItem(item);
    setModalRestock(true);
  };

  const handleDeleteShoppingItem = async (id) => {
    try {
      await api.deleteShoppingItem(id);
      loadPantryData();
    } catch (err) {
      alert("Gagal menghapus item belanja: " + err.message);
    }
  };

  const handleAddShoppingManual = async (e) => {
    e.preventDefault();
    if (!newShoppingName.trim()) return;

    try {
      await api.addShoppingItem({
        name: newShoppingName.trim(),
        estimated_price: parseFloat(newShoppingPrice) || 20000,
        store_recommendation: "Supermarket Terdekat",
      });
      setNewShoppingName("");
      setNewShoppingPrice("");
      loadPantryData();
    } catch (err) {
      alert("Gagal menambahkan item belanja: " + err.message);
    }
  };

  const handleDeletePantryItem = async (id) => {
    if (!confirm("Hapus bahan dapur ini?")) return;
    try {
      await api.deletePantryItem(id);
      loadPantryData();
    } catch (err) {
      alert("Gagal menghapus bahan: " + err.message);
    }
  };

  const formatRupiah = (val) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);
  };

  const criticalItems = items.filter((i) => i.status === "critical" || i.status === "expiring_soon");

  return (
    <div className="flex flex-col w-full">
      <div className="relative w-full overflow-hidden px-3 sm:px-space-md lg:px-space-lg py-space-lg flex flex-col gap-space-lg">
        {/* Header */}
        <header className="relative flex flex-col gap-space-md">
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-space-md">
            <div className="flex flex-col max-w-3xl">
              <div className="flex items-center gap-space-xs mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary text-[10px] font-bold tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  StockPantry · SmartFin · PriceRadar Unified
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-on-surface tracking-tight">Pantry Inventory & Restock Supply Chain</h1>
              <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
                Manajemen logistik dapur rumah tangga terhubung: pelacak kedaluwarsa zero-waste, restock otomatis via scan struk kasir, dan komparasi harga komoditas belanja.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={onOpenScan}
                className="bg-primary-container text-on-primary-container text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-primary transition-all shadow-[0_0_16px_rgba(16,185,129,0.3)]"
              >
                <span className="material-symbols-outlined text-[19px]">receipt_long</span>
                <span>+ Pindai Struk Restock</span>
              </button>
              <button
                onClick={onOpenAddPantry}
                className="bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-semibold px-3.5 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">add_box</span>
                <span>+ Tambah Stok Manual</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm pt-2">
            <div className="bg-surface-container-low px-4 py-3 rounded-xl flex items-center gap-3 border border-outline-variant/10">
              <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">kitchen</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Item Aktif</span>
                <span className="text-base font-bold text-on-surface">{stats.total_count} Item</span>
              </div>
            </div>
            <div className="bg-surface-container-low px-4 py-3 rounded-xl flex items-center gap-3 border border-outline-variant/10">
              <div className="w-10 h-10 rounded-lg bg-error-container/20 flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[22px]">notification_important</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Kritis Expiry (&lt;3hr)</span>
                <span className="text-base font-bold text-error">{stats.critical_count} Item Segera Olah</span>
              </div>
            </div>
            <div className="bg-surface-container-low px-4 py-3 rounded-xl flex items-center gap-3 border border-outline-variant/10">
              <div className="w-10 h-10 rounded-lg bg-secondary/15 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Perlu Restock</span>
                <span className="text-base font-bold text-secondary">{stats.restock_count} Item Menipis</span>
              </div>
            </div>
            <div className="bg-surface-container-low px-4 py-3 rounded-xl flex items-center gap-3 border border-outline-variant/10">
              <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">payments</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Estimasi Belanja</span>
                <span className="text-base font-bold text-primary">{formatRupiah(shoppingStats.total_estimated)}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Closed Loop Banner */}
        <section className="relative rounded-2xl bg-gradient-to-r from-surface-container-low via-surface-container to-surface-container-low p-space-md lg:p-space-lg overflow-hidden shadow-lg border-l-4 border-primary">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
            <div className="flex items-start gap-space-md max-w-4xl">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[28px]">all_inclusive</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Autonomous Loop Active</span>
                  <span className="text-sm font-bold text-on-surface">Siklus Tertutup Konsumsi ke Belanja (Closed-Loop)</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Ketika stok di kulkas berkurang hingga habis (0) ➔ Sistem Golang otomatis memasukkannya ke <span className="text-secondary font-semibold">Smart Shopping List</span> ➔ Pindai struk kasir via AI OCR langsung mengisi kembali kuantitas bahan dapur sambil memotong saldo dompet.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* Left Column (Items & Freshness) */}
          <div className="lg:col-span-8 flex flex-col gap-space-xl min-w-0">
            {/* Expiring Soon */}
            {criticalItems.length > 0 && (
              <section className="flex flex-col gap-space-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping"></span>
                    <h2 className="text-base font-bold text-on-surface">Prioritas Habiskan Segera! (Zero-Waste Freshness)</h2>
                  </div>
                  <span className="text-[10px] text-error bg-error-container/20 px-2.5 py-1 rounded-full uppercase tracking-wider font-bold">
                    {criticalItems.length} Bahan Kritis
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-space-sm">
                  {criticalItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-surface-container-low rounded-xl p-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-md relative overflow-hidden border border-outline-variant/15"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-error"></div>
                      <div className="flex items-start sm:items-center gap-space-md min-w-0 pl-1">
                        <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-error shrink-0">
                          <span className="material-symbols-outlined text-[24px]">emergency_heat</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-on-surface truncate">{item.name}</span>
                            <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] font-bold">
                              EXP: {item.expiry_date}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-outline text-xs mt-1">
                            <span className="text-secondary font-medium">{item.category}</span>
                            <span>•</span>
                            <span>Sisa: <strong className="text-on-surface">{item.quantity} {item.unit}</strong></span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleConsumeAll(item)}
                          className="bg-primary-container text-on-primary-container hover:bg-primary text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          <span>Pakai 100%</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Real-time Inventory Catalog */}
            <section className="flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-on-surface">Katalog Bahan Dapur & Status Kuantitas Real-time</h2>
                <button onClick={onOpenAddPantry} className="text-primary text-xs font-bold hover:underline flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Tambah Bahan</span>
                </button>
              </div>

              {items.length === 0 ? (
                <EmptyState
                  icon="kitchen"
                  title="Belum Ada Bahan Dapur"
                  description="Catat persediaan kulkas, freezer, dan lemari bumbu Anda untuk pelacakan masa kedaluwarsa otomatis."
                  actionText="Tambah Bahan Dapur"
                  onAction={onOpenAddPantry}
                />
              ) : (
                <div className="flex flex-col gap-space-sm">
                  {items.map((item) => {
                    const isMenipis = item.quantity <= item.min_quantity;
                    const isOutOfStock = item.quantity <= 0;

                    return (
                      <div
                        key={item.id}
                        className="bg-surface-container-low rounded-2xl p-3 sm:p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-outline-variant/10 shadow-sm hover:border-outline-variant/30 transition-all"
                      >
                        {/* Info Utama: Ikon + Nama + Status + Chip Badges */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isOutOfStock ? "bg-error/15 text-error" : isMenipis ? "bg-amber-400/15 text-amber-400" : "bg-surface-container text-primary"
                          }`}>
                            <span className="material-symbols-outlined text-[24px]">
                              {item.category === "Freezer" ? "severe_cold" : item.category === "Lemari Kering" ? "inventory" : "kitchen"}
                            </span>
                          </div>

                          <div className="flex flex-col min-w-0 flex-1">
                            {/* Nama & Status */}
                            <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                              <span className="text-sm font-bold text-on-surface truncate">{item.name}</span>
                              {isOutOfStock ? (
                                <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] font-bold">
                                  Habis!
                                </span>
                              ) : isMenipis ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 text-[10px] font-bold">
                                  Menipis
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                                  Aman
                                </span>
                              )}
                            </div>

                            {/* Metadata Chip Badges */}
                            <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[11px]">
                              <span className="bg-surface-container px-2 py-0.5 rounded-md text-secondary font-medium">
                                {item.category}
                              </span>
                              <span className="bg-surface-container px-2 py-0.5 rounded-md text-on-surface font-semibold">
                                Sisa: <strong className={isOutOfStock ? "text-error" : isMenipis ? "text-amber-400" : "text-primary"}>{item.quantity} {item.unit}</strong>
                              </span>
                              {item.expiry_date && (
                                <span className="bg-surface-container px-2 py-0.5 rounded-md text-outline">
                                  Exp: {item.expiry_date}
                                </span>
                              )}
                              {item.price > 0 && (
                                <span className="bg-surface-container px-2 py-0.5 rounded-md text-secondary font-medium">
                                  {formatRupiah(item.price)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Toolbar Aksi: Di Mobile Membentang Rapi dengan Border Pemisah */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t border-outline-variant/10 sm:border-0 w-full sm:w-auto">
                          {/* Stepper Qty */}
                          <div className="flex items-center bg-surface-container rounded-xl p-1 shadow-inner">
                            <button
                              onClick={() => handleUpdateQty(item, -1)}
                              className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-bright active:scale-95 text-on-surface flex items-center justify-center font-bold text-sm transition-transform"
                            >
                              -1
                            </button>
                            <span className="min-w-[36px] px-1 text-center text-xs font-extrabold text-on-surface">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQty(item, 1)}
                              className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-bright active:scale-95 text-on-surface flex items-center justify-center font-bold text-sm transition-transform"
                            >
                              +1
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Tombol Belanja */}
                            <button
                              onClick={() => handleOpenRestockModal(item)}
                              title="Masukkan ke Smart Shopping List (Sesuaikan Detail & Harga)"
                              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border shadow-sm active:scale-95 ${
                                shoppingList.some((s) => !s.is_checked && (s.pantry_item_id === item.id || s.name.toLowerCase() === item.name.toLowerCase()))
                                  ? "bg-secondary-container/30 text-secondary border-secondary/40 hover:bg-secondary-container/40"
                                  : "bg-surface-container hover:bg-secondary-container/30 text-on-surface hover:text-secondary border-outline-variant/20 hover:border-secondary/40"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px] text-secondary">add_shopping_cart</span>
                              <span className="text-[11px] font-bold">+ Belanja</span>
                            </button>

                            {/* Tombol Hapus */}
                            <button
                              onClick={() => handleDeletePantryItem(item.id)}
                              title="Hapus bahan"
                              className="w-8 h-8 rounded-xl bg-surface-container hover:bg-error-container/20 text-outline hover:text-error transition-colors flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right Column (Shopping List & Restock) */}
          <div className="lg:col-span-4 flex flex-col gap-space-lg min-w-0">
            <section className="bg-surface-container-low rounded-2xl p-space-md lg:p-space-lg flex flex-col gap-space-md shadow-lg border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[22px]">shopping_cart_checkout</span>
                  <h3 className="text-base font-bold text-on-surface">Smart Shopping List ({shoppingList.length})</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-secondary-container/40 text-secondary-fixed text-[10px] font-bold">
                  PriceRadar Linked
                </span>
              </div>

              <div className="bg-surface-container rounded-xl p-space-md flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Estimasi</span>
                  <span className="text-lg font-bold text-primary">{formatRupiah(shoppingStats.total_estimated)}</span>
                </div>
                <div className="h-px w-full bg-outline-variant/30"></div>
                <p className="text-xs text-on-surface-variant">
                  Item otomatis ditambahkan saat kuantitas dapur mencapai nol (0) atau bahan kedaluwarsa.
                </p>
              </div>

              {/* Add shopping item inline form */}
              {/* <form onSubmit={handleAddShoppingManual} className="flex gap-2 text-xs">
                <input
                  type="text"
                  value={newShoppingName}
                  onChange={(e) => setNewShoppingName(e.target.value)}
                  placeholder="Tambah item belanja..."
                  className="flex-1 bg-surface-container rounded-lg px-3 py-1.5 text-on-surface border border-outline-variant/20 focus:outline-none"
                />
                <button type="submit" className="bg-surface-container-high hover:bg-surface-bright text-primary font-bold px-3 py-1.5 rounded-lg">
                  +
                </button>
              </form> */}

              <div className="flex flex-col gap-space-xs max-h-72 overflow-y-auto pr-1">
                {shoppingList.length === 0 ? (
                  <p className="text-xs text-outline text-center py-4">Daftar belanja kosong. Semua kebutuhan pantry terpenuhi!</p>
                ) : (
                  shoppingList.map((item) => {
                    const pkg = parsePackageInfo(item.name);
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-2.5 rounded-lg bg-surface-container/60 hover:bg-surface-container transition-colors group"
                      >
                        <input
                          type="checkbox"
                          checked={item.is_checked}
                          onChange={() => handleToggleShopping(item.id)}
                          className="mt-1 w-4 h-4 rounded text-primary-container accent-primary focus:ring-0 cursor-pointer"
                        />
                        <div
                          onClick={() => handleToggleShopping(item.id)}
                          className="flex flex-col min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className={`text-xs font-semibold ${item.is_checked ? "line-through text-outline" : "text-on-surface"}`}>
                                {pkg.hasPackage ? pkg.baseName : item.name}
                              </span>
                              {pkg.hasPackage && (
                                <span className="text-[9px] bg-secondary-container/30 text-secondary-fixed border border-secondary/30 px-1.5 py-0.2 rounded font-bold inline-flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[11px]">inventory_2</span>
                                  <span>{pkg.packageQty} {pkg.packageUnit} ({pkg.totalPcs} pcs)</span>
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-on-surface-variant shrink-0">{formatRupiah(item.estimated_price)}</span>
                          </div>
                          <span className="text-[10px] text-outline truncate mt-0.5">{item.store_recommendation}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteShoppingItem(item.id)}
                          title="Hapus dari daftar belanja"
                          className="text-outline hover:text-error opacity-60 hover:opacity-100 p-0.5 transition-all"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/10">
                {(() => {
                  const activeCount = shoppingList.filter((i) => !i.is_checked).length;
                  return (
                    <button
                      type="button"
                      disabled={activeCount === 0}
                      onClick={() => setModalCheckout(true)}
                      className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md text-xs font-bold ${activeCount === 0
                          ? "bg-surface-container text-outline opacity-40 cursor-not-allowed border border-outline-variant/15"
                          : "bg-primary text-on-primary hover:bg-primary-fixed shadow-[0_0_16px_rgba(16,185,129,0.3)] cursor-pointer"
                        }`}
                    >
                      <span className="material-symbols-outlined text-[19px]">payments</span>
                      <span>
                        {activeCount === 0
                          ? "Daftar Belanja Kosong"
                          : `Belanja Sekarang (${activeCount} Item)`}
                      </span>
                    </button>
                  );
                })()}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Modal Eksekusi Belanja Smart Shopping List */}
      <CheckoutShoppingModal
        isOpen={modalCheckout}
        onClose={() => setModalCheckout(false)}
        shoppingItems={shoppingList}
        onSuccess={loadPantryData}
      />

      {/* Modal Input Detail Data Produk Restock */}
      <RestockProductModal
        isOpen={modalRestock}
        onClose={() => {
          setModalRestock(false);
          setSelectedRestockItem(null);
        }}
        item={selectedRestockItem}
        onSuccess={loadPantryData}
      />
    </div>
  );
}

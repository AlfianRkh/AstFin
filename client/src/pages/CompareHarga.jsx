import React, { useState, useEffect } from "react";
import { api, getImageUrl } from "../api/client";
import { RecordPriceModal } from "../components/modals/RecordPriceModal";
import { AddStoreModal } from "../components/modals/AddStoreModal";
import { EditProductModal } from "../components/modals/EditProductModal";
import { ScanBarcodeModal } from "../components/modals/ScanBarcodeModal";

export function CompareHarga() {
  const [activeTab, setActiveTab] = useState("products"); // products | check | stores | settings

  // Products state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Detail Modal / Drawer state
  const [selectedProductDetail, setSelectedProductDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [targetProductForEntry, setTargetProductForEntry] = useState(null);
  const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);

  // Edit Product state
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Barcode Scanner states
  const [isCatalogScanOpen, setIsCatalogScanOpen] = useState(false);
  const [isPriceCheckScanOpen, setIsPriceCheckScanOpen] = useState(false);
  const [scannedProductAlert, setScannedProductAlert] = useState(null);

  // Price Check Calculator state
  const [checkForm, setCheckForm] = useState({
    product_name: "",
    purchase_unit: "pcs",
    purchase_qty: 1,
    units_per_package: "",
    price_total: "",
    discount_type: "amount",
    discount_value: "",
  });
  const [checkResult, setCheckResult] = useState(null);
  const [checkingPrice, setCheckingPrice] = useState(false);
  const [checkError, setCheckError] = useState("");

  // Stores state
  const [stores, setStores] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    threshold_mode: "percent",
    threshold_cheap_pct: 10,
    threshold_expensive_pct: 15,
    period_days: 60,
    default_source: "combined",
    share_all_entries: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");

  // Fetch Products & Categories
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.getPriceProducts({ q: searchQuery, category_id: selectedCategory }),
        api.getPriceCategories(),
      ]);
      setProducts(Array.isArray(pRes?.data) ? pRes.data : []);
      setCategories(Array.isArray(cRes?.data) ? cRes.data : []);
    } catch (err) {
      console.error(err);
      setProducts([]);
      setCategories([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchStores = async () => {
    setLoadingStores(true);
    try {
      const res = await api.getStores();
      setStores(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setStores([]);
    } finally {
      setLoadingStores(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.getPriceSettings();
      if (res.data) setSettings(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  useEffect(() => {
    if (activeTab === "stores") fetchStores();
    if (activeTab === "settings") fetchSettings();
  }, [activeTab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  // View Product Details with History Entries
  const handleViewDetail = async (productId) => {
    setLoadingDetail(true);
    try {
      const res = await api.getPriceProductDetail(productId);
      if (res.data) {
        setSelectedProductDetail({
          ...res.data,
          entries: Array.isArray(res.data.entries) ? res.data.entries : [],
        });
      }
    } catch (err) {
      alert("Gagal memuat detail harga: " + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Delete Price Entry
  const handleDeleteEntry = async (entryId) => {
    if (!confirm("Hapus catatan harga ini?")) return;
    try {
      await api.deletePriceEntry(entryId);
      if (selectedProductDetail) {
        handleViewDetail(selectedProductDetail.id);
      }
      fetchProducts();
    } catch (err) {
      alert("Gagal menghapus entri: " + err.message);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (productId) => {
    if (!confirm("Hapus produk ini dan seluruh riwayat perbandingan harganya?")) return;
    try {
      await api.deletePriceProduct(productId);
      if (selectedProductDetail?.id === productId) {
        setSelectedProductDetail(null);
      }
      fetchProducts();
    } catch (err) {
      alert("Gagal menghapus produk: " + err.message);
    }
  };

  // Handle Catalog Barcode Scan
  const handleCatalogBarcodeScan = async (scannedCode) => {
    try {
      const match = products.find((p) => p.barcode && p.barcode.toLowerCase() === scannedCode.toLowerCase());
      if (match) {
        handleViewDetail(match.id);
        return;
      }
      // If not in current list, search backend
      const res = await api.getPriceProducts({ barcode: scannedCode });
      const found = Array.isArray(res?.data) && res.data.length > 0 ? res.data[0] : null;
      if (found) {
        handleViewDetail(found.id);
      } else {
        setSearchQuery(scannedCode);
        setTimeout(fetchProducts, 50);
      }
    } catch {
      setSearchQuery(scannedCode);
      setTimeout(fetchProducts, 50);
    }
  };

  // Handle Price Check Barcode Scan (Tab 2)
  const handlePriceCheckBarcodeScan = async (scannedCode) => {
    setCheckError("");
    setScannedProductAlert(null);
    try {
      let match = products.find((p) => p.barcode && p.barcode.toLowerCase() === scannedCode.toLowerCase());
      if (!match) {
        const res = await api.getPriceProducts({ barcode: scannedCode });
        match = Array.isArray(res?.data) && res.data.length > 0 ? res.data[0] : null;
      }

      if (match) {
        setCheckForm((prev) => ({
          ...prev,
          product_name: match.name,
          purchase_unit: match.base_unit || "pcs",
        }));
        setScannedProductAlert(match);

        // If price already entered, auto run price check!
        if (checkForm.price_total && parseFloat(checkForm.price_total) > 0) {
          const res = await api.checkPrice({
            product_name: match.name,
            purchase_unit: match.base_unit || "pcs",
            purchase_qty: parseFloat(checkForm.purchase_qty) || 1,
            units_per_package: checkForm.units_per_package ? parseFloat(checkForm.units_per_package) : null,
            price_total: parseFloat(checkForm.price_total) || 0,
            discount_type: checkForm.discount_type,
            discount_value: parseFloat(checkForm.discount_value) || 0,
          });
          if (res.data) setCheckResult(res.data);
        }
      } else {
        setCheckForm((prev) => ({
          ...prev,
          product_name: scannedCode,
        }));
        setScannedProductAlert({
          name: scannedCode,
          isNew: true,
        });
      }
    } catch (err) {
      setCheckError("Gagal memproses barcode: " + err.message);
    }
  };

  // Run Pre-Shopping Price Check
  const handleRunPriceCheck = async (e) => {
    e.preventDefault();
    if (!checkForm.product_name.trim()) {
      setCheckError("Nama barang wajib diisi");
      return;
    }
    if (!checkForm.price_total || parseFloat(checkForm.price_total) <= 0) {
      setCheckError("Harga barang harus lebih dari 0");
      return;
    }

    setCheckingPrice(true);
    setCheckError("");
    setCheckResult(null);

    try {
      const res = await api.checkPrice({
        product_name: checkForm.product_name.trim(),
        purchase_unit: checkForm.purchase_unit,
        purchase_qty: parseFloat(checkForm.purchase_qty) || 1,
        units_per_package: checkForm.units_per_package ? parseFloat(checkForm.units_per_package) : null,
        price_total: parseFloat(checkForm.price_total) || 0,
        discount_type: checkForm.discount_type,
        discount_value: parseFloat(checkForm.discount_value) || 0,
      });

      if (res.data) {
        setCheckResult(res.data);
      }
    } catch (err) {
      setCheckError(err.message || "Gagal melakukan analisis harga");
    } finally {
      setCheckingPrice(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMessage("");
    try {
      await api.updatePriceSettings(settings);
      setSettingsMessage("Pengaturan ambang batas berhasil disimpan!");
      setTimeout(() => setSettingsMessage(""), 4000);
    } catch (err) {
      setSettingsMessage("Gagal menyimpan pengaturan: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const formatRupiah = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "Rp 0";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="min-h-screen bg-surface pb-24 lg:pb-12 text-on-surface">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-b from-surface-container-low to-surface border-b border-outline-variant/15 px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              <span className="material-symbols-outlined text-[16px]">travel_explore</span>
              <span>Price Intelligence & Location Radar</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
              Compare Price Product
            </h1>
            <p className="text-xs sm:text-sm text-outline-variant mt-1">
              Pantau harga sembako, sayur, buah & kebutuhan di berbagai toko, pasar, dan tukang sayur keliling Sidoarjo
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setTargetProductForEntry(null);
                setIsRecordModalOpen(true);
              }}
              className="px-4 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Catat Harga Barang</span>
            </button>

            <button
              onClick={() => setActiveTab("check")}
              className="px-4 py-2.5 bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs font-bold rounded-2xl hover:border-primary/50 transition-all flex items-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">search_check</span>
              <span>Cek Sebelum Belanja</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill */}
        <div className="max-w-7xl mx-auto mt-6 flex gap-2 border-b border-outline-variant/15 overflow-x-auto pb-px">
          {[
            { id: "products", label: "Daftar Produk & Riwayat", icon: "inventory_2" },
            { id: "check", label: "Kalkulator Cek Harga", icon: "price_check" },
            { id: "stores", label: "Daftar Toko & Pedagang", icon: "storefront" },
            { id: "settings", label: "Pengaturan & Ambang Batas", icon: "tune" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-primary text-primary bg-primary/5 font-bold"
                  : "border-transparent text-outline-variant hover:text-on-surface hover:bg-surface-container/30"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
        {/* =================================================================== */}
        {/* TAB 1: DAFTAR PRODUK & RIWAYAT */}
        {/* =================================================================== */}
        {activeTab === "products" && (
          <div className="space-y-6">
            {/* Search & Category Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama barang..."
                  className="w-full bg-surface-container-lowest/80 border border-outline-variant/30 rounded-2xl px-4 py-2.5 pl-10 text-xs text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary transition-colors"
                />
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[20px] text-outline-variant">
                  search
                </span>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setTimeout(fetchProducts, 50);
                    }}
                    className="absolute right-3 top-2.5 text-outline-variant hover:text-on-surface text-xs"
                  >
                    ✕
                  </button>
                )}
              </form>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCatalogScanOpen(true)}
                  className="px-3.5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
                  title="Pindai barcode untuk mencari produk otomatis"
                >
                  <span className="material-symbols-outlined text-[18px]">barcode_scanner</span>
                  <span className="hidden sm:inline">Scan Barcode</span>
                </button>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-surface-container-lowest/80 border border-outline-variant/30 rounded-2xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">Semua Kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={fetchProducts}
                  className="p-2.5 bg-surface-container-high border border-outline-variant/30 rounded-2xl text-outline-variant hover:text-on-surface hover:border-primary transition-colors"
                  title="Segarkan Data"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                </button>
              </div>
            </div>

            {/* Products Grid */}
            {loadingProducts ? (
              <div className="py-16 text-center text-outline-variant flex flex-col items-center justify-center gap-3">
                <span className="material-symbols-outlined text-4xl animate-spin text-primary">
                  progress_activity
                </span>
                <p className="text-xs">Memuat katalog harga...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                  <span className="material-symbols-outlined text-3xl">shopping_bag</span>
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="font-bold text-base text-on-surface">Belum Ada Pengamatan Harga</h3>
                  <p className="text-xs text-outline-variant mt-1">
                    Mulai catat harga belanjaan Anda dari minimarket, pasar, supermarket, atau tukang sayur untuk membandingkan harga termurah.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTargetProductForEntry(null);
                    setIsRecordModalOpen(true);
                  }}
                  className="px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                >
                  + Catat Harga Pertama
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="bg-surface-container-low border border-outline-variant/25 rounded-3xl p-5 hover:border-primary/40 transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-lg hover:shadow-primary/5 group"
                  >
                    <div>
                      {/* Top Tag & Category & Barcode */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            {p.category_name || "Lainnya"}
                          </span>

                          {p.barcode && (
                            <span className="text-[10px] font-mono font-medium text-outline-variant bg-surface-container-high px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">qr_code</span>
                              <span>{p.barcode}</span>
                            </span>
                          )}
                        </div>

                        {p.price_trend && (
                          <div
                            className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.price_trend === "up"
                                ? "text-red-400 bg-red-500/10"
                                : p.price_trend === "down"
                                ? "text-emerald-400 bg-emerald-500/10"
                                : "text-outline-variant bg-surface-container"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {p.price_trend === "up" ? "trending_up" : p.price_trend === "down" ? "trending_down" : "trending_flat"}
                            </span>
                            <span>{p.price_trend === "up" ? "Naik" : p.price_trend === "down" ? "Turun" : "Stabil"}</span>
                          </div>
                        )}
                      </div>

                      {/* Product Image & Name */}
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <div className="w-14 h-14 rounded-2xl bg-surface-container-highest overflow-hidden shrink-0 border border-outline-variant/30">
                            <img
                              src={getImageUrl(p.image_url)}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-surface-container-highest/80 flex items-center justify-center shrink-0 border border-outline-variant/20 text-outline-variant">
                            <span className="material-symbols-outlined text-2xl">shopping_basket</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-base text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                            {p.name}
                          </h3>
                          <span className="text-[11px] text-outline-variant uppercase">
                            Satuan: {p.base_unit}
                          </span>
                        </div>
                      </div>

                      {/* Main Price Stats */}
                      <div className="mt-4 p-3 bg-surface-container-lowest/80 rounded-2xl border border-outline-variant/15 space-y-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] text-outline-variant uppercase tracking-wider">
                            Harga Terakhir
                          </span>
                          <strong className="text-base font-extrabold text-on-surface">
                            {formatRupiah(p.last_price_per_unit)} / <span className="text-xs uppercase font-medium">{p.base_unit}</span>
                          </strong>
                        </div>

                        {p.cheapest_store_name && (
                          <div className="pt-2 border-t border-outline-variant/10 flex items-start gap-1.5 text-xs text-emerald-400">
                            <span className="material-symbols-outlined text-[16px] text-emerald-400 shrink-0 mt-0.5">
                              verified
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] text-outline-variant block">Termurah @ {p.cheapest_store_name}:</span>
                              <strong className="font-bold">{formatRupiah(p.min_price_per_unit)} / {p.base_unit}</strong>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Additional Metrics */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-outline-variant">
                        <div>
                          <span>Rentang:</span>{" "}
                          <strong className="text-on-surface font-semibold">
                            {formatRupiah(p.min_price_per_unit)} - {formatRupiah(p.max_price_per_unit)}
                          </strong>
                        </div>
                        <div className="text-right">
                          <span>Total Pengamatan:</span>{" "}
                          <strong className="text-on-surface font-semibold">{p.entries_count}x</strong>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-5 pt-3 border-t border-outline-variant/15 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetProductForEntry(p);
                          setIsRecordModalOpen(true);
                        }}
                        className="flex-1 py-2 px-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        title="Catat harga untuk produk ini di lokasi / waktu lain"
                      >
                        <span className="material-symbols-outlined text-[16px]">add_location_alt</span>
                        <span>+ Lokasi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingProduct(p);
                          setIsEditProductOpen(true);
                        }}
                        className="p-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-outline-variant hover:text-primary transition-colors"
                        title="Edit Detail Produk & Foto"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleViewDetail(p.id)}
                        className="p-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-outline-variant hover:text-on-surface transition-colors"
                        title="Lihat Riwayat & Peta"
                      >
                        <span className="material-symbols-outlined text-[18px]">history</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-2 hover:bg-red-500/10 rounded-xl text-outline-variant hover:text-red-400 transition-colors"
                        title="Hapus Produk"
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

        {/* =================================================================== */}
        {/* TAB 2: KALKULATOR CEK HARGA ("SEBELUM BELANJA") */}
        {/* =================================================================== */}
        {activeTab === "check" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-surface-container-low border border-outline-variant/25 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl">price_check</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-on-surface">Cek Kelayakan Harga Sebelum Belanja</h2>
                  <p className="text-xs text-outline-variant">
                    Masukkan harga penawaran toko untuk mengetahui apakah harga tersebut Termasuk Murah, Wajar, atau Kemahalan.
                  </p>
                </div>
              </div>

              {checkError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                  {checkError}
                </div>
              )}

              <form onSubmit={handleRunPriceCheck} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-outline-variant uppercase tracking-wider">
                      Nama Barang yang Sedang Dilihat *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsPriceCheckScanOpen(true)}
                      className="px-3 py-1 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">barcode_scanner</span>
                      <span>Scan Barcode (Tanpa Ketik)</span>
                    </button>
                  </div>

                  {scannedProductAlert && (
                    <div className="mb-2 p-3 bg-primary/10 border border-primary/25 rounded-2xl flex items-center gap-3">
                      {scannedProductAlert.image_url ? (
                        <img
                          src={getImageUrl(scannedProductAlert.image_url)}
                          alt={scannedProductAlert.name}
                          className="w-10 h-10 rounded-xl object-cover border border-primary/30"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-primary uppercase font-bold tracking-wider block">
                          {scannedProductAlert.isNew ? "Barcode Terbaca (Produk Baru)" : "Barang Terdeteksi di Database"}
                        </span>
                        <strong className="text-xs text-on-surface block truncate">
                          {scannedProductAlert.name}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setScannedProductAlert(null)}
                        className="text-xs text-outline-variant hover:text-on-surface"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <input
                    type="text"
                    required
                    value={checkForm.product_name}
                    onChange={(e) => setCheckForm({ ...checkForm, product_name: e.target.value })}
                    placeholder="Ketik nama atau tekan 'Scan Barcode' di atas"
                    className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-4 py-3 text-xs text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary transition-colors font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
                      Jumlah (Qty)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={checkForm.purchase_qty}
                      onChange={(e) => setCheckForm({ ...checkForm, purchase_qty: e.target.value })}
                      className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
                      Satuan Beli
                    </label>
                    <select
                      value={checkForm.purchase_unit}
                      onChange={(e) => setCheckForm({ ...checkForm, purchase_unit: e.target.value })}
                      className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="pcs">Pcs / Butir / Buah</option>
                      <option value="kg">Kilogram (kg)</option>
                      <option value="gram">Gram (gr)</option>
                      <option value="liter">Liter (L)</option>
                      <option value="kardus">Kardus / Karton</option>
                      <option value="pack">Pack / Kantong</option>
                      <option value="dus">Dus / Box</option>
                      <option value="lusin">Lusin (12 pcs)</option>
                      <option value="tray">Tray (Telur)</option>
                    </select>
                  </div>

                  {["kardus", "pack", "dus", "lusin", "tray"].includes(checkForm.purchase_unit.toLowerCase()) && (
                    <div>
                      <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1.5">
                        Isi per Kemasan (pcs)
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Misal: 24 atau 30"
                        value={checkForm.units_per_package}
                        onChange={(e) => setCheckForm({ ...checkForm, units_per_package: e.target.value })}
                        className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl px-3.5 py-2.5 text-xs text-amber-200 focus:outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
                      Harga Penawaran (Rp) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="Misal: 28000"
                      value={checkForm.price_total}
                      onChange={(e) => setCheckForm({ ...checkForm, price_total: e.target.value })}
                      className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
                      Diskon Toko (Opsional)
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={checkForm.discount_type}
                        onChange={(e) => setCheckForm({ ...checkForm, discount_type: e.target.value })}
                        className="bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-2.5 py-2.5 text-xs text-on-surface focus:outline-none"
                      >
                        <option value="amount">Rp</option>
                        <option value="percent">%</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        placeholder="Nilai diskon"
                        value={checkForm.discount_value}
                        onChange={(e) => setCheckForm({ ...checkForm, discount_value: e.target.value })}
                        className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-3 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={checkingPrice}
                      className="w-full py-2.5 px-4 bg-primary text-on-primary text-xs font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {checkingPrice ? (
                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">insights</span>
                          <span>Analisis Harga Sekarang</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Price Check Result Card */}
              {checkResult && (
                <div
                  className={`mt-6 rounded-3xl p-6 border transition-all animate-fade-in ${
                    checkResult.verdict === "cheap"
                      ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                      : checkResult.verdict === "expensive"
                      ? "bg-red-950/20 border-red-500/40 text-red-300"
                      : checkResult.verdict === "fair"
                      ? "bg-sky-950/20 border-sky-500/40 text-sky-300"
                      : "bg-surface-container border-outline-variant/30 text-outline-variant"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`material-symbols-outlined text-2xl ${
                            checkResult.verdict === "cheap"
                              ? "text-emerald-400"
                              : checkResult.verdict === "expensive"
                              ? "text-red-400"
                              : checkResult.verdict === "fair"
                              ? "text-sky-400"
                              : "text-outline-variant"
                          }`}
                        >
                          {checkResult.verdict === "cheap"
                            ? "thumb_up"
                            : checkResult.verdict === "expensive"
                            ? "warning"
                            : checkResult.verdict === "fair"
                            ? "balance"
                            : "info"}
                        </span>
                        <h3 className="font-extrabold text-xl">{checkResult.verdict_label}</h3>
                      </div>

                      {checkResult.verdict !== "not_enough_data" && (
                        <p className="text-xs font-medium mt-1 text-on-surface">
                          Selisih Harga:{" "}
                          <strong className={checkResult.diff_percentage > 0 ? "text-red-400" : "text-emerald-400"}>
                            {checkResult.diff_percentage > 0 ? `+${checkResult.diff_percentage}% (Lebih Mahal)` : `${checkResult.diff_percentage}% (Lebih Hemat)`}
                          </strong>{" "}
                          dibanding harga median wilayah Sidoarjo.
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-outline-variant uppercase tracking-wider block">
                        Harga Normalisasi Input
                      </span>
                      <strong className="text-lg font-bold text-on-surface">
                        {formatRupiah(checkResult.normalized_price_per_unit)} / {checkResult.base_unit}
                      </strong>
                    </div>
                  </div>

                  {/* Recommendation message */}
                  <div className="mt-4 p-4 rounded-2xl bg-surface-container-lowest/80 border border-outline-variant/15 text-xs text-on-surface leading-relaxed">
                    💡 <strong>Rekomendasi Pintar:</strong> {checkResult.recommendation}
                  </div>

                  {/* Regional benchmark stats */}
                  {checkResult.verdict !== "not_enough_data" && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-2.5 rounded-xl bg-surface-container-lowest/60 border border-outline-variant/10">
                        <span className="text-[10px] text-outline-variant uppercase tracking-wider block">Median Sidoarjo</span>
                        <strong className="text-xs font-bold text-on-surface">{formatRupiah(checkResult.median_price)}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-surface-container-lowest/60 border border-outline-variant/10">
                        <span className="text-[10px] text-outline-variant uppercase tracking-wider block">Termurah Terpantau</span>
                        <strong className="text-xs font-bold text-emerald-400">{formatRupiah(checkResult.min_price)}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-surface-container-lowest/60 border border-outline-variant/10">
                        <span className="text-[10px] text-outline-variant uppercase tracking-wider block">Termahal Terpantau</span>
                        <strong className="text-xs font-bold text-red-400">{formatRupiah(checkResult.max_price)}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-surface-container-lowest/60 border border-outline-variant/10">
                        <span className="text-[10px] text-outline-variant uppercase tracking-wider block">Basis Data</span>
                        <strong className="text-xs font-bold text-on-surface">{checkResult.entries_analyzed_count} entri</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: DAFTAR TOKO & PEDAGANG */}
        {/* =================================================================== */}
        {activeTab === "stores" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-on-surface">Daftar Toko & Pedagang Tersimpan</h2>
                <p className="text-xs text-outline-variant">
                  Lokasi toko, pasar, agen grosir, dan tukang sayur keliling di database Anda
                </p>
              </div>

              <button
                onClick={() => setIsAddStoreModalOpen(true)}
                className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-2xl hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-md shadow-primary/20"
              >
                <span className="material-symbols-outlined text-[18px]">add_business</span>
                <span>+ Tambah Toko</span>
              </button>
            </div>

            {loadingStores ? (
              <div className="py-12 text-center text-outline-variant flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                <span>Memuat daftar toko...</span>
              </div>
            ) : stores.length === 0 ? (
              <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-8 text-center text-outline-variant">
                Belum ada toko yang disimpan. Klik tombol <strong>+ Tambah Toko</strong> untuk mendaftarkan toko pertama Anda.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.map((s) => (
                  <div
                    key={s.id}
                    className="bg-surface-container-low border border-outline-variant/25 rounded-3xl p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase">
                          {s.store_type}
                        </span>
                        {s.is_mobile && (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                            🛵 Keliling
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm text-on-surface">{s.name}</h3>
                      <p className="text-xs text-outline-variant mt-1 line-clamp-2">
                        {s.address_text || "Alamat belum tercatat"}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between text-[11px] text-outline-variant">
                      <span>Lat: {s.lat ? s.lat.toFixed(4) : "-"}, Lng: {s.lng ? s.lng.toFixed(4) : "-"}</span>
                      <button
                        onClick={async () => {
                          if (confirm(`Hapus toko ${s.name}?`)) {
                            await api.deleteStore(s.id);
                            fetchStores();
                          }
                        }}
                        className="text-red-400 hover:text-red-300 font-semibold"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: PENGATURAN & AMBANG BATAS */}
        {/* =================================================================== */}
        {activeTab === "settings" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-surface-container-low border border-outline-variant/25 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-on-surface">Pengaturan Ambang Batas Harga</h2>
                <p className="text-xs text-outline-variant mt-1">
                  Sesuaikan persentase toleransi klasifikasi Murah, Wajar, dan Mahal secara dinamis
                </p>
              </div>

              {settingsMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs">
                  {settingsMessage}
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                      Ambang Batas Murah (% di bawah Median)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        required
                        value={settings.threshold_cheap_pct}
                        onChange={(e) => setSettings({ ...settings, threshold_cheap_pct: parseFloat(e.target.value) || 10 })}
                        className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
                      />
                      <span className="absolute right-4 top-2.5 text-xs text-outline-variant font-bold">%</span>
                    </div>
                    <p className="text-[10px] text-outline-variant mt-1">
                      Harga dianggap Murah jika minimal {settings.threshold_cheap_pct}% lebih hemat dari median pasar.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">
                      Ambang Batas Mahal (% di atas Median)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={settings.threshold_expensive_pct}
                        onChange={(e) => setSettings({ ...settings, threshold_expensive_pct: parseFloat(e.target.value) || 15 })}
                        className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
                      />
                      <span className="absolute right-4 top-2.5 text-xs text-outline-variant font-bold">%</span>
                    </div>
                    <p className="text-[10px] text-outline-variant mt-1">
                      Harga dianggap Mahal jika lebih tinggi {settings.threshold_expensive_pct}% atau lebih dari median pasar.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
                    Periode Riwayat yang Dianalisis (Hari)
                  </label>
                  <input
                    type="number"
                    min="7"
                    max="365"
                    required
                    value={settings.period_days}
                    onChange={(e) => setSettings({ ...settings, period_days: parseInt(e.target.value, 10) || 60 })}
                    className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
                  />
                  <p className="text-[10px] text-outline-variant mt-1">
                    Hanya data pengamatan harga dalam {settings.period_days} hari terakhir yang dihitung untuk menjaga relevansi inflasi.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full py-3 px-4 bg-primary text-on-primary text-xs font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    {savingSettings ? (
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    ) : (
                      <span>Simpan Perubahan Ambang Batas</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Product Detail & Price Entries History Drawer */}
      {selectedProductDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Drawer Header */}
            <div className="p-5 border-b border-outline-variant/15 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                {selectedProductDetail.image_url ? (
                  <img
                    src={getImageUrl(selectedProductDetail.image_url)}
                    alt={selectedProductDetail.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-outline-variant/30 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-surface-container-high border border-outline-variant/20 flex items-center justify-center text-outline-variant shrink-0">
                    <span className="material-symbols-outlined text-2xl">shopping_basket</span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                      {selectedProductDetail.category_name}
                    </span>
                    {selectedProductDetail.barcode && (
                      <span className="text-[10px] font-mono text-outline-variant bg-surface-container-high px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">qr_code</span>
                        <span>{selectedProductDetail.barcode}</span>
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-lg text-on-surface">
                    {selectedProductDetail.name}
                  </h3>
                  <p className="text-xs text-outline-variant">
                    Satuan Komparasi: <strong className="uppercase">{selectedProductDetail.base_unit}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(selectedProductDetail);
                    setIsEditProductOpen(true);
                  }}
                  className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/25 rounded-xl text-xs font-semibold text-on-surface flex items-center gap-1 transition-colors"
                  title="Edit Detail Produk"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Edit Produk</span>
                </button>

                <button
                  onClick={() => setSelectedProductDetail(null)}
                  className="p-1.5 rounded-full hover:bg-surface-container text-outline-variant hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-outline-variant uppercase tracking-wider">
                  Entri Pengamatan ({selectedProductDetail.entries?.length || 0})
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setTargetProductForEntry(selectedProductDetail);
                    setIsRecordModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">add_location_alt</span>
                  <span>+ Tambah Lokasi / Waktu</span>
                </button>
              </div>

              {!selectedProductDetail.entries || selectedProductDetail.entries.length === 0 ? (
                <p className="text-xs text-outline-variant text-center py-6">
                  Belum ada catatan harga untuk produk ini.
                </p>
              ) : (
                <div className="space-y-3">
                  {(selectedProductDetail.entries || []).map((ent) => (
                    <div
                      key={ent.id}
                      className="bg-surface-container-lowest/90 border border-outline-variant/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/30 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-on-surface">
                            {ent.store_name}
                          </strong>
                          {ent.store_type && (
                            <span className="text-[10px] text-outline-variant bg-surface-container px-2 py-0.5 rounded-md">
                              {ent.store_type}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-outline-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">place</span>
                          <span className="line-clamp-1">{ent.address_text || "Lokasi tersimpan"}</span>
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-outline-variant pt-1">
                          <span>Tanggal: <strong>{ent.observed_at}</strong></span>
                          <span>Beli: <strong>{ent.purchase_qty} {ent.purchase_unit}</strong> ({ent.total_units} {selectedProductDetail.base_unit})</span>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-outline-variant/15">
                        <div className="text-right">
                          <span className="text-[10px] text-outline-variant block">Harga per Satuan:</span>
                          <strong className="text-base font-extrabold text-primary">
                            {formatRupiah(ent.price_per_unit)} / {selectedProductDetail.base_unit}
                          </strong>
                          <span className="text-[11px] text-outline-variant block">
                            Total: {formatRupiah(ent.price_final)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(ent.id)}
                          className="text-[11px] text-red-400 hover:text-red-300 font-semibold mt-1"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <RecordPriceModal
        isOpen={isRecordModalOpen}
        existingProduct={targetProductForEntry}
        onClose={() => {
          setIsRecordModalOpen(false);
          setTargetProductForEntry(null);
        }}
        onSuccess={() => {
          fetchProducts();
          if (selectedProductDetail) {
            handleViewDetail(selectedProductDetail.id);
          }
        }}
      />

      <AddStoreModal
        isOpen={isAddStoreModalOpen}
        onClose={() => setIsAddStoreOpen(false)}
        onStoreCreated={() => {
          fetchStores();
        }}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={isEditProductOpen}
        product={editingProduct}
        categories={categories}
        onClose={() => {
          setIsEditProductOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={() => {
          fetchProducts();
          if (selectedProductDetail && editingProduct && selectedProductDetail.id === editingProduct.id) {
            handleViewDetail(selectedProductDetail.id);
          }
        }}
      />

      {/* Catalog Barcode Scanner Modal (Tab 1) */}
      <ScanBarcodeModal
        isOpen={isCatalogScanOpen}
        onClose={() => setIsCatalogScanOpen(false)}
        onScan={handleCatalogBarcodeScan}
        title="Pindai Barcode Produk Katalog"
        description="Arahkan kamera ke barcode kemasan barang untuk membuka riwayat harganya"
      />

      {/* Price Check Barcode Scanner Modal (Tab 2) */}
      <ScanBarcodeModal
        isOpen={isPriceCheckScanOpen}
        onClose={() => setIsPriceCheckScanOpen(false)}
        onScan={handlePriceCheckBarcodeScan}
        title="Pindai Barcode Cek Harga"
        description="Arahkan kamera ke barcode rak atau kemasan barang di toko tanpa mengetik nama barang"
      />
    </div>
  );
}

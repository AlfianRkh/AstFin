import React, { useState, useEffect } from "react";
import { api } from "../../api/client";
import { OSMMapPicker } from "../OSMMapPicker";
import { AddStoreModal } from "./AddStoreModal";
import { ScanBarcodeModal } from "./ScanBarcodeModal";
import { FRUIT_EXPIRY_DATABASE } from "../../utils/fruitExpiryHelper";
import { getImageUrl } from "../../api/client";

export function RecordPriceModal({
  isOpen,
  onClose,
  existingProduct = null,
  onSuccess = () => {},
}) {
  // Product info
  const [name, setName] = useState(existingProduct?.name || "");
  const [categoryId, setCategoryId] = useState(existingProduct?.category_id || "");
  const [categories, setCategories] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [barcode, setBarcode] = useState(existingProduct?.barcode || "");
  const [imageUrl, setImageUrl] = useState(existingProduct?.image_url || "");
  const [isBarcodeScanOpen, setIsBarcodeScanOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Entry info
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState([]);
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);

  const [entryType, setEntryType] = useState("observation"); // observation | purchase
  const [purchaseUnit, setPurchaseUnit] = useState("pcs");
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [unitsPerPackage, setUnitsPerPackage] = useState("");
  const [priceTotal, setPriceTotal] = useState("");
  const [discountType, setDiscountType] = useState("amount"); // amount | percent
  const [discountValue, setDiscountValue] = useState("");

  // Location
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [addressText, setAddressText] = useState("");

  // Meta
  const [observedAt, setObservedAt] = useState(new Date().toISOString().split("T")[0]);
  const [expiryDate, setExpiryDate] = useState("");
  const [storageType, setStorageType] = useState("room"); // room | chiller | freezer
  const [expiryIsEstimated, setExpiryIsEstimated] = useState(false);
  const [notes, setNotes] = useState("");
  const [shareToCommunity, setShareToCommunity] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Determine if unit is packaging needing "units_per_package"
  const isPackagingUnit = [
    "kardus", "pack", "dus", "lusin", "renceng", "tray", "karton", "box", "ikat"
  ].includes(purchaseUnit.toLowerCase());

  // Function to detect current user GPS and reverse geocode
  const detectCurrentGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        try {
          const res = await api.reverseGeo(latitude, longitude);
          const display = res.display_name || `Lokasi Terkini (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
          setAddressText(display);
        } catch {
          setAddressText(`Lokasi Terkini (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
        }
      },
      (err) => {
        console.warn("GPS lookup error:", err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Load initial reference data: categories, stores, existing products
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        const [catsRes, storesRes, prodsRes] = await Promise.all([
          api.getPriceCategories(),
          api.getStores(),
          api.getPriceProducts(),
        ]);
        if (Array.isArray(catsRes?.data)) setCategories(catsRes.data);
        if (Array.isArray(storesRes?.data)) {
          setStores(storesRes.data);
          if (storesRes.data.length > 0 && !storeId) {
            const firstStore = storesRes.data[0];
            setStoreId(firstStore.id);
            if (firstStore.lat && firstStore.lng) {
              // Mengikuti by data toko
              setLat(firstStore.lat);
              setLng(firstStore.lng);
              setAddressText(firstStore.address_text || firstStore.name);
            } else {
              // Jika data toko belum memiliki koordinat (kosong/baru), default pakai GPS terkini!
              detectCurrentGPS();
            }
          } else if (!storeId) {
            // Belum ada toko sama sekali (masih baru), langsung deteksi GPS terkini
            detectCurrentGPS();
          }
        } else {
          detectCurrentGPS();
        }
        if (Array.isArray(prodsRes?.data)) setAllProducts(prodsRes.data);
      } catch (err) {
        // Silently catch
      }
    };

    loadData();

    if (existingProduct) {
      setName(existingProduct.name);
      setCategoryId(existingProduct.category_id || "");
      setPurchaseUnit(existingProduct.base_unit || "pcs");
      setBarcode(existingProduct.barcode || "");
      setImageUrl(existingProduct.image_url || "");
    } else {
      setName("");
      setCategoryId("");
      setPurchaseUnit("pcs");
      setPriceTotal("");
      setDiscountValue("");
      setUnitsPerPackage("");
      setBarcode("");
      setImageUrl("");
    }
  }, [isOpen, existingProduct]);

  // When store changes, auto-fill store location if available, otherwise default to current GPS
  const handleStoreChange = (e) => {
    const sId = parseInt(e.target.value, 10);
    setStoreId(sId || "");
    const selected = stores.find((s) => s.id === sId);
    if (selected && selected.lat && selected.lng) {
      // Mengikuti data toko yang dipilih
      setLat(selected.lat);
      setLng(selected.lng);
      setAddressText(selected.address_text || selected.name);
    } else {
      // Jika toko tidak memiliki koordinat lokasi tersimpan, otomatis ambil GPS terkini
      detectCurrentGPS();
    }
  };

  // Product Autocomplete
  const handleNameChange = (val) => {
    setName(val);
    if (val.trim().length > 1 && !existingProduct) {
      const match = allProducts.filter((p) =>
        p.name.toLowerCase().includes(val.toLowerCase())
      );
      setProductSuggestions(match.slice(0, 5));
    } else {
      setProductSuggestions([]);
    }

    // Auto-detect expiry estimate for fruit if matching
    const fruitItem = FRUIT_EXPIRY_DATABASE.find(
      (f) => f.name.toLowerCase() === val.trim().toLowerCase() || f.aliases.some((a) => a.toLowerCase() === val.trim().toLowerCase())
    );
    if (fruitItem) {
      const days = fruitItem.shelfLife?.room_temp?.ripe || 4;
      const target = new Date();
      target.setDate(target.getDate() + days);
      setExpiryDate(target.toISOString().split("T")[0]);
      setExpiryIsEstimated(true);
    }
  };

  const handleSelectProduct = (p) => {
    setName(p.name);
    setCategoryId(p.category_id || "");
    setPurchaseUnit(p.base_unit || "pcs");
    if (p.barcode) setBarcode(p.barcode);
    if (p.image_url) setImageUrl(p.image_url);
    setProductSuggestions([]);
  };

  const handleBarcodeScanned = (scannedCode) => {
    setBarcode(scannedCode);
    const match = allProducts.find(
      (p) => (p.barcode && p.barcode.toLowerCase() === scannedCode.toLowerCase())
    );
    if (match) {
      setName(match.name);
      setCategoryId(match.category_id || "");
      setPurchaseUnit(match.base_unit || "pcs");
      if (match.image_url) setImageUrl(match.image_url);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const res = await api.uploadImage(file);
      if (res.url) setImageUrl(res.url);
    } catch (err) {
      alert("Gagal mengunggah gambar: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Auto calculate estimated expiry when category or storage type changes
  useEffect(() => {
    if (!categoryId) return;
    const cat = categories.find((c) => c.id === parseInt(categoryId, 10));
    if (cat) {
      let days = 7;
      if (storageType === "room") days = cat.shelf_life_room_days || 3;
      if (storageType === "chiller") days = cat.shelf_life_chiller_days || 7;
      if (storageType === "freezer") days = cat.shelf_life_freezer_days || 30;

      if (days > 0) {
        const d = new Date(observedAt || new Date());
        d.setDate(d.getDate() + days);
        setExpiryDate(d.toISOString().split("T")[0]);
        setExpiryIsEstimated(true);
      }
    }
  }, [categoryId, storageType, observedAt]);

  // Live Calculations
  const numericPriceTotal = parseFloat(priceTotal) || 0;
  const numericDiscountVal = parseFloat(discountValue) || 0;
  const numericQty = parseFloat(purchaseQty) || 1;
  const numericUnitsPerPkg = parseFloat(unitsPerPackage) || 0;

  let calculatedDiscountAmount = 0;
  if (discountType === "percent") {
    calculatedDiscountAmount = numericPriceTotal * (Math.min(numericDiscountVal, 100) / 100);
  } else {
    calculatedDiscountAmount = Math.min(numericDiscountVal, numericPriceTotal);
  }

  const calculatedPriceFinal = Math.max(0, numericPriceTotal - calculatedDiscountAmount);

  let calculatedTotalUnits = numericQty;
  if (isPackagingUnit && numericUnitsPerPkg > 0) {
    calculatedTotalUnits = numericQty * numericUnitsPerPkg;
  } else if (purchaseUnit === "lusin") {
    calculatedTotalUnits = numericQty * 12;
  }

  const calculatedPricePerUnit = calculatedTotalUnits > 0 ? calculatedPriceFinal / calculatedTotalUnits : 0;

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama barang wajib diisi");
      return;
    }
    if (numericPriceTotal <= 0) {
      setError("Harga barang harus lebih dari 0");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        store_id: storeId ? parseInt(storeId, 10) : null,
        entry_type: entryType,
        purchase_unit: purchaseUnit,
        purchase_qty: numericQty,
        units_per_package: isPackagingUnit && numericUnitsPerPkg > 0 ? numericUnitsPerPkg : null,
        price_total: numericPriceTotal,
        discount_type: discountType,
        discount_value: numericDiscountVal,
        lat: lat || null,
        lng: lng || null,
        address_text: addressText,
        observed_at: observedAt,
        notes: notes.trim(),
        share_to_community: shareToCommunity,
        expiry_date: expiryDate || null,
        expiry_is_estimated: expiryIsEstimated,
        storage_type: storageType,
      };

      if (existingProduct) {
        // Add entry to existing product
        await api.addPriceEntry(existingProduct.id, payload);
      } else {
        // Create product + initial entry
        await api.createPriceProduct({
          name: name.trim(),
          category_id: categoryId ? parseInt(categoryId, 10) : null,
          base_unit: isPackagingUnit ? "pcs" : purchaseUnit,
          barcode: barcode.trim(),
          image_url: imageUrl.trim(),
          ...payload,
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Gagal menyimpan pengamatan harga");
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (val) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
        <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[92vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-outline-variant/15 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">price_change</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-on-surface">
                  {existingProduct ? `Catat Harga: ${existingProduct.name}` : "Input Pembelian / Pengamatan Harga"}
                </h3>
                <p className="text-xs text-outline-variant">
                  {existingProduct
                    ? "Bandingkan harga di lokasi atau waktu berbeda untuk produk ini"
                    : "Catat harga pasar, minimarket, supermarket, atau pedagang keliling"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-surface-container text-outline-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* Product Name & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-outline-variant uppercase tracking-wider">
                    Nama Barang *
                  </label>
                  {!existingProduct && (
                    <button
                      type="button"
                      onClick={() => setIsBarcodeScanOpen(true)}
                      className="text-[11px] font-bold text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">barcode_scanner</span>
                      <span>Scan Barcode</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  disabled={!!existingProduct}
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Contoh: Telur Ayam Negeri, Apel Fuji"
                  className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary/80 transition-colors disabled:opacity-60"
                />

                {barcode && (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-primary">
                    <span className="material-symbols-outlined text-[13px]">qr_code</span>
                    <span>Barcode: <strong>{barcode}</strong></span>
                  </div>
                )}

                {/* Suggestions Dropdown */}
                {productSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-surface-container-highest border border-outline-variant/40 rounded-xl overflow-hidden shadow-2xl z-30">
                    <div className="px-3 py-1.5 bg-surface-container text-[10px] text-outline-variant font-bold uppercase tracking-wider">
                      Produk Yang Pernah Dicatat
                    </div>
                    {productSuggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-surface-container text-on-surface border-b border-outline-variant/10 last:border-b-0 flex items-center justify-between"
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {p.category_name || "Lainnya"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1">
                  Kategori Barang
                </label>
                <select
                  disabled={!!existingProduct}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-colors disabled:opacity-60"
                >
                  <option value="">Pilih Kategori...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Qty, Unit, and Packaging Converter */}
            <div className="bg-surface-container/40 border border-outline-variant/20 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-outline-variant uppercase tracking-wider">
                  Kuantitas & Satuan Beli
                </span>
                <span className="text-[11px] text-primary font-medium">
                  Basis Komparasi: <strong className="uppercase">{isPackagingUnit ? "pcs" : purchaseUnit}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-outline-variant mb-1">Jumlah Beli</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={purchaseQty}
                    onChange={(e) => setPurchaseQty(e.target.value)}
                    className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-outline-variant mb-1">Satuan Beli</label>
                  <select
                    value={purchaseUnit}
                    onChange={(e) => setPurchaseUnit(e.target.value)}
                    className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-colors"
                  >
                    <optgroup label="Satuan Lepas / Berat">
                      <option value="pcs">Pcs / Butir / Buah</option>
                      <option value="kg">Kilogram (kg)</option>
                      <option value="gram">Gram (gr)</option>
                      <option value="liter">Liter (L)</option>
                      <option value="ikat">Ikat</option>
                    </optgroup>
                    <optgroup label="Kemasan / Grosir">
                      <option value="kardus">Kardus / Karton</option>
                      <option value="pack">Pack / Kantong</option>
                      <option value="dus">Dus / Box</option>
                      <option value="lusin">Lusin (12 pcs)</option>
                      <option value="renceng">Renceng</option>
                      <option value="tray">Tray (Telur)</option>
                    </optgroup>
                  </select>
                </div>

                {/* Packaging count prompt if unit is packaging */}
                <div className={`${isPackagingUnit ? "col-span-2 sm:col-span-1" : "hidden"}`}>
                  <label className="block text-[11px] text-amber-300 font-medium mb-1">
                    Isi per {purchaseUnit} (pcs) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="Misal: 24 atau 30"
                    value={unitsPerPackage}
                    onChange={(e) => setUnitsPerPackage(e.target.value)}
                    className="w-full bg-amber-500/10 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-200 placeholder:text-amber-300/40 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>
              </div>

              {isPackagingUnit && (
                <p className="text-[11px] text-outline-variant bg-surface-container-lowest/60 px-3 py-1.5 rounded-lg border border-outline-variant/15">
                  💡 Konversi: <strong>{purchaseQty} {purchaseUnit}</strong> ={" "}
                  <strong className="text-primary font-bold">{calculatedTotalUnits} pcs</strong>.
                  Sistem akan otomatis menghitung harga per satuan pcs untuk komparasi adil.
                </p>
              )}
            </div>

            {/* Price & Discount Input */}
            <div className="bg-surface-container/40 border border-outline-variant/20 rounded-2xl p-3.5 space-y-3">
              <span className="text-xs font-semibold text-outline-variant uppercase tracking-wider block">
                Harga & Diskon
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-outline-variant mb-1">Harga Total Barang (Rp) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="Contoh: 35000"
                    value={priceTotal}
                    onChange={(e) => setPriceTotal(e.target.value)}
                    className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary/80 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-outline-variant mb-1">Tipe Diskon</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-colors"
                  >
                    <option value="amount">Nominal (Rp)</option>
                    <option value="percent">Persentase (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-outline-variant mb-1">
                    Nilai Diskon {discountType === "percent" ? "(%)" : "(Rp)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={discountType === "percent" ? "Misal: 10" : "Misal: 2500"}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-colors"
                  />
                </div>
              </div>

              {/* Live Preview Card */}
              {numericPriceTotal > 0 && (
                <div className="bg-gradient-to-r from-primary/10 via-emerald-500/5 to-transparent border border-primary/25 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-outline-variant uppercase tracking-wider block">
                      Harga Bersih (Net)
                    </span>
                    <strong className="text-sm font-bold text-emerald-400">
                      {formatRupiah(calculatedPriceFinal)}
                    </strong>
                    {calculatedDiscountAmount > 0 && (
                      <span className="text-[10px] text-outline-variant ml-1 line-through">
                        {formatRupiah(numericPriceTotal)}
                      </span>
                    )}
                  </div>

                  <div className="border-l border-outline-variant/20 pl-3">
                    <span className="text-[10px] text-outline-variant uppercase tracking-wider block">
                      Harga Satuan Bersih
                    </span>
                    <strong className="text-sm font-bold text-primary">
                      {formatRupiah(calculatedPricePerUnit)} / {isPackagingUnit ? "pcs" : purchaseUnit}
                    </strong>
                  </div>

                  <div className="text-[10px] text-outline-variant border-l border-outline-variant/20 pl-3">
                    Total Unit Dasar: <strong>{calculatedTotalUnits} {isPackagingUnit ? "pcs" : purchaseUnit}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Store Selection & Map Location */}
            <div className="bg-surface-container/40 border border-outline-variant/20 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-outline-variant uppercase tracking-wider">
                  Toko & Lokasi Pengamatan
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddStoreOpen(true)}
                  className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">add_business</span>
                  <span>+ Toko Baru</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-outline-variant mb-1">Pilih Toko dari Database</label>
                  <select
                    value={storeId}
                    onChange={handleStoreChange}
                    className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-colors"
                  >
                    <option value="">-- Tanpa Nama Toko Spesifik --</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.store_type}) {s.is_mobile ? "🛵 Keliling" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-outline-variant mb-1">Tanggal Pengamatan *</label>
                  <input
                    type="date"
                    required
                    value={observedAt}
                    onChange={(e) => setObservedAt(e.target.value)}
                    className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-colors"
                  />
                </div>
              </div>

              {/* Map Component */}
              <div>
                <label className="block text-[11px] text-outline-variant mb-1">
                  Peta Lokasi (OpenStreetMap)
                </label>
                <OSMMapPicker
                  lat={lat}
                  lng={lng}
                  addressText={addressText}
                  initialLat={lat || -7.4478}
                  initialLng={lng || 112.7183}
                  initialAddress={addressText}
                  autoDetectGPSIfEmpty={true}
                  onLocationChange={({ lat: newLat, lng: newLng, addressText: newAddr }) => {
                    setLat(newLat);
                    setLng(newLng);
                    setAddressText(newAddr);
                  }}
                  height="200px"
                />
              </div>
            </div>

            {/* Shelf Life & Storage */}
            <div className="bg-surface-container/40 border border-outline-variant/20 rounded-2xl p-3.5 space-y-3">
              <span className="text-xs font-semibold text-outline-variant uppercase tracking-wider block">
                Estimasi Kedaluwarsa & Penyimpanan (Sayur/Buah/Telur)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-outline-variant mb-1">Penyimpanan</label>
                  <select
                    value={storageType}
                    onChange={(e) => setStorageType(e.target.value)}
                    className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-colors"
                  >
                    <option value="room">Suhu Ruang</option>
                    <option value="chiller">Kulkas / Chiller</option>
                    <option value="freezer">Freezer / Beku</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-outline-variant mb-1">Estimasi Exp Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => {
                      setExpiryDate(e.target.value);
                      setExpiryIsEstimated(false);
                    }}
                    className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-colors"
                  />
                </div>

                <div className="flex items-center sm:pt-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={shareToCommunity}
                      onChange={(e) => setShareToCommunity(e.target.checked)}
                      className="rounded border-outline-variant/40 text-primary focus:ring-primary w-4 h-4 bg-surface-container-highest"
                    />
                    <span className="text-xs text-on-surface font-medium">
                      Bagikan ke Komunitas Sidoarjo
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Promo jumat berkah, ukuran telur besar-besar, kualitas segar..."
                className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3.5 py-2 text-xs text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary/80 transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-outline-variant/30 text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-md shadow-primary/20 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : (
                  <span>{existingProduct ? "Simpan Perbandingan Lokasi" : "Simpan Harga Barang"}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Add Store Modal Sub-component */}
      <AddStoreModal
        isOpen={isAddStoreOpen}
        onClose={() => setIsAddStoreOpen(false)}
        onStoreCreated={(newStore) => {
          setStores((prev) => [...prev, newStore]);
          setStoreId(newStore.id);
          if (newStore.lat && newStore.lng) {
            setLat(newStore.lat);
            setLng(newStore.lng);
            setAddressText(newStore.address_text || newStore.name);
          }
        }}
      />

      {/* Barcode Scanner Modal */}
      <ScanBarcodeModal
        isOpen={isBarcodeScanOpen}
        onClose={() => setIsBarcodeScanOpen(false)}
        onScan={handleBarcodeScanned}
        title="Pindai Barcode Produk"
        description="Arahkan kamera ke barcode kemasan barang"
      />
    </>
  );
}

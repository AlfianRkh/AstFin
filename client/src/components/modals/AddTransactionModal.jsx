import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { api, getImageUrl } from "../../api/client";
import { ScanBarcodeModal } from "./ScanBarcodeModal";
import { AddStoreModal } from "./AddStoreModal";

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

const PACKAGING_UNITS = [
  "kardus", "pack", "dus", "lusin", "renceng", "tray", "karton", "box", "ikat"
];

const STORE_TYPE_LABELS = {
  minimarket: "Minimarket",
  supermarket: "Supermarket",
  pasar: "Pasar",
  tukang_sayur: "Tukang Sayur",
  grosir: "Grosir",
  warung: "Warung",
  online: "Online",
};

const getStoreIcon = (stType) => {
  switch (stType) {
    case "minimarket":
      return "shopping_cart";
    case "supermarket":
      return "domain";
    case "pasar":
      return "storefront";
    case "tukang_sayur":
      return "local_shipping";
    case "grosir":
      return "inventory";
    case "warung":
      return "store";
    case "online":
      return "language";
    default:
      return "storefront";
  }
};

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
  const [stores, setStores] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [isCustomStore, setIsCustomStore] = useState(false);
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.toISOString().split("T")[0];
  });
  const [loading, setLoading] = useState(false);

  // Product Selection & New Product Creation state (Khusus Belanja / Pengeluaran)
  const [productList, setProductList] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [productSelectionMode, setProductSelectionMode] = useState("manual"); // "catalog" | "manual"
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProductObj, setSelectedProductObj] = useState(null);
  const [productQty, setProductQty] = useState(1);
  const [manualProductName, setManualProductName] = useState("");
  const [saveAsNewProduct, setSaveAsNewProduct] = useState(false);
  const [newProductData, setNewProductData] = useState({
    category_id: "",
    purchase_unit: "pcs",
    purchase_qty: 1,
    units_per_package: "",
    discount_type: "amount", // "amount" | "percent"
    discount_value: "",
    storage_type: "room", // "room" | "chiller" | "freezer"
    expiry_date: "",
    expiry_is_estimated: false,
    barcode: "",
    image_url: "",
    notes: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isBarcodeScanOpen, setIsBarcodeScanOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Search & Debounce state (Limit 10 Product, Debounce 3 detik)
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [isDebouncingProductSearch, setIsDebouncingProductSearch] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const searchDebounceTimerRef = useRef(null);
  const productSearchContainerRef = useRef(null);

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

  // Fetch product catalog & product categories from database
  const fetchProductsAndCategories = useCallback(async () => {
    try {
      const [prodsRes, catsRes] = await Promise.all([
        api.getPriceProducts(),
        api.getPriceCategories(),
      ]);
      setProductList(Array.isArray(prodsRes?.data) ? prodsRes.data : []);
      setProductCategories(Array.isArray(catsRes?.data) ? catsRes.data : []);
    } catch (err) {
      console.warn("Gagal memuat katalog produk:", err);
    }
  }, []);

  // Fetch 10 toko default dari database untuk dropdown
  const fetchStores = useCallback(async () => {
    setLoadingStores(true);
    try {
      const res = await api.getStores({ limit: 10 });
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setStores(list.slice(0, 10));
    } catch (err) {
      console.warn("Gagal memuat 10 toko dari database:", err);
    } finally {
      setLoadingStores(false);
    }
  }, []);

  const handleStoreCreated = (newStore) => {
    if (!newStore) return;
    setStores((prev) => [newStore, ...prev.filter((s) => s.id !== newStore.id)].slice(0, 10));
    setSelectedStoreId(String(newStore.id));
    setMerchant(newStore.name);
    setIsCustomStore(false);
  };

  // Fetch 10 produk terbaru untuk pencarian cepat
  const fetchRecentProducts = useCallback(async () => {
    try {
      setIsSearchingProduct(true);
      const res = await api.getPriceProducts({ limit: 10 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setProductSearchResults(list);
    } catch (err) {
      console.warn("Gagal memuat 10 produk terbaru:", err);
    } finally {
      setIsSearchingProduct(false);
    }
  }, []);

  // Tutup dropdown pencarian produk saat klik di luar
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        productSearchContainerRef.current &&
        !productSearchContainerRef.current.contains(event.target)
      ) {
        setIsProductDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Auto calculate estimated expiry date ketika kategori produk atau suhu penyimpanan dipilih
  useEffect(() => {
    if (!newProductData.category_id) return;
    const cat = productCategories.find((c) => String(c.id) === String(newProductData.category_id));
    if (cat) {
      let days = 7;
      if (newProductData.storage_type === "room") days = cat.shelf_life_room_days || 3;
      if (newProductData.storage_type === "chiller") days = cat.shelf_life_chiller_days || 7;
      if (newProductData.storage_type === "freezer") days = cat.shelf_life_freezer_days || 30;

      if (days > 0) {
        const d = new Date(date || new Date());
        d.setDate(d.getDate() + days);
        setNewProductData((prev) => ({
          ...prev,
          expiry_date: d.toISOString().split("T")[0],
          expiry_is_estimated: true,
        }));
      }
    }
  }, [newProductData.category_id, newProductData.storage_type, date, productCategories]);

  // When modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      fetchWallets();
      fetchCategories();
      fetchProductsAndCategories();
      fetchRecentProducts();
      fetchStores();

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
        setSelectedStoreId("");
        setIsCustomStore(false);
        setNotes("");
        setSelectedProductId("");
        setSelectedProductObj(null);
        setManualProductName("");
        setSaveAsNewProduct(false);
        setProductQty(1);
        setProductSearchQuery("");
        setIsProductDropdownOpen(false);
        setIsDebouncingProductSearch(false);
        if (searchDebounceTimerRef.current) {
          clearTimeout(searchDebounceTimerRef.current);
        }
        setNewProductData({
          category_id: "",
          purchase_unit: "pcs",
          purchase_qty: 1,
          units_per_package: "",
          discount_type: "amount",
          discount_value: "",
          storage_type: "room",
          expiry_date: "",
          expiry_is_estimated: false,
          barcode: "",
          image_url: "",
          notes: "",
        });
      }
    }
  }, [isOpen, initialData, fetchWallets, fetchCategories, fetchProductsAndCategories, fetchRecentProducts, fetchStores]);

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
    setSelectedProductId("");
    setSelectedProductObj(null);
    setManualProductName("");
    setSaveAsNewProduct(false);
  };

  // Handle focus pada input search produk: jika belum input kata, muat 10 produk terbaru
  const handleProductSearchFocus = () => {
    setIsProductDropdownOpen(true);
    if (!productSearchQuery.trim()) {
      fetchRecentProducts();
    }
  };

  // Handle perubahan input search produk dengan jeda/debounce 3 detik
  const handleProductSearchChange = (e) => {
    const val = e.target.value;
    setProductSearchQuery(val);
    setIsProductDropdownOpen(true);

    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    if (!val.trim()) {
      setIsDebouncingProductSearch(false);
      fetchRecentProducts();
      return;
    }

    // Jeda 3 detik jika tidak ada perubahan inputan maka jalankan query search limit 10
    setIsDebouncingProductSearch(true);
    searchDebounceTimerRef.current = setTimeout(async () => {
      setIsDebouncingProductSearch(false);
      setIsSearchingProduct(true);
      try {
        const res = await api.getPriceProducts({ q: val.trim(), limit: 10 });
        setProductSearchResults(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        console.warn("Gagal mencari produk:", err);
      } finally {
        setIsSearchingProduct(false);
      }
    }, 3000);
  };

  // Handler memilih produk dari dropdown hasil search limit 10
  const handleSelectProductItem = (chosen) => {
    if (!chosen) return;
    setSelectedProductId(String(chosen.id));
    setSelectedProductObj(chosen);
    setIsProductDropdownOpen(false);
    setProductSearchQuery("");
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    setIsDebouncingProductSearch(false);

    if (chosen.last_price_per_unit > 0) {
      setAmount(String(chosen.last_price_per_unit * productQty));
    }
    if (chosen.cheapest_store_name && !merchant) {
      setMerchant(chosen.cheapest_store_name);
    }
    setNotes(`${chosen.name} (${productQty} ${chosen.base_unit || "pcs"})`);
    if (category === DEFAULT_EXPENSE_CATEGORIES[0]) {
      setCategory("Belanja Dapur & Groceries");
    }
  };

  const handleDeselectProduct = () => {
    setSelectedProductId("");
    setSelectedProductObj(null);
  };

  const handleSwitchToManual = (initialName = "") => {
    setProductSelectionMode("manual");
    setSelectedProductId("");
    setSelectedProductObj(null);
    setIsProductDropdownOpen(false);
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    setIsDebouncingProductSearch(false);
    if (initialName) {
      setManualProductName(initialName);
      if (!notes) setNotes(initialName);
    }
    setSaveAsNewProduct(true);
  };

  const handleProductQtyChange = (qty) => {
    const clamped = Math.max(1, qty);
    setProductQty(clamped);
    const chosen = selectedProductObj || productList.find((p) => String(p.id) === String(selectedProductId)) || productSearchResults.find((p) => String(p.id) === String(selectedProductId));
    if (chosen && chosen.last_price_per_unit > 0) {
      setAmount(String(chosen.last_price_per_unit * clamped));
      setNotes(`${chosen.name} (${clamped} ${chosen.base_unit || "pcs"})`);
    }
  };

  // Handler for uploading product photo
  const handleProductImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const res = await api.uploadImage(file);
      if (res.url) {
        setNewProductData((prev) => ({ ...prev, image_url: res.url }));
      }
    } catch (err) {
      alert("Gagal mengunggah foto produk: " + err.message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Konversi Kemasan & Harga Satuan untuk Produk Baru (Input Manual)
  const isNewProductPackaging = useMemo(() => {
    return PACKAGING_UNITS.includes((newProductData.purchase_unit || "pcs").toLowerCase());
  }, [newProductData.purchase_unit]);

  const numericNewProductQty = useMemo(() => {
    return Math.max(0.01, parseFloat(newProductData.purchase_qty) || 1);
  }, [newProductData.purchase_qty]);

  const numericUnitsPerPkg = useMemo(() => {
    return parseFloat(newProductData.units_per_package) || 0;
  }, [newProductData.units_per_package]);

  const calculatedNewProductTotalUnits = useMemo(() => {
    if (isNewProductPackaging && numericUnitsPerPkg > 0) {
      return numericNewProductQty * numericUnitsPerPkg;
    }
    if ((newProductData.purchase_unit || "").toLowerCase() === "lusin") {
      return numericNewProductQty * (numericUnitsPerPkg > 0 ? numericUnitsPerPkg : 12);
    }
    return numericNewProductQty;
  }, [isNewProductPackaging, numericUnitsPerPkg, numericNewProductQty, newProductData.purchase_unit]);

  // Kalkulasi Diskon & Harga Satuan Bersih (Net)
  const numericPriceTotal = parseFloat(amount) || 0;
  const numericDiscountVal = parseFloat(newProductData.discount_value) || 0;

  const calculatedDiscountAmount = useMemo(() => {
    if (newProductData.discount_type === "percent") {
      return numericPriceTotal * (Math.min(numericDiscountVal, 100) / 100);
    }
    return Math.min(numericDiscountVal, numericPriceTotal);
  }, [numericPriceTotal, newProductData.discount_type, numericDiscountVal]);

  const calculatedPriceFinal = useMemo(() => {
    return Math.max(0, numericPriceTotal - calculatedDiscountAmount);
  }, [numericPriceTotal, calculatedDiscountAmount]);

  const calculatedPricePerUnit = useMemo(() => {
    if (calculatedNewProductTotalUnits > 0 && calculatedPriceFinal > 0) {
      return calculatedPriceFinal / calculatedNewProductTotalUnits;
    }
    return 0;
  }, [calculatedPriceFinal, calculatedNewProductTotalUnits]);

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
      // 1. Jika mode manual dan user mencentang 'Simpan Product', simpan produk baru ke katalog
      if (type === "expense" && productSelectionMode === "manual" && saveAsNewProduct && manualProductName.trim()) {
        try {
          const isPackaging = PACKAGING_UNITS.includes((newProductData.purchase_unit || "pcs").toLowerCase());
          const pQty = Math.max(0.01, parseFloat(newProductData.purchase_qty) || 1);
          let uPkg = parseFloat(newProductData.units_per_package);
          if ((!uPkg || uPkg <= 0) && (newProductData.purchase_unit || "").toLowerCase() === "lusin") {
            uPkg = 12;
          }

          await api.createPriceProduct({
            name: manualProductName.trim(),
            category_id: newProductData.category_id ? parseInt(newProductData.category_id, 10) : null,
            base_unit: isPackaging ? "pcs" : (newProductData.purchase_unit || "pcs"),
            barcode: newProductData.barcode.trim(),
            image_url: newProductData.image_url.trim(),
            product_notes: newProductData.notes.trim(),
            purchase_unit: newProductData.purchase_unit || "pcs",
            purchase_qty: pQty,
            units_per_package: isPackaging && uPkg > 0 ? uPkg : null,
            price_total: parseFloat(amount) || 0,
            discount_type: newProductData.discount_type || "amount",
            discount_value: parseFloat(newProductData.discount_value) || 0,
            storage_type: newProductData.storage_type || "room",
            expiry_date: newProductData.expiry_date || null,
            expiry_is_estimated: Boolean(newProductData.expiry_is_estimated),
            store_id: selectedStoreId ? parseInt(selectedStoreId, 10) : null,
            address_text: merchant.trim(),
            entry_type: "purchase",
            observed_at: date,
          });
        } catch (errProd) {
          console.warn("Gagal menyimpan produk baru ke database:", errProd);
        }
      }

      // 2. Jika mode katalog dan produk dipilih, catat entri harga ke produk tersebut
      if (type === "expense" && productSelectionMode === "catalog" && selectedProductId) {
        try {
          const chosen = selectedProductObj || productList.find((p) => String(p.id) === String(selectedProductId)) || productSearchResults.find((p) => String(p.id) === String(selectedProductId));
          if (chosen) {
            await api.addPriceEntry(chosen.id, {
              store_id: selectedStoreId ? parseInt(selectedStoreId, 10) : null,
              entry_type: "purchase",
              purchase_unit: chosen.base_unit || "pcs",
              purchase_qty: parseFloat(productQty) || 1,
              price_total: parseFloat(amount) || 0,
              address_text: merchant.trim(),
              observed_at: date,
            });
          }
        } catch (errEntry) {
          console.warn("Gagal menambahkan entri harga ke produk:", errEntry);
        }
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl p-5 sm:p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface max-h-[92vh] overflow-y-auto">
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

          {/* Opsi Memilih Product dari List atau Input Manual (Khusus Pengeluaran) */}
          {type === "expense" && !isFromRadar && (
            <div className="bg-surface-container-low/70 p-3.5 rounded-xl border border-outline-variant/20 flex flex-col gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[18px]">inventory_2</span>
                  <span>Produk / Barang yang Dibeli (Opsional)</span>
                </div>
                {/* Mode Toggle: Search vs Manual */}
                <div className="flex items-center p-0.5 bg-surface-container rounded-lg border border-outline-variant/20 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setProductSelectionMode("catalog");
                      setSaveAsNewProduct(false);
                      fetchRecentProducts();
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                      productSelectionMode === "catalog"
                        ? "bg-primary text-on-primary shadow-xs"
                        : "text-outline hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">search</span>
                    <span>Cari Produk (Limit 10)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProductSelectionMode("manual");
                      setSelectedProductId("");
                      setSelectedProductObj(null);
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                      productSelectionMode === "manual"
                        ? "bg-primary text-on-primary shadow-xs"
                        : "text-outline hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">edit_note</span>
                    <span>Input Manual</span>
                  </button>
                </div>
              </div>

              {/* Mode 1: Cari Produk dari Katalog (Search & Limit 10) */}
              {productSelectionMode === "catalog" && (
                <div className="space-y-2">
                  {selectedProductId ? (
                    (() => {
                      const selectedProduct = selectedProductObj || productList.find((p) => String(p.id) === String(selectedProductId)) || productSearchResults.find((p) => String(p.id) === String(selectedProductId));
                      if (!selectedProduct) return null;
                      return (
                        <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {selectedProduct.image_url ? (
                              <img
                                src={getImageUrl(selectedProduct.image_url)}
                                alt={selectedProduct.name}
                                className="w-11 h-11 rounded-lg object-cover border border-primary/30 shrink-0"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                <span className="material-symbols-outlined text-2xl">shopping_basket</span>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] text-primary font-bold uppercase tracking-wider block">
                                {selectedProduct.category_name || "Produk Katalog"}
                              </span>
                              <strong className="text-xs text-on-surface block truncate">
                                {selectedProduct.name}
                              </strong>
                              <span className="text-[10px] text-outline block">
                                Satuan: {selectedProduct.base_unit || "pcs"} {selectedProduct.last_price_per_unit > 0 ? `· Rp ${Number(selectedProduct.last_price_per_unit).toLocaleString("id-ID")}` : ""} {selectedProduct.cheapest_store_name ? `(${selectedProduct.cheapest_store_name})` : ""}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Qty Counter */}
                            <div className="flex items-center bg-surface-container rounded-lg border border-outline-variant/30 p-0.5 text-xs">
                              <button
                                type="button"
                                disabled={productQty <= 1}
                                onClick={() => handleProductQtyChange(productQty - 1)}
                                className="w-6 h-6 flex items-center justify-center text-on-surface hover:bg-surface-bright rounded disabled:opacity-30 transition-colors"
                              >
                                -
                              </button>
                              <span className="w-7 text-center font-bold text-primary text-[12px]">{productQty}</span>
                              <button
                                type="button"
                                onClick={() => handleProductQtyChange(productQty + 1)}
                                className="w-6 h-6 flex items-center justify-center text-on-surface hover:bg-surface-bright rounded transition-colors"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={handleDeselectProduct}
                              className="w-7 h-7 flex items-center justify-center text-outline hover:text-red-400 hover:bg-error-container/20 rounded-lg transition-colors"
                              title="Ganti / Batal Pilih"
                            >
                              <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div ref={productSearchContainerRef} className="relative space-y-1.5">
                      {/* Search Input Box */}
                      <div className="relative flex items-center">
                        <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
                          search
                        </span>
                        <input
                          type="text"
                          value={productSearchQuery}
                          onFocus={handleProductSearchFocus}
                          onChange={handleProductSearchChange}
                          placeholder="Cari nama produk (klik untuk 10 produk terbaru)..."
                          className="w-full bg-surface-container rounded-lg pl-9 pr-28 py-2 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs font-medium placeholder:text-outline"
                        />
                        {/* Status Right Badge / Indicator */}
                        <div className="absolute right-2 flex items-center gap-1.5">
                          {isDebouncingProductSearch && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-secondary/15 text-secondary font-bold animate-pulse border border-secondary/30">
                              <span className="material-symbols-outlined text-[12px]">timer</span>
                              <span>Jeda 3 dtk...</span>
                            </span>
                          )}
                          {isSearchingProduct && !isDebouncingProductSearch && (
                            <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-1"></span>
                          )}
                          {productSearchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setProductSearchQuery("");
                                if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current);
                                setIsDebouncingProductSearch(false);
                                fetchRecentProducts();
                              }}
                              className="text-outline hover:text-on-surface p-0.5"
                              title="Hapus kata kunci"
                            >
                              <span className="material-symbols-outlined text-[16px]">cancel</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Dropdown Popover List (Limit 10 Produk) */}
                      {isProductDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface-container-high rounded-xl border border-outline-variant/40 shadow-2xl z-50 overflow-hidden animate-in fade-in duration-150">
                          {/* Header info */}
                          <div className="px-3 py-1.5 bg-surface-container border-b border-outline-variant/20 flex items-center justify-between text-[10px] text-outline font-semibold">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px] text-primary">
                                {productSearchQuery.trim() ? "search" : "history"}
                              </span>
                              <span>
                                {productSearchQuery.trim()
                                  ? `Hasil Pencarian (Maks. 10):`
                                  : `10 Produk Terbaru:`}
                              </span>
                            </span>
                            <span className="text-secondary font-bold">
                              {productSearchResults.length} Item
                            </span>
                          </div>

                          {/* List of items */}
                          <div className="max-h-64 overflow-y-auto divide-y divide-outline-variant/10">
                            {isSearchingProduct && productSearchResults.length === 0 ? (
                              <div className="p-4 text-center text-xs text-outline flex items-center justify-center gap-2">
                                <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                                <span>Memuat data produk...</span>
                              </div>
                            ) : productSearchResults.length === 0 ? (
                              <div className="p-4 text-center space-y-2">
                                <p className="text-xs text-outline">
                                  {isDebouncingProductSearch
                                    ? "Menunggu jeda 3 detik tanpa ketikan..."
                                    : "Tidak ada produk yang cocok."}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleSwitchToManual(productSearchQuery.trim())}
                                  className="text-[11px] bg-primary text-on-primary font-bold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                                >
                                  + Input Manual & Simpan Produk Ini
                                </button>
                              </div>
                            ) : (
                              productSearchResults.slice(0, 10).map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectProductItem(p)}
                                  className="w-full text-left p-2.5 hover:bg-surface-bright flex items-center justify-between gap-2.5 transition-colors group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {p.image_url ? (
                                      <img
                                        src={getImageUrl(p.image_url)}
                                        alt={p.name}
                                        className="w-9 h-9 rounded-lg object-cover border border-outline-variant/30 shrink-0"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-outline group-hover:text-primary shrink-0">
                                        <span className="material-symbols-outlined text-[18px]">shopping_basket</span>
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-xs text-on-surface truncate group-hover:text-primary">
                                          {p.name}
                                        </span>
                                        {p.category_name && (
                                          <span className="text-[9px] px-1.5 py-0.5 bg-surface-container rounded text-outline border border-outline-variant/20">
                                            {p.category_name}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-outline block truncate mt-0.5">
                                        Satuan: {p.base_unit || "pcs"} {p.last_price_per_unit > 0 ? `· Rp ${Number(p.last_price_per_unit).toLocaleString("id-ID")}` : ""} {p.cheapest_store_name ? `· ${p.cheapest_store_name}` : ""}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 text-[11px] font-bold text-primary opacity-80 group-hover:opacity-100 shrink-0">
                                    <span>Pilih</span>
                                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>

                          {/* Footer */}
                          <div className="p-2 px-3 bg-surface-container border-t border-outline-variant/20 flex items-center justify-between text-[10px]">
                            <span className="text-outline">
                              Tidak menemukan barang yang dicari?
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSwitchToManual(productSearchQuery.trim())}
                              className="text-primary hover:underline font-bold"
                            >
                              + Input Manual
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-outline px-1">
                        <span>Klik search untuk 10 produk terbaru, ketik untuk mencari (jeda 3 dtk).</span>
                        <button
                          type="button"
                          onClick={() => handleSwitchToManual("")}
                          className="text-primary hover:underline font-bold"
                        >
                          + Input Manual
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 2: Input Manual */}
              {productSelectionMode === "manual" && (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-outline uppercase mb-1">
                      Nama Barang / Produk
                    </label>
                    <input
                      type="text"
                      value={manualProductName}
                      onChange={(e) => {
                        setManualProductName(e.target.value);
                        if (!notes || notes === manualProductName) {
                          setNotes(e.target.value);
                        }
                      }}
                      placeholder="Contoh: Beras Ramos 5kg, Telur Ayam 1kg, Kopi..."
                      className="w-full bg-surface-container rounded-lg px-3 py-2 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs"
                    />
                  </div>

                  {/* Checkbox: Simpan Product? */}
                  <div className="pt-0.5">
                    <label className="flex items-start gap-2 cursor-pointer select-none text-xs text-on-surface">
                      <input
                        type="checkbox"
                        checked={saveAsNewProduct}
                        onChange={(e) => setSaveAsNewProduct(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded border-outline-variant/40 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                      />
                      <div>
                        <span className="font-semibold text-primary block leading-tight">
                          Simpan produk ini ke Katalog Produk & Pantauan Harga?
                        </span>
                        <span className="text-[10px] text-outline block leading-tight mt-0.5">
                          Sertakan detail lengkap (kategori, satuan, barcode, dan foto) untuk disimpan permanen.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Detail Input Barangnya (jika Simpan Product dicentang) */}
                  {saveAsNewProduct && (
                    <div className="bg-surface-container/60 p-3 rounded-xl border border-primary/30 space-y-2.5 animate-in fade-in duration-150">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                        Detail Barang Baru:
                      </span>

                      {/* Baris 1: Kategori Produk & Satuan Beli */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-outline uppercase mb-1">
                            Kategori Produk
                          </label>
                          <select
                            value={newProductData.category_id}
                            onChange={(e) => setNewProductData({ ...newProductData, category_id: e.target.value })}
                            className="w-full bg-surface-container-high rounded-lg px-2.5 py-2 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs"
                          >
                            <option value="">Pilih Kategori...</option>
                            {productCategories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-outline uppercase mb-1">
                            Satuan Beli
                          </label>
                          <select
                            value={newProductData.purchase_unit}
                            onChange={(e) => {
                              const newUnit = e.target.value;
                              const isPkg = PACKAGING_UNITS.includes(newUnit.toLowerCase());
                              let defaultUnitsPerPkg = newProductData.units_per_package;
                              if (newUnit === "lusin" && !defaultUnitsPerPkg) {
                                defaultUnitsPerPkg = 12;
                              }
                              setNewProductData((prev) => ({
                                ...prev,
                                purchase_unit: newUnit,
                                units_per_package: isPkg ? defaultUnitsPerPkg : "",
                              }));
                            }}
                            className="w-full bg-surface-container-high rounded-lg px-2.5 py-2 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs font-semibold"
                          >
                            <optgroup label="Satuan Lepas / Berat">
                              <option value="pcs">Pcs / Butir / Buah</option>
                              <option value="kg">Kilogram (kg)</option>
                              <option value="gram">Gram (gr)</option>
                              <option value="liter">Liter (L)</option>
                              <option value="ikat">Ikat</option>
                              <option value="botol">Botol</option>
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
                      </div>

                      {/* Baris 2: Jumlah Beli & Isi Kemasan */}
                      <div className={`grid gap-2.5 ${isNewProductPackaging ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                        <div>
                          <label className="block text-[10px] font-bold text-outline uppercase mb-1">
                            Jumlah Beli (Qty)
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={newProductData.purchase_qty}
                            onChange={(e) => setNewProductData({ ...newProductData, purchase_qty: e.target.value })}
                            className="w-full bg-surface-container-high rounded-lg px-3 py-2 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs font-semibold"
                          />
                        </div>

                        {isNewProductPackaging && (
                          <div>
                            <label className="block text-[10px] font-bold text-amber-300 uppercase mb-1 truncate">
                              Isi per {newProductData.purchase_unit || "Kemasan"} (pcs) *
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="1"
                              placeholder="Misal: 24 atau 30"
                              value={newProductData.units_per_package}
                              onChange={(e) => setNewProductData((prev) => ({ ...prev, units_per_package: e.target.value }))}
                              className="w-full bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-amber-200 placeholder:text-amber-300/40 focus:outline-none focus:border-amber-400 font-bold"
                            />
                          </div>
                        )}
                      </div>

                      {/* Baris 3: Diskon Produk (Nominal / Persen) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-outline uppercase mb-1">
                            Tipe Diskon Barang
                          </label>
                          <select
                            value={newProductData.discount_type}
                            onChange={(e) => setNewProductData({ ...newProductData, discount_type: e.target.value })}
                            className="w-full bg-surface-container-high rounded-lg px-2.5 py-2 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs"
                          >
                            <option value="amount">Potongan Nominal (Rp)</option>
                            <option value="percent">Persentase (%)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-outline uppercase mb-1">
                            Nilai Diskon {newProductData.discount_type === "percent" ? "(%)" : "(Rp)"}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder={newProductData.discount_type === "percent" ? "Contoh: 10" : "Contoh: 5000"}
                            value={newProductData.discount_value}
                            onChange={(e) => setNewProductData({ ...newProductData, discount_value: e.target.value })}
                            className="w-full bg-surface-container-high rounded-lg px-3 py-2 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs font-semibold"
                          />
                        </div>
                      </div>

                      {/* Live Preview Card: Diskon & Harga Satuan Bersih */}
                      {numericPriceTotal > 0 && (
                        <div className="p-3 bg-gradient-to-r from-primary/15 via-emerald-500/10 to-transparent border border-primary/30 rounded-xl text-xs space-y-1.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <span className="text-[9px] text-outline uppercase font-bold tracking-wider block">
                                Harga Bersih (Net)
                              </span>
                              <strong className="text-sm font-bold text-emerald-400">
                                Rp {Math.round(calculatedPriceFinal).toLocaleString("id-ID")}
                              </strong>
                              {calculatedDiscountAmount > 0 && (
                                <span className="text-[10px] text-outline ml-1 line-through">
                                  Rp {Math.round(numericPriceTotal).toLocaleString("id-ID")}
                                </span>
                              )}
                            </div>

                            <div className="text-right">
                              <span className="text-[9px] text-outline uppercase font-bold tracking-wider block">
                                Harga Satuan Bersih
                              </span>
                              <strong className="text-sm font-bold text-primary">
                                Rp {Math.round(calculatedPricePerUnit).toLocaleString("id-ID")} / {isNewProductPackaging ? "pcs" : (newProductData.purchase_unit || "pcs")}
                              </strong>
                            </div>
                          </div>

                          <div className="text-[10px] text-outline-variant flex items-center justify-between border-t border-outline-variant/20 pt-1 flex-wrap gap-1">
                            <span>
                              Total Unit Dasar: <strong className="text-on-surface">{calculatedNewProductTotalUnits} {isNewProductPackaging ? "pcs" : (newProductData.purchase_unit || "pcs")}</strong>
                            </span>
                            {isNewProductPackaging && (
                              <span className="text-amber-300">
                                ({numericNewProductQty} {newProductData.purchase_unit} @ {numericUnitsPerPkg || 1} pcs)
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Baris 4: Penyimpanan Dapur & Estimasi Kedaluwarsa */}
                      <div className="p-3 bg-surface-container-high/60 rounded-xl border border-outline-variant/20 space-y-2">
                        <span className="text-[10px] font-bold text-outline uppercase tracking-wider block">
                          Penyimpanan & Estimasi Kedaluwarsa:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-outline uppercase mb-1">
                              Tempat Penyimpanan
                            </label>
                            <select
                              value={newProductData.storage_type}
                              onChange={(e) => setNewProductData({ ...newProductData, storage_type: e.target.value })}
                              className="w-full bg-surface-container rounded-lg px-2.5 py-2 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs"
                            >
                              <option value="room">Suhu Ruang (Dapur / Lemari)</option>
                              <option value="chiller">Kulkas / Chiller</option>
                              <option value="freezer">Freezer / Beku</option>
                            </select>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-outline uppercase">
                                Estimasi Kedaluwarsa
                              </label>
                              {newProductData.expiry_is_estimated && (
                                <span className="text-[9px] text-primary font-semibold bg-primary/10 px-1.5 py-0.2 rounded">
                                  Otomatis Kategori
                                </span>
                              )}
                            </div>
                            <input
                              type="date"
                              value={newProductData.expiry_date}
                              onChange={(e) => setNewProductData({
                                ...newProductData,
                                expiry_date: e.target.value,
                                expiry_is_estimated: false,
                              })}
                              className="w-full bg-surface-container rounded-lg px-2.5 py-2 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Baris 5: Barcode & Foto Produk (2 Kolom di Desktop) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
                        {/* Barcode with Scan Button */}
                        <div>
                          <label className="block text-[10px] font-bold text-outline uppercase mb-1">
                            Barcode / SKU (Opsional)
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={newProductData.barcode}
                              onChange={(e) => setNewProductData({ ...newProductData, barcode: e.target.value })}
                              placeholder="Scan atau ketik barcode..."
                              className="flex-1 bg-surface-container-high rounded-lg px-2.5 py-2 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setIsBarcodeScanOpen(true)}
                              className="px-2.5 py-2 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
                            >
                              <span className="material-symbols-outlined text-[15px]">barcode_scanner</span>
                              <span>Scan</span>
                            </button>
                          </div>
                        </div>

                        {/* Upload Foto Produk */}
                        <div>
                          <label className="block text-[10px] font-bold text-outline uppercase mb-1">
                            Foto Produk (Opsional)
                          </label>
                          <div className="flex items-center gap-2">
                            {newProductData.image_url ? (
                              <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-primary/30 shrink-0 group">
                                <img
                                  src={getImageUrl(newProductData.image_url)}
                                  alt="Product"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => setNewProductData({ ...newProductData, image_url: "" })}
                                  className="absolute inset-0 bg-black/60 flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            ) : null}

                            <input
                              type="file"
                              ref={fileInputRef}
                              accept="image/*"
                              className="hidden"
                              onChange={handleProductImageUpload}
                            />
                            <button
                              type="button"
                              disabled={uploadingImage}
                              onClick={() => fileInputRef.current?.click()}
                              className="flex-1 px-3 py-2 bg-surface-container-high border border-outline-variant/30 rounded-lg text-[11px] font-semibold text-on-surface hover:border-primary/50 flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px] text-primary">
                                {uploadingImage ? "progress_activity" : "add_photo_alternate"}
                              </span>
                              <span>{uploadingImage ? "Mengunggah..." : newProductData.image_url ? "Ganti Foto" : "Unggah Foto / Kamera"}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Catatan / Spesifikasi Produk */}
                      <div>
                        <label className="block text-[10px] font-bold text-outline uppercase mb-1">
                          Catatan / Spesifikasi (Opsional)
                        </label>
                        <input
                          type="text"
                          value={newProductData.notes}
                          onChange={(e) => setNewProductData({ ...newProductData, notes: e.target.value })}
                          placeholder="Merk favorit, kemasan, atau catatan rasa..."
                          className="w-full bg-surface-container-high rounded-lg px-2.5 py-1.5 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs"
                        />
                      </div>
                    </div>
                  )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-2 items-end">
            <div>
              <div className="min-h-[24px] flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-outline uppercase leading-tight">
                  {type === "income" ? "Sumber Dana / Pengirim" : "Nama Toko / Penerima"}
                </label>
                {type === "expense" && (
                  <button
                    type="button"
                    onClick={() => setIsAddStoreOpen(true)}
                    className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors"
                    title="Tambah toko baru ke database"
                  >
                    <span className="material-symbols-outlined text-[13px]">add_business</span>
                    <span>+ Toko Baru</span>
                  </button>
                )}
              </div>

              {type === "income" ? (
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="Misal: Setoran Tunai, Transfer Rekening, Gaji"
                  className="w-full h-10 bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary text-xs"
                />
              ) : !isCustomStore ? (
                <div className="flex gap-1.5">
                  <select
                    value={selectedStoreId || (merchant && !stores.some((s) => s.name === merchant) ? "__custom__" : "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__custom__") {
                        setIsCustomStore(true);
                        setSelectedStoreId("");
                      } else if (val === "__new_store__") {
                        setIsAddStoreOpen(true);
                      } else if (val) {
                        const found = stores.find((s) => String(s.id) === String(val));
                        if (found) {
                          setSelectedStoreId(String(found.id));
                          setMerchant(found.name);
                        }
                      } else {
                        setSelectedStoreId("");
                        setMerchant("");
                      }
                    }}
                    className="flex-1 h-10 bg-surface-container-low rounded-lg px-2.5 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary text-xs font-medium"
                  >
                    <option value="">-- Pilih Toko (10 Data Terbaru) --</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({STORE_TYPE_LABELS[s.store_type] || s.store_type || "Toko"}) {s.is_mobile ? "🛵" : ""}
                      </option>
                    ))}
                    <option disabled>──────────</option>
                    <option value="__custom__">✏️ + Ketik Nama Toko Manual / Lainnya</option>
                    <option value="__new_store__">🏢 + Tambah Toko Baru ke Database</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomStore(true);
                      setSelectedStoreId("");
                    }}
                    className="px-2.5 h-10 bg-surface-container hover:bg-surface-bright text-outline hover:text-on-surface rounded-lg text-xs font-semibold border border-outline-variant/20 flex items-center justify-center shrink-0 transition-colors"
                    title="Ketik manual nama toko"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="Ketik nama toko / penerima..."
                    className="flex-1 h-10 bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary text-xs"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomStore(false);
                      const match = stores.find((s) => s.name.toLowerCase() === merchant.trim().toLowerCase());
                      if (match) {
                        setSelectedStoreId(String(match.id));
                      } else {
                        setSelectedStoreId("");
                      }
                    }}
                    className="px-2.5 h-10 bg-surface-container hover:bg-surface-bright text-outline hover:text-on-surface rounded-lg text-xs font-semibold border border-outline-variant/20 flex items-center justify-center shrink-0 transition-colors"
                    title="Kembali ke pilihan dropdown toko"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="min-h-[24px] flex items-center mb-1">
                <label className="text-[11px] font-bold text-outline uppercase leading-tight">Tanggal</label>
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary text-xs"
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

      {/* Barcode Scanner Modal for Product Barcode */}
      <ScanBarcodeModal
        isOpen={isBarcodeScanOpen}
        onClose={() => setIsBarcodeScanOpen(false)}
        onScan={(scanned) => setNewProductData((prev) => ({ ...prev, barcode: scanned }))}
        title="Pindai Barcode Produk Baru"
        description="Arahkan kamera ke barcode kemasan barang"
      />

      {/* Add Store Modal */}
      <AddStoreModal
        isOpen={isAddStoreOpen}
        onClose={() => setIsAddStoreOpen(false)}
        onStoreCreated={handleStoreCreated}
        initialName=""
      />
    </div>
  );
}

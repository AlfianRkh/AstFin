import React, { useState, useEffect } from "react";
import { api } from "../../api/client";

export function AddRadarModal({ isOpen, onClose, onSuccess, initialData = null }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [platform, setPlatform] = useState("");
  const [platforms, setPlatforms] = useState([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);
  const [isAddingPlatform, setIsAddingPlatform] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState("");
  const [savingPlatform, setSavingPlatform] = useState(false);

  const [targetPrice, setTargetPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [url, setUrl] = useState("");
  const [savedAmount, setSavedAmount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title || "");
        setDescription(initialData.description || "");
        if (initialData.category) setCategory(initialData.category);
        if (initialData.platform) setPlatform(initialData.platform);
        setTargetPrice(initialData.target_price ? String(initialData.target_price) : "");
        setCurrentPrice(initialData.current_price ? String(initialData.current_price) : "");
        setQty(initialData.qty && initialData.qty > 0 ? String(initialData.qty) : "1");
        setUrl(initialData.url || "");
        setSavedAmount(initialData.saved_amount ? String(initialData.saved_amount) : "");
      } else {
        setTitle("");
        setDescription("");
        setTargetPrice("");
        setCurrentPrice("");
        setQty("1");
        setUrl("");
        setSavedAmount("");
      }

      setLoadingCategories(true);
      setLoadingPlatforms(true);

      Promise.all([api.getRadarCategories(), api.getRadarPlatforms()])
        .then(([catRes, platRes]) => {
          const catList = Array.isArray(catRes?.data) ? catRes.data : Array.isArray(catRes) ? catRes : [];
          setCategories(catList);
          if (catList.length > 0 && !category && !initialData?.category) {
            setCategory(catList[0].name);
          }

          const platList = Array.isArray(platRes?.data) ? platRes.data : Array.isArray(platRes) ? platRes : [];
          setPlatforms(platList);
          if (platList.length > 0 && !platform && !initialData?.platform) {
            setPlatform(platList[0].name);
          }
        })
        .catch((err) => {
          console.error("Gagal memuat data radar:", err);
        })
        .finally(() => {
          setLoadingCategories(false);
          setLoadingPlatforms(false);
        });
    } else {
      setIsAddingCategory(false);
      setNewCategoryName("");
      setIsAddingPlatform(false);
      setNewPlatformName("");
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSaveNewCategory = async (e) => {
    e?.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      alert("Harap masukkan nama kategori");
      return;
    }

    setSavingCategory(true);
    try {
      await api.createRadarCategory({ name: trimmed });
      setCategories((prev) => {
        const exists = prev.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        if (exists) return prev;
        return [...prev, { id: Date.now(), name: trimmed }];
      });
      setCategory(trimmed);
      setNewCategoryName("");
      setIsAddingCategory(false);
    } catch (err) {
      alert("Gagal menambahkan kategori ke database: " + err.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSaveNewPlatform = async (e) => {
    e?.preventDefault();
    const trimmed = newPlatformName.trim();
    if (!trimmed) {
      alert("Harap masukkan nama platform e-commerce");
      return;
    }

    setSavingPlatform(true);
    try {
      await api.createRadarPlatform({ name: trimmed });
      setPlatforms((prev) => {
        const exists = prev.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
        if (exists) return prev;
        return [...prev, { id: Date.now(), name: trimmed }];
      });
      setPlatform(trimmed);
      setNewPlatformName("");
      setIsAddingPlatform(false);
    } catch (err) {
      alert("Gagal menambahkan platform ke database: " + err.message);
    } finally {
      setSavingPlatform(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !targetPrice || !currentPrice) {
      alert("Harap isi nama produk, target harga, dan harga saat ini");
      return;
    }

    setLoading(true);
    try {
      await api.createRadarItem({
        title: title.trim(),
        description: description.trim(),
        category: category || "Gadget & Setup",
        target_price: parseFloat(targetPrice),
        current_price: parseFloat(currentPrice),
        platform: platform || "Tokopedia",
        url: url.trim(),
        saved_amount: parseFloat(savedAmount) || 0,
        qty: parseInt(qty) || 1,
        image_url: "",
      });
      setTitle("");
      setDescription("");
      setTargetPrice("");
      setCurrentPrice("");
      setQty("1");
      setSavedAmount("");
      setUrl("");
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Gagal menambahkan radar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-[22px]">radar</span>
            <div>
              <h3 className="text-base font-bold text-on-surface">Tambah Radar Harga & Wishlist</h3>
              <p className="text-[11px] text-outline">Pantau barang idaman dengan data kategori & platform berbasis database</p>
            </div>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Nama Produk / Barang</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Logitech G Pro X 2 Lightspeed"
              className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-tertiary"
            />
          </div>

          {/* Kategori Radar & Platform E-Commerce Berbasis Database */}
          <div className="grid grid-cols-2 gap-2">
            {/* Kategori Dropdown */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-outline uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-tertiary">category</span>
                  <span>Kategori</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCategory((v) => !v);
                    setIsAddingPlatform(false);
                  }}
                  className="text-[10px] text-tertiary hover:underline font-bold flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[13px]">{isAddingCategory ? "close" : "add"}</span>
                  <span>{isAddingCategory ? "Batal" : "+ Kategori"}</span>
                </button>
              </div>

              {loadingCategories ? (
                <div className="py-2 px-3 text-outline text-xs bg-surface-container-low rounded-lg border border-outline-variant/20 flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-tertiary border-t-transparent rounded-full animate-spin"></span>
                  <span>Memuat...</span>
                </div>
              ) : (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-tertiary font-medium"
                >
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Platform E-Commerce Dropdown */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-outline uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-secondary">storefront</span>
                  <span>Platform</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingPlatform((v) => !v);
                    setIsAddingCategory(false);
                  }}
                  className="text-[10px] text-secondary hover:underline font-bold flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[13px]">{isAddingPlatform ? "close" : "add"}</span>
                  <span>{isAddingPlatform ? "Batal" : "+ Platform"}</span>
                </button>
              </div>

              {loadingPlatforms ? (
                <div className="py-2 px-3 text-outline text-xs bg-surface-container-low rounded-lg border border-outline-variant/20 flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin"></span>
                  <span>Memuat...</span>
                </div>
              ) : (
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-secondary font-medium"
                >
                  {platforms.map((p) => (
                    <option key={p.id || p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Form Tambah Kategori Baru ke Database */}
          {isAddingCategory && (
            <div className="p-2.5 rounded-xl bg-surface-container-low border border-tertiary/40 flex flex-col gap-2 animate-in fade-in duration-150 shadow-inner">
              <label className="block text-[11px] font-bold text-tertiary uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">add_circle</span>
                <span>Tambah Kategori Baru ke Database</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Contoh: Fotografi, Aksesoris Motor, Furniture..."
                  className="flex-1 bg-surface-container rounded-lg px-3 py-1.5 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-tertiary text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveNewCategory();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={savingCategory || !newCategoryName.trim()}
                  onClick={handleSaveNewCategory}
                  className="bg-tertiary-container hover:bg-tertiary text-on-tertiary-container px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors shrink-0"
                >
                  {savingCategory ? "Menyimpan..." : "Simpan Kategori"}
                </button>
              </div>
            </div>
          )}

          {/* Form Tambah Platform Baru ke Database */}
          {isAddingPlatform && (
            <div className="p-2.5 rounded-xl bg-surface-container-low border border-secondary/40 flex flex-col gap-2 animate-in fade-in duration-150 shadow-inner">
              <label className="block text-[11px] font-bold text-secondary uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">add_business</span>
                <span>Tambah Platform E-Commerce Baru ke Database</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newPlatformName}
                  onChange={(e) => setNewPlatformName(e.target.value)}
                  placeholder="Contoh: Amazon, Zalora, Bukalapak, Offline Store..."
                  className="flex-1 bg-surface-container rounded-lg px-3 py-1.5 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-secondary text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveNewPlatform();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={savingPlatform || !newPlatformName.trim()}
                  onClick={handleSaveNewPlatform}
                  className="bg-secondary-container hover:bg-secondary text-on-secondary-container px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors shrink-0"
                >
                  {savingPlatform ? "Menyimpan..." : "Simpan Platform"}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-outline uppercase mb-1">Target Harga (Rp)</label>
              <input
                type="number"
                required
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="2890000"
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-tertiary font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-outline uppercase mb-1">Harga Saat Ini (Rp)</label>
              <input
                type="number"
                required
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                placeholder="3499000"
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-tertiary font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-outline uppercase mb-1">Jumlah Unit (Qty)</label>
              <input
                type="number"
                min="1"
                required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="1"
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-tertiary font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-outline uppercase mb-1">Tabungan Terkumpul (Rp)</label>
              <input
                type="number"
                value={savedAmount}
                onChange={(e) => setSavedAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-outline uppercase mb-1">Link URL Produk (Opsional)</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Deskripsi / Spesifikasi Kunci</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Graphene Audio Driver, 50h Battery"
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
              disabled={loading}
              className="flex-1 bg-tertiary-container text-on-tertiary-container hover:bg-tertiary py-2 rounded-lg text-xs font-bold disabled:opacity-50 shadow-md transition-colors"
            >
              {loading ? "Menyimpan..." : "Mulai Pantau Radar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

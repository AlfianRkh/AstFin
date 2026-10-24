import React, { useState, useEffect, useMemo } from "react";
import { api } from "../../api/client";
import { parsePackageInfo } from "../../utils/packageHelper";

const QUICK_STORES = [
  "Supermarket",
  "Indomaret",
  "Alfamart",
  "Pasar Tradisional",
  "Agen Grosir Sembako",
];

export function RestockProductModal({ isOpen, onClose, item, onSuccess }) {
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [store, setStore] = useState("Supermarket / Pasar Terdekat");
  const [packageQty, setPackageQty] = useState(1);
  const [pcsPerPackage, setPcsPerPackage] = useState(12);
  const [packageUnit, setPackageUnit] = useState("Kardus");
  const [isPackage, setIsPackage] = useState(false);
  const [regularQty, setRegularQty] = useState(1);
  const [loading, setLoading] = useState(false);

  // Inisialisasi saat modal dibuka
  useEffect(() => {
    if (isOpen && item) {
      const parsed = parsePackageInfo(item.name);
      if (parsed.hasPackage) {
        setIsPackage(true);
        setProductName(parsed.baseName);
        setPackageQty(parsed.packageQty || 1);
        setPackageUnit(parsed.packageUnit || "Kardus");
        setPcsPerPackage(parsed.pcsPerPackage || 12);
      } else {
        setIsPackage(false);
        setProductName(item.name);
        setRegularQty(1);
      }

      // Harga acuan awal dari database (pantry_item.price)
      const initialPrice = item.price && item.price > 0 ? item.price : (item.estimated_price || "");
      setPrice(initialPrice ? String(initialPrice) : "");

      // Rekomendasi toko sesuai kategori
      if (item.category?.toLowerCase().includes("freezer")) {
        setStore("Supermarket (Frozen Food)");
      } else if (item.category?.toLowerCase().includes("bumbu") || item.category?.toLowerCase().includes("kering")) {
        setStore("Pasar Tradisional / Minimarket");
      } else {
        setStore("Supermarket / Pasar Terdekat");
      }
    }
  }, [isOpen, item]);

  const initialPrice = item?.price && item.price > 0 ? item.price : 0;
  const currentPriceNum = parseFloat(price) || 0;

  // Hitung perbedaan harga dibanding harga awal
  const priceDiffInfo = useMemo(() => {
    if (!initialPrice || currentPriceNum <= 0) return null;
    const diff = currentPriceNum - initialPrice;
    const percent = Math.round((diff / initialPrice) * 100);
    return {
      diff,
      percent,
      isHigher: diff > 0,
      isLower: diff < 0,
      isEqual: diff === 0,
    };
  }, [initialPrice, currentPriceNum]);

  // Kalkulasi total pcs
  const totalPcs = useMemo(() => {
    if (!isPackage) return regularQty;
    return Math.round((parseFloat(packageQty) || 0) * (parseFloat(pcsPerPackage) || 0) * 100) / 100;
  }, [isPackage, regularQty, packageQty, pcsPerPackage]);

  // Generate nama final yang akan masuk ke shopping list
  const finalShoppingName = useMemo(() => {
    const trimmed = productName.trim();
    if (isPackage) {
      const pQty = parseFloat(packageQty) || 1;
      const pPcs = parseFloat(pcsPerPackage) || 1;
      return `${trimmed} (${pQty} ${packageUnit} @ ${pPcs} pcs)`;
    }
    return trimmed;
  }, [productName, isPackage, packageQty, packageUnit, pcsPerPackage]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!finalShoppingName.trim()) {
      alert("Nama produk tidak boleh kosong");
      return;
    }

    setLoading(true);
    try {
      await api.addShoppingItem({
        pantry_item_id: item.id,
        name: finalShoppingName,
        estimated_price: currentPriceNum,
        store_recommendation: store.trim() || "Supermarket / Pasar",
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Gagal menambahkan ke Smart Shopping List: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (val) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl max-w-md w-full p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">add_shopping_cart</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">Detail Data Restock Produk</h3>
              <p className="text-[11px] text-outline">Sesuaikan harga dan kemasan restock ke Smart Shopping List</p>
            </div>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Informasi Status Stok Bahan Saat Ini */}
        <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/15 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-outline uppercase font-bold tracking-wider">Bahan Dapur</span>
            <span className="text-xs font-bold text-on-surface truncate max-w-[200px]">{item.name}</span>
            <span className="text-[10px] text-secondary">{item.category}</span>
          </div>
          <div className="text-right flex flex-col">
            <span className="text-[10px] text-outline uppercase font-bold tracking-wider">Stok Saat Ini</span>
            <span className="text-xs font-bold text-primary">{item.quantity} {item.unit}</span>
            <span className="text-[10px] text-outline">Min: {item.min_quantity} {item.unit || "Pcs"}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          {/* Nama Produk */}
          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">
              Nama Produk
            </label>
            <input
              type="text"
              required
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full bg-surface-container rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-secondary font-semibold"
              placeholder="Contoh: Cleo 1L, Indomie Goreng"
            />
          </div>

          {/* Opsi Tipe Kemasan (Kardus/Pack vs Satuan Biasa) */}
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface-container-low border border-outline-variant/15">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-outline uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-secondary">inventory_2</span>
                <span>Format Pembelian Restock</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-on-surface select-none">
                <input
                  type="checkbox"
                  checked={isPackage}
                  onChange={(e) => setIsPackage(e.target.checked)}
                  className="rounded text-secondary focus:ring-0 w-3.5 h-3.5"
                />
                <span>Kemasan Bertingkat (Kardus/Pack)</span>
              </label>
            </div>

            {isPackage ? (
              <div className="flex flex-col gap-2 pt-1">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-outline mb-0.5">Jumlah Beli</label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      required
                      value={packageQty}
                      onChange={(e) => setPackageQty(e.target.value)}
                      className="w-full bg-surface-container rounded px-2 py-1.5 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-secondary font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-outline mb-0.5">Satuan Kemasan</label>
                    <select
                      value={packageUnit}
                      onChange={(e) => setPackageUnit(e.target.value)}
                      className="w-full bg-surface-container rounded px-2 py-1.5 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-secondary text-xs"
                    >
                      <option value="Kardus">Kardus</option>
                      <option value="Dus">Dus</option>
                      <option value="Pack">Pack</option>
                      <option value="Karton">Karton</option>
                      <option value="Bungkus">Bungkus</option>
                      <option value="Kotak">Kotak</option>
                      <option value="Renceng">Renceng</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-outline mb-0.5">Isi per {packageUnit}</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        min="1"
                        required
                        value={pcsPerPackage}
                        onChange={(e) => setPcsPerPackage(e.target.value)}
                        className="w-full bg-surface-container rounded px-2 py-1.5 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-secondary font-bold text-xs"
                      />
                      <span className="text-[10px] text-outline">pcs</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container rounded-lg p-2 flex items-center justify-between text-[11px] border border-outline-variant/10">
                  <span className="text-on-surface-variant">Konversi Stok Masuk:</span>
                  <span className="font-bold text-primary">
                    {packageQty} {packageUnit} = {totalPcs} Pcs stok dapur
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] text-outline mb-0.5">Jumlah Beli ({item.unit || "Pcs"})</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={regularQty}
                  onChange={(e) => setRegularQty(e.target.value)}
                  className="w-full bg-surface-container rounded px-3 py-1.5 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-secondary font-bold text-xs"
                />
              </div>
            )}
          </div>

          {/* Harga Beli Restock Terkini */}
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/15">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-outline uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-primary">sell</span>
                <span>Harga Beli Restock Terkini (Rp)</span>
              </label>
              {initialPrice > 0 && (
                <span className="text-[10px] text-outline">
                  Harga Awal: <strong className="text-on-surface">{formatRupiah(initialPrice)}</strong>
                </span>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 text-outline text-xs font-bold">Rp</span>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-surface-container rounded-lg pl-9 pr-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-extrabold text-sm text-primary"
                placeholder={initialPrice ? String(initialPrice) : "0"}
              />
            </div>

            {/* Indikator Selisih Harga dari Harga Awal */}
            {priceDiffInfo && (
              <div className="pt-1 flex items-center justify-between text-[10px]">
                {priceDiffInfo.isHigher && (
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">trending_up</span>
                    <span>Harga naik {formatRupiah(priceDiffInfo.diff)} (+{priceDiffInfo.percent}%) dari harga awal</span>
                  </span>
                )}
                {priceDiffInfo.isLower && (
                  <span className="text-primary font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">trending_down</span>
                    <span>Harga lebih hemat {formatRupiah(Math.abs(priceDiffInfo.diff))} ({priceDiffInfo.percent}%)</span>
                  </span>
                )}
                {priceDiffInfo.isEqual && (
                  <span className="text-outline flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                    <span>Sama dengan harga acuan awal</span>
                  </span>
                )}
              </div>
            )}
            <p className="text-[10px] text-outline italic">
              *Harga belanja bisa berbeda dari harga awal dan akan dicatat pada Smart Shopping List.
            </p>
          </div>

          {/* Rekomendasi Toko / Tempat Belanja */}
          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-secondary">storefront</span>
              <span>Rekomendasi Toko / Tempat Beli</span>
            </label>
            <input
              type="text"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="w-full bg-surface-container rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-secondary text-xs"
              placeholder="Contoh: Supermarket, Indomaret, Agen Grosir"
            />
            {/* Quick Chips Toko */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {QUICK_STORES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStore(s)}
                  className={`text-[9px] px-2 py-0.5 rounded-full border transition-all ${
                    store === s
                      ? "bg-secondary-container text-on-secondary-container border-secondary font-bold"
                      : "bg-surface-container hover:bg-surface-bright text-outline border-outline-variant/20"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/15">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-container hover:bg-surface-bright text-on-surface py-2.5 rounded-xl text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-secondary text-on-secondary hover:bg-secondary-fixed py-2.5 rounded-xl text-xs font-bold disabled:opacity-40 shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
              <span>{loading ? "Menyimpan..." : "Tambah ke Shopping List"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

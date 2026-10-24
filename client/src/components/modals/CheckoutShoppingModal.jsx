import React, { useState, useEffect, useMemo } from "react";
import { api } from "../../api/client";
import { parsePackageInfo } from "../../utils/packageHelper";

export function CheckoutShoppingModal({ isOpen, onClose, shoppingItems = [], onSuccess }) {
  const [wallets, setWallets] = useState([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [itemsToBuy, setItemsToBuy] = useState([]);
  const [loading, setLoading] = useState(false);

  // Inisialisasi daftar item yang akan dibeli saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      const active = shoppingItems
        .filter((i) => !i.is_checked)
        .map((i) => {
          const pkg = parsePackageInfo(i.name);
          return {
            shopping_item_id: i.id,
            pantry_item_id: i.pantry_item_id || null,
            name: i.name,
            base_name: pkg.baseName,
            price: i.estimated_price || 25000,
            has_package: pkg.hasPackage,
            package_qty: pkg.packageQty,
            package_unit: pkg.packageUnit,
            pcs_per_package: pkg.pcsPerPackage,
            restock_qty: pkg.hasPackage ? pkg.totalPcs : 1, // Sesuai total pcs kemasan
            unit: "Pcs",
            category: "Kulkas (Chiller)",
            selected: true,
          };
        });
      setItemsToBuy(active);

      // Muat data dompet
      setLoadingWallets(true);
      api.getWallets()
        .then((res) => {
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

          const totalEst = active.reduce((acc, curr) => acc + (parseFloat(curr.price) || 0), 0);
          if (list.length > 0) {
            // Otomatis pilih dompet yang saldonya mencukupi
            const capable = list.find((w) => (w.balance || 0) >= totalEst);
            if (capable) {
              setSelectedWalletId(String(capable.id));
            } else {
              // Jika tidak ada yang cukup, pilih dompet dengan saldo tertinggi
              const highest = [...list].sort((a, b) => (b.balance || 0) - (a.balance || 0))[0];
              setSelectedWalletId(String(highest.id));
            }
          }
        })
        .catch((err) => {
          console.error("Gagal memuat dompet:", err);
        })
        .finally(() => {
          setLoadingWallets(false);
        });
    }
  }, [isOpen, shoppingItems]);

  const selectedWallet = useMemo(() => {
    return wallets.find((w) => String(w.id) === String(selectedWalletId));
  }, [wallets, selectedWalletId]);

  const availableBalance = selectedWallet ? selectedWallet.balance || 0 : 0;

  const totalAmount = useMemo(() => {
    return itemsToBuy
      .filter((i) => i.selected)
      .reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);
  }, [itemsToBuy]);

  const selectedItemsCount = itemsToBuy.filter((i) => i.selected).length;
  const isOverBalance = Boolean(selectedWallet && totalAmount > availableBalance);

  // Dompet alternatif yang mencukupi
  const capableWallets = useMemo(() => {
    if (totalAmount <= 0) return [];
    return wallets.filter((w) => String(w.id) !== String(selectedWalletId) && (w.balance || 0) >= totalAmount);
  }, [wallets, selectedWalletId, totalAmount]);

  if (!isOpen) return null;

  const handleToggleItem = (index) => {
    setItemsToBuy((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  };

  const handlePriceChange = (index, val) => {
    setItemsToBuy((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], price: parseFloat(val) || 0 };
      return next;
    });
  };

  // Mengubah jumlah beli kemasan (misal 1 Kardus -> 2 Kardus)
  const handlePackageQtyChange = (index, val) => {
    const qty = parseFloat(val) || 0;
    setItemsToBuy((prev) => {
      const next = [...prev];
      const item = next[index];
      const calculatedPcs = Math.round(qty * item.pcs_per_package * 100) / 100;
      const updatedName = `${item.base_name} (${qty} ${item.package_unit} @ ${item.pcs_per_package} pcs)`;
      next[index] = {
        ...item,
        package_qty: qty,
        restock_qty: calculatedPcs,
        name: updatedName,
      };
      return next;
    });
  };

  // Mengubah kuantitas stok masuk langsung (Pcs)
  const handleQtyChange = (index, val) => {
    setItemsToBuy((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], restock_qty: parseFloat(val) || 0 };
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWalletId) {
      alert("Harap pilih dompet asal dana");
      return;
    }
    if (selectedItemsCount === 0) {
      alert("Pilih minimal satu item untuk dibeli");
      return;
    }
    if (isOverBalance) {
      alert(`Saldo dompet ${selectedWallet?.name} tidak mencukupi untuk total belanja Rp ${totalAmount.toLocaleString("id-ID")}`);
      return;
    }

    const payloadItems = itemsToBuy
      .filter((i) => i.selected)
      .map((i) => ({
        shopping_item_id: i.shopping_item_id,
        pantry_item_id: i.pantry_item_id,
        name: i.name,
        price: parseFloat(i.price) || 0,
        restock_qty: parseFloat(i.restock_qty) || 1,
        unit: i.unit || "Pcs",
        category: i.category || "Kulkas (Chiller)",
      }));

    setLoading(true);
    try {
      await api.checkoutShoppingList({
        wallet_id: parseInt(selectedWalletId),
        total_amount: totalAmount,
        notes: `Belanja Smart Shopping List: ${payloadItems.map((i) => i.name).join(", ")}`,
        items: payloadItems,
      });

      alert(`Belanja berhasil diselesaikan!\nSaldo ${selectedWallet?.name} terpotong Rp ${totalAmount.toLocaleString("id-ID")} dan stok inventaris dapur telah otomatis diperbarui.`);
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Gagal memproses belanja: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (val) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">Eksekusi Belanja Smart Shopping List</h3>
              <p className="text-[11px] text-outline">Potong saldo dompet dan update stok dapur secara otomatis</p>
            </div>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* Asal Dana Dompet */}
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-outline uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-primary">account_balance_wallet</span>
                <span>Asal Dana Dompet</span>
              </label>
              {selectedWallet && (
                <span className="text-[11px] text-outline">
                  Saldo: <strong className={isOverBalance ? "text-error font-bold" : "text-primary font-bold"}>
                    {formatRupiah(availableBalance)}
                  </strong>
                </span>
              )}
            </div>

            {loadingWallets ? (
              <div className="py-2 px-3 text-outline text-xs bg-surface-container rounded-lg flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                <span>Memuat dompet...</span>
              </div>
            ) : (
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className={`w-full bg-surface-container rounded-lg px-3 py-2 text-on-surface border focus:outline-none font-bold text-xs ${
                  isOverBalance ? "border-error focus:border-error" : "border-outline-variant/30 focus:border-primary"
                }`}
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.type}) — Saldo: {formatRupiah(w.balance)}
                  </option>
                ))}
              </select>
            )}

            {/* Alert Validasi Saldo Kurang */}
            {isOverBalance && (
              <div className="p-2.5 rounded-lg bg-error-container/20 border border-error/40 flex flex-col gap-1.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 text-error font-bold text-[11px]">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  <span>Saldo dompet tidak mencukupi untuk pembelian ini!</span>
                </div>
                <div className="text-[10px] text-on-surface-variant flex justify-between">
                  <span>Tersedia: {formatRupiah(availableBalance)}</span>
                  <span className="text-error font-bold">Kurang: {formatRupiah(totalAmount - availableBalance)}</span>
                </div>
                {capableWallets.length > 0 && (
                  <div className="flex items-center gap-1 pt-1 flex-wrap">
                    <span className="text-[10px] text-outline">Gunakan dompet lain:</span>
                    {capableWallets.map((cw) => (
                      <button
                        key={cw.id}
                        type="button"
                        onClick={() => setSelectedWalletId(String(cw.id))}
                        className="px-2 py-0.5 rounded bg-primary/15 text-primary hover:bg-primary hover:text-on-primary text-[10px] font-bold transition-all"
                      >
                        {cw.name} ({formatRupiah(cw.balance)})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Indikator Saldo Cukup */}
            {!isOverBalance && selectedWallet && totalAmount > 0 && (
              <div className="text-[10px] text-primary flex items-center justify-between pt-0.5">
                <span>Saldo mencukupi</span>
                <span>Sisa setelah belanja: <strong>{formatRupiah(availableBalance - totalAmount)}</strong></span>
              </div>
            )}
          </div>

          {/* Daftar Item Belanja yang Dipilih */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-outline uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-secondary">checklist</span>
                <span>Barang Belanja ({selectedItemsCount} Dipilih)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const allSelected = itemsToBuy.every((i) => i.selected);
                  setItemsToBuy((prev) => prev.map((i) => ({ ...i, selected: !allSelected })));
                }}
                className="text-[10px] text-primary hover:underline font-bold"
              >
                {itemsToBuy.every((i) => i.selected) ? "Batal Pilih Semua" : "Pilih Semua"}
              </button>
            </div>

            <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1">
              {itemsToBuy.length === 0 ? (
                <div className="text-center py-6 text-outline text-xs">
                  Tidak ada item aktif di Smart Shopping List.
                </div>
              ) : (
                itemsToBuy.map((item, idx) => (
                  <div
                    key={item.shopping_item_id || idx}
                    className={`p-3 rounded-xl border flex flex-col gap-2.5 transition-all ${
                      item.selected
                        ? "bg-surface-container border-outline-variant/30 shadow-sm"
                        : "bg-surface-container-low border-outline-variant/10 opacity-50"
                    }`}
                  >
                    {/* Header Item: Checkbox, Name, Packaging Badge, Status */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => handleToggleItem(idx)}
                        className="w-4 h-4 rounded text-primary focus:ring-0 cursor-pointer"
                      />
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                        <span className="font-bold text-on-surface text-xs truncate">
                          {item.has_package ? item.base_name : item.name}
                        </span>
                        {item.has_package && (
                          <span className="text-[10px] bg-secondary-container/30 text-secondary-fixed border border-secondary/30 px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">inventory_2</span>
                            <span>{item.package_qty} {item.package_unit} (@ {item.pcs_per_package} pcs)</span>
                          </span>
                        )}
                      </div>
                      {item.pantry_item_id ? (
                        <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold shrink-0">
                          Restock Bahan
                        </span>
                      ) : (
                        <span className="text-[9px] bg-secondary/15 text-secondary px-1.5 py-0.5 rounded font-semibold shrink-0">
                          Bahan Baru
                        </span>
                      )}
                    </div>

                    {item.selected && (
                      <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/15 text-[11px]">
                        {item.has_package ? (
                          <>
                            {/* Grid jika barang kemasan bertingkat (Kardus / Pack / Bungkus) */}
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] text-outline mb-1">Harga Beli Total (Rp)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={item.price}
                                  onChange={(e) => handlePriceChange(idx, e.target.value)}
                                  className="w-full bg-surface-container-low rounded px-2 py-1 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-secondary font-semibold mb-1">
                                  Beli ({item.package_unit})
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="1"
                                  value={item.package_qty}
                                  onChange={(e) => handlePackageQtyChange(idx, e.target.value)}
                                  className="w-full bg-surface-container-low rounded px-2 py-1 text-on-surface border border-secondary/40 focus:outline-none focus:border-secondary font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-primary font-semibold mb-1">
                                  Masuk Dapur (Pcs)
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="1"
                                  value={item.restock_qty}
                                  onChange={(e) => handleQtyChange(idx, e.target.value)}
                                  className="w-full bg-surface-container-low rounded px-2 py-1 text-on-surface border border-primary/40 focus:outline-none focus:border-primary font-bold text-xs"
                                />
                              </div>
                            </div>

                            {/* Info kalkulasi konversi kemasan ke total Pcs */}
                            <div className="bg-surface-container-lowest/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[10px] border border-outline-variant/10 text-on-surface-variant">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] text-primary">sync_alt</span>
                                <span>{item.package_qty} {item.package_unit} × {item.pcs_per_package} pcs/unit</span>
                              </span>
                              <span className="font-bold text-primary">
                                = {item.restock_qty} Pcs bertambah ke dapur
                              </span>
                            </div>
                          </>
                        ) : (
                          /* Grid jika barang satuan reguler */
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-outline mb-0.5">Harga Aktual (Rp)</label>
                              <input
                                type="number"
                                step="any"
                                value={item.price}
                                onChange={(e) => handlePriceChange(idx, e.target.value)}
                                className="w-full bg-surface-container-low rounded px-2 py-1 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-bold text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-outline mb-0.5">Tambah Stok Masuk ({item.unit || "Pcs"})</label>
                              <input
                                type="number"
                                step="any"
                                min="1"
                                value={item.restock_qty}
                                onChange={(e) => handleQtyChange(idx, e.target.value)}
                                className="w-full bg-surface-container-low rounded px-2 py-1 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-bold text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Ringkasan Total Pembelian */}
          <div className="bg-surface-container rounded-xl p-3 flex items-center justify-between border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Belanja</span>
              <span className="text-xs text-outline">{selectedItemsCount} Item akan masuk ke stok dapur</span>
            </div>
            <span className="text-lg font-extrabold text-primary">{formatRupiah(totalAmount)}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-container hover:bg-surface-bright text-on-surface py-2.5 rounded-xl text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || selectedItemsCount === 0 || isOverBalance || !selectedWalletId}
              className="flex-1 bg-primary text-on-primary hover:bg-primary-fixed py-2.5 rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">payments</span>
              <span>{loading ? "Memproses Belanja..." : `Bayar & Update Dapur`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

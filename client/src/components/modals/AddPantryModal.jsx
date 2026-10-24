import React, { useState, useEffect } from "react";
import { api } from "../../api/client";

const PACKAGE_UNITS = ["kardus", "dus", "karton", "pack", "kotak", "bungkus", "pouch", "lusin", "renceng", "tray"];

export function AddPantryModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Kulkas (Chiller)");
  const [storageZones, setStorageZones] = useState([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [savingZone, setSavingZone] = useState(false);

  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("Pcs");
  const [pcsPerUnit, setPcsPerUnit] = useState("");
  const [appendPackNote, setAppendPackNote] = useState(true);
  const [minQuantity, setMinQuantity] = useState("5");
  const [price, setPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingZones(true);
      api.getPantryStorageZones()
        .then((res) => {
          const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          setStorageZones(list);
          if (list.length > 0) {
            setCategory((prev) => {
              const found = list.some((z) => z.name === prev);
              return found ? prev : list[0].name;
            });
          }
        })
        .catch((err) => {
          console.error("Gagal memuat zona penyimpanan dapur:", err);
        })
        .finally(() => {
          setLoadingZones(false);
        });
    } else {
      setIsAddingZone(false);
      setNewZoneName("");
      setPcsPerUnit("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUnitChange = (newUnit) => {
    setUnit(newUnit);
    if (newUnit === "Lusin" && !pcsPerUnit) {
      setPcsPerUnit("12");
    }
    // Sesuaikan default batas minimum jika satuan berubah
    if (["Kg", "Liter", "Botol"].includes(newUnit)) {
      if (minQuantity === "5" || !minQuantity) {
        setMinQuantity("1");
      }
    } else if (newUnit === "Gram") {
      if (minQuantity === "5" || minQuantity === "1" || !minQuantity) {
        setMinQuantity("250");
      }
    } else if (["Pcs", "Butir"].includes(newUnit)) {
      if (minQuantity === "1" || !minQuantity) {
        setMinQuantity("5");
      }
    }
  };

  const isPackageUnit = PACKAGE_UNITS.some((u) => unit.toLowerCase().includes(u));
  const parsedQty = parseFloat(quantity) || 0;
  const parsedPcs = parseFloat(pcsPerUnit) || 0;
  const totalPcs = parsedQty > 0 && parsedPcs > 0 ? Math.round(parsedQty * parsedPcs * 100) / 100 : null;

  // Satuan batas restock:
  // Jika kemasan bertingkat yang dipecah ke pcs (kardus @ 12 pcs), restock dalam Pcs
  // Jika satuan reguler (Kg, Liter, Gram, Butir, Botol, Pcs, dll.), restock mengikuti satuan bahan
  const activeRestockUnit = isPackageUnit && parsedPcs > 0 ? "Pcs" : unit;

  const handleSaveNewZone = async (e) => {
    e?.preventDefault();
    const trimmed = newZoneName.trim();
    if (!trimmed) {
      alert("Harap masukkan nama zona penyimpanan");
      return;
    }

    setSavingZone(true);
    try {
      await api.createPantryStorageZone({ name: trimmed });
      setStorageZones((prev) => {
        const exists = prev.some((z) => z.name.toLowerCase() === trimmed.toLowerCase());
        if (exists) return prev;
        return [...prev, { id: Date.now(), name: trimmed }];
      });
      setCategory(trimmed);
      setNewZoneName("");
      setIsAddingZone(false);
    } catch (err) {
      alert("Gagal menambahkan zona penyimpanan ke database: " + err.message);
    } finally {
      setSavingZone(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || quantity === "") {
      alert("Harap isi nama bahan dan kuantitas");
      return;
    }

    setLoading(true);
    try {
      let finalQty = parseFloat(quantity) || 0;
      let finalUnit = unit;
      let finalName = name.trim();

      // Jika pembelian berbasis kemasan (kardus, bungkus, pack, dsb.), konversi total stok ke Pcs
      if (isPackageUnit && parsedPcs > 0 && totalPcs > 0) {
        finalQty = totalPcs;
        finalUnit = "Pcs";
        if (appendPackNote && !finalName.toLowerCase().includes(unit.toLowerCase())) {
          finalName = `${finalName} (${parsedQty} ${unit} @ ${parsedPcs} pcs)`;
        }
      }

      await api.createPantryItem({
        name: finalName,
        category,
        quantity: finalQty,
        unit: finalUnit,
        min_quantity: parseFloat(minQuantity) || 1, // Acuan selalu dalam Pcs
        expiry_date: expiryDate,
        price: parseFloat(price) || 0,
      });
      setName("");
      setQuantity("");
      setPcsPerUnit("");
      setPrice("");
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Gagal menambahkan bahan dapur: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl max-w-md w-full p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">kitchen</span>
            <h3 className="text-base font-bold text-on-surface">Tambah Bahan ke Inventaris Dapur</h3>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Nama Bahan / Komoditas</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Telur Ayam Negeri, Mie Instan Goreng, Susu UHT 1L"
              className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-outline uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-primary">kitchen</span>
                  <span>Zona Penyimpanan</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingZone((v) => !v)}
                  className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[13px]">{isAddingZone ? "close" : "add"}</span>
                  <span>{isAddingZone ? "Batal" : "+ Zona"}</span>
                </button>
              </div>

              {loadingZones ? (
                <div className="py-2 px-3 text-outline text-xs bg-surface-container-low rounded-lg border border-outline-variant/20 flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                  <span>Memuat...</span>
                </div>
              ) : (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-medium"
                >
                  {storageZones.map((z) => (
                    <option key={z.id || z.name} value={z.name}>
                      {z.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-outline uppercase">Satuan</label>
              </div>
              <select
                value={unit}
                onChange={(e) => handleUnitChange(e.target.value)}
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none"
              >
                <option value="Kg">Kilogram (Kg)</option>
                <option value="Gram">Gram (g)</option>
                <option value="Liter">Liter (L)</option>
                <option value="Pcs">Pcs</option>
                <option value="Butir">Butir</option>
                <option value="Botol">Botol</option>
                <option value="Kardus">Kardus / Karton / Dus</option>
                <option value="Pack">Pack / Kotak</option>
                <option value="Bungkus">Bungkus / Pouch</option>
                <option value="Lusin">Lusin (12 pcs)</option>
                <option value="Renceng">Renceng</option>
                <option value="Tray">Tray</option>
              </select>
            </div>
          </div>

          {/* Form Tambah Zona Penyimpanan Baru ke Database */}
          {isAddingZone && (
            <div className="p-2.5 rounded-xl bg-surface-container-low border border-primary/40 flex flex-col gap-2 animate-in fade-in duration-150 shadow-inner">
              <label className="block text-[11px] font-bold text-primary uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">add_circle</span>
                <span>Tambah Zona Penyimpanan Baru ke Database</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="Contoh: Chiller Minuman, Lemari Bawah, Freezer Daging..."
                  className="flex-1 bg-surface-container rounded-lg px-3 py-1.5 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveNewZone();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={savingZone || !newZoneName.trim()}
                  onClick={handleSaveNewZone}
                  className="bg-primary-container hover:bg-primary text-on-primary-container px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors shrink-0"
                >
                  {savingZone ? "Menyimpan..." : "Simpan Zona"}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-outline uppercase mb-1">
                {isPackageUnit ? `Qty Pembelian (${unit})` : `Qty Stok (${unit})`}
              </label>
              <input
                type="number"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={isPackageUnit ? "Contoh: 1, 2" : "Contoh: 2"}
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-bold"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-outline uppercase">
                  Batas Minimum Restock ({activeRestockUnit})
                </label>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                  placeholder={
                    activeRestockUnit === "Kg" || activeRestockUnit === "Liter" || activeRestockUnit === "Botol"
                      ? "Contoh: 1"
                      : activeRestockUnit === "Gram"
                      ? "Contoh: 250"
                      : "Contoh: 5"
                  }
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none pr-12 font-medium"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-outline font-bold">
                  {activeRestockUnit}
                </span>
              </div>
            </div>
          </div>

          {/* Input Konversi Isi per Kemasan (Pcs) khusus untuk Kardus, Bungkus, Pack, dsb */}
          {isPackageUnit && (
            <div className="p-3 rounded-xl bg-primary-container/10 border border-primary/30 flex flex-col gap-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-primary text-xs font-bold">
                  <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                  <span>Rincian Isi Kemasan Pembelian</span>
                </div>
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                  Konversi ke Pcs
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 items-center">
                <div>
                  <label className="block text-[10px] font-bold text-outline uppercase mb-1">
                    Berapa Pcs per {unit}?
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={pcsPerUnit}
                      onChange={(e) => setPcsPerUnit(e.target.value)}
                      placeholder={
                        unit.includes("Kardus")
                          ? "Contoh: 24 / 40"
                          : unit.includes("Pack")
                          ? "Contoh: 10 / 12"
                          : "Contoh: 5 / 10"
                      }
                      className="w-full bg-surface-container-low rounded-lg px-3 py-1.5 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs font-bold pr-10"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-outline font-semibold">
                      Pcs
                    </span>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-outline uppercase mb-1">Total Stok Masuk</span>
                  <div className="px-3 py-1.5 bg-surface-container rounded-lg border border-outline-variant/20 flex items-center justify-between text-xs font-bold text-primary min-h-[32px]">
                    <span>{totalPcs ? `${totalPcs} Pcs` : "-"}</span>
                    {totalPcs ? (
                      <span className="text-[10px] text-outline font-normal">
                        ({parsedQty} {unit} × {parsedPcs} pcs)
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {totalPcs > 0 && (
                <div className="pt-2 border-t border-outline-variant/20 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-primary">
                    <span className="material-symbols-outlined text-[15px] shrink-0">info</span>
                    <span>
                      Stok dapur otomatis dicatat sebagai <strong>{totalPcs} Pcs</strong>. Restock akan diperingatkan jika sisa &le; <strong>{minQuantity || 5} Pcs</strong>.
                    </span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-on-surface-variant pt-1">
                    <input
                      type="checkbox"
                      checked={appendPackNote}
                      onChange={(e) => setAppendPackNote(e.target.checked)}
                      className="rounded text-primary focus:ring-0 bg-surface-container border-outline-variant/30"
                    />
                    <span>
                      Sertakan info kemasan pada nama barang:{" "}
                      <strong className="text-on-surface">
                        {name || "Bahan"} ({parsedQty} {unit} @ {parsedPcs} pcs)
                      </strong>
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">
              Harga Beli Awal (Rp) <span className="text-[10px] text-outline font-normal">(Opsional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xs font-bold">Rp</span>
              <input
                type="number"
                step="any"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Contoh: 25000"
                className="w-full bg-surface-container-low rounded-lg pl-9 pr-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-medium text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Tanggal Kedaluwarsa (Expiry Date)</label>
            <input
              type="date"
              required
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-container hover:bg-surface-bright text-on-surface py-2 rounded-lg text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-container text-on-primary-container hover:bg-primary py-2 rounded-lg text-xs font-bold disabled:opacity-50 shadow-md"
            >
              {loading ? "Menyimpan..." : "Simpan ke Dapur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

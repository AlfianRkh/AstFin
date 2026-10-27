import React, { useState, useEffect, useMemo } from "react";
import {
  FRUIT_EXPIRY_DATABASE,
  detectFruit,
  normalizeStorageZone,
  calculateFruitExpiry,
} from "../../utils/fruitExpiryHelper";

const CATEGORIES = ["Semua", "Buah Tropis", "Buah Subtropis", "Buah Sitrus", "Buah Berry", "Sayur Buah", "Sayur & Bumbu Segar"];

export function FruitExpiryCalculatorModal({
  isOpen,
  onClose,
  initialFruitName = "",
  initialStorageZone = "Kulkas (Chiller)",
  onApplyExpiry, // Callback jika dipanggil dari AddPantryModal: (result) => void
  onAddToPantry, // Callback jika dipanggil dari DapurInventaris: (itemData) => void
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [selectedFruit, setSelectedFruit] = useState(null);
  
  // Parameter kalkulasi
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [storageType, setStorageType] = useState("chiller"); // 'room_temp' | 'chiller' | 'freezer'
  const [condition, setCondition] = useState("ripe"); // 'unripe' | 'ripe' | 'cut'

  // Tab detail: 'calculator' | 'tips' | 'spoilage'
  const [activeTab, setActiveTab] = useState("calculator");

  // Inisialisasi saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setActiveTab("calculator");
      setPurchaseDate(new Date().toISOString().split("T")[0]);

      // Deteksi jika ada initialFruitName
      let matched = null;
      if (initialFruitName) {
        matched = detectFruit(initialFruitName);
      }
      if (matched) {
        setSelectedFruit(matched);
      } else if (!selectedFruit) {
        // Default ke pisang jika belum ada pilihan
        setSelectedFruit(FRUIT_EXPIRY_DATABASE[0]);
      }

      // Selaraskan storageType dari initialStorageZone jika ada
      if (initialStorageZone) {
        setStorageType(normalizeStorageZone(initialStorageZone));
      }
    }
  }, [isOpen, initialFruitName, initialStorageZone]);

  // Filter daftar buah
  const filteredFruits = useMemo(() => {
    return FRUIT_EXPIRY_DATABASE.filter((fruit) => {
      const matchCat = selectedCategory === "Semua" || fruit.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        fruit.name.toLowerCase().includes(q) ||
        fruit.aliases.some((a) => a.toLowerCase().includes(q)) ||
        fruit.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [searchQuery, selectedCategory]);

  // Hasil kalkulasi
  const calculationResult = useMemo(() => {
    if (!selectedFruit) return null;
    return calculateFruitExpiry({
      fruitId: selectedFruit.id,
      storageType,
      condition,
      baseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
    });
  }, [selectedFruit, storageType, condition, purchaseDate]);

  if (!isOpen) return null;

  const handleApplyToForm = () => {
    if (!calculationResult) return;
    onApplyExpiry?.({
      expiryDate: calculationResult.expiryDate,
      recommendedCategory:
        storageType === "chiller"
          ? "Kulkas (Chiller)"
          : storageType === "freezer"
          ? "Freezer"
          : "Suhu Ruang / Meja Dapur",
      fruit: selectedFruit,
    });
    onClose();
  };

  const handleCreatePantryDirectly = () => {
    if (!calculationResult) return;
    onAddToPantry?.({
      name: `Buah ${selectedFruit.name}`,
      category:
        storageType === "chiller"
          ? "Kulkas (Chiller)"
          : storageType === "freezer"
          ? "Freezer"
          : "Suhu Ruang / Meja Dapur",
      quantity: 1,
      unit: "Kg",
      min_quantity: 0.5,
      expiry_date: calculationResult.expiryDate,
      price: 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface max-h-[92vh] overflow-hidden">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary-container/20 text-primary flex items-center justify-center text-xl shrink-0">
              🍎
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-on-surface leading-tight">
                  Kalkulator & Panduan Kedaluwarsa Buah Segar
                </h3>
                <span className="text-[10px] bg-primary/20 text-primary font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Zero-Waste AI
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Estimasi masa simpan buah & bahan segar tanpa label kemasan berdasarkan sains ketahanan pangan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col lg:grid lg:grid-cols-12 gap-4">
          
          {/* Kolom Kiri: Katalog & Pencarian Buah (5 kolom di Desktop) */}
          <div className="lg:col-span-5 flex flex-col gap-3 min-w-0 border-b lg:border-b-0 lg:border-r border-outline-variant/20 pb-4 lg:pb-0 lg:pr-3">
            <div>
              <label className="text-[11px] font-bold text-outline uppercase block mb-1.5">
                Cari Buah / Bahan Segar
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik pisang, apel, alpukat..."
                  className="w-full bg-surface-container-low rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Kategori */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? "bg-primary text-on-primary font-bold shadow-sm"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-bright"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* List Buah Grid */}
            <div className="flex-1 max-h-56 lg:max-h-[360px] overflow-y-auto grid grid-cols-2 gap-2 pr-1">
              {filteredFruits.map((fruit) => {
                const isSelected = selectedFruit?.id === fruit.id;
                return (
                  <button
                    key={fruit.id}
                    onClick={() => setSelectedFruit(fruit)}
                    className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all border ${
                      isSelected
                        ? "bg-primary/15 border-primary shadow-sm"
                        : "bg-surface-container-low border-outline-variant/15 hover:border-outline-variant/40 hover:bg-surface-container"
                    }`}
                  >
                    <span className="text-2xl shrink-0">{fruit.icon}</span>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-xs font-bold truncate ${isSelected ? "text-primary" : "text-on-surface"}`}>
                        {fruit.name}
                      </span>
                      <span className="text-[10px] text-outline truncate">{fruit.category}</span>
                    </div>
                  </button>
                );
              })}
              {filteredFruits.length === 0 && (
                <div className="col-span-2 py-6 text-center text-xs text-outline">
                  Buah tidak ditemukan dalam katalog
                </div>
              )}
            </div>
          </div>

          {/* Kolom Kanan: Simulator Kalkulator & Rekomendasi (7 kolom di Desktop) */}
          <div className="lg:col-span-7 flex flex-col gap-3 min-w-0">
            {selectedFruit ? (
              <>
                {/* Banner Buah Terpilih */}
                <div className="bg-gradient-to-r from-surface-container-low via-surface-container to-surface-container-low p-3.5 rounded-2xl border border-primary/30 flex items-start justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl sm:text-4xl">{selectedFruit.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm sm:text-base font-extrabold text-on-surface">
                          {selectedFruit.name}
                        </h4>
                        <span className="text-[10px] bg-surface-container-highest px-2 py-0.5 rounded-md text-secondary font-medium">
                          {selectedFruit.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        {selectedFruit.recommendedStorage}
                      </p>
                    </div>
                  </div>
                  {/* Badge Etilen */}
                  <span className="text-[9px] bg-secondary/15 text-secondary px-2 py-1 rounded-lg font-bold max-w-[120px] text-right shrink-0">
                    {selectedFruit.ethylene.split("(")[0]}
                  </span>
                </div>

                {/* Sub Navigation Tab */}
                <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-1 text-xs">
                  <button
                    onClick={() => setActiveTab("calculator")}
                    className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-bold transition-all ${
                      activeTab === "calculator"
                        ? "bg-primary-container text-on-primary-container shadow-sm"
                        : "text-outline hover:text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">calculate</span>
                    <span>Kalkulator Exp</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("tips")}
                    className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-bold transition-all ${
                      activeTab === "tips"
                        ? "bg-primary-container text-on-primary-container shadow-sm"
                        : "text-outline hover:text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">tips_and_updates</span>
                    <span>Tips Simpan ({selectedFruit.storageTips.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("spoilage")}
                    className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-bold transition-all ${
                      activeTab === "spoilage"
                        ? "bg-primary-container text-on-primary-container shadow-sm"
                        : "text-outline hover:text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    <span>Ciri Rusak / Busuk</span>
                  </button>
                </div>

                {/* TAB 1: KALKULATOR EXP DATE */}
                {activeTab === "calculator" && (
                  <div className="flex flex-col gap-3">
                    {/* Controls Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Tanggal Beli */}
                      <div>
                        <label className="text-[10px] font-bold text-outline uppercase block mb-1">
                          Tgl Beli / Terima
                        </label>
                        <input
                          type="date"
                          value={purchaseDate}
                          onChange={(e) => setPurchaseDate(e.target.value)}
                          className="w-full bg-surface-container-low rounded-xl px-2.5 py-1.5 text-xs text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-medium"
                        />
                      </div>

                      {/* Kondisi Buah */}
                      <div>
                        <label className="text-[10px] font-bold text-outline uppercase block mb-1">
                          Kondisi Saat Ini
                        </label>
                        <select
                          value={condition}
                          onChange={(e) => setCondition(e.target.value)}
                          className="w-full bg-surface-container-low rounded-xl px-2.5 py-1.5 text-xs text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-medium"
                        >
                          <option value="unripe">Mengkal / Belum Matang</option>
                          <option value="ripe">Matang Pas (Siap Makan)</option>
                          <option value="cut">Sudah Dipotong / Kupas</option>
                        </select>
                      </div>

                      {/* Lokasi Simpan */}
                      <div>
                        <label className="text-[10px] font-bold text-outline uppercase block mb-1">
                          Tempat Simpan
                        </label>
                        <select
                          value={storageType}
                          onChange={(e) => setStorageType(e.target.value)}
                          className="w-full bg-surface-container-low rounded-xl px-2.5 py-1.5 text-xs text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-medium"
                        >
                          <option value="room_temp">Suhu Ruang / Keranjang</option>
                          <option value="chiller">Kulkas (Chiller)</option>
                          <option value="freezer">Freezer (Beku)</option>
                        </select>
                      </div>
                    </div>

                    {/* Matrix Perbandingan Daya Tahan Cepat */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div
                        onClick={() => setStorageType("room_temp")}
                        className={`p-2 rounded-xl cursor-pointer transition-all border ${
                          storageType === "room_temp"
                            ? "bg-amber-400/10 border-amber-400/50 shadow-sm"
                            : "bg-surface-container-low border-outline-variant/10 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-outline block">Suhu Ruang</span>
                        <span className="text-sm font-extrabold text-amber-300">
                          {selectedFruit.shelfLife.room_temp[condition] || selectedFruit.shelfLife.room_temp.ripe} Hari
                        </span>
                      </div>

                      <div
                        onClick={() => setStorageType("chiller")}
                        className={`p-2 rounded-xl cursor-pointer transition-all border ${
                          storageType === "chiller"
                            ? "bg-primary/10 border-primary/50 shadow-sm"
                            : "bg-surface-container-low border-outline-variant/10 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-outline block">Kulkas (Chiller)</span>
                        <span className="text-sm font-extrabold text-primary">
                          {selectedFruit.shelfLife.chiller[condition] || selectedFruit.shelfLife.chiller.ripe} Hari
                        </span>
                      </div>

                      <div
                        onClick={() => setStorageType("freezer")}
                        className={`p-2 rounded-xl cursor-pointer transition-all border ${
                          storageType === "freezer"
                            ? "bg-secondary/10 border-secondary/50 shadow-sm"
                            : "bg-surface-container-low border-outline-variant/10 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-outline block">Freezer Beku</span>
                        <span className="text-sm font-extrabold text-secondary">
                          {selectedFruit.shelfLife.freezer[condition] || selectedFruit.shelfLife.freezer.ripe} Hari
                        </span>
                      </div>
                    </div>

                    {/* HASIL ESTIMASI UTAMA (HERO CARD) */}
                    {calculationResult && (
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-primary-container/20 to-primary-container/5 border border-primary/40 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">verified</span>
                            <span>Estimasi Batas Kedaluwarsa Aman</span>
                          </span>
                          <span className="text-xs bg-primary text-on-primary px-2.5 py-0.5 rounded-full font-extrabold shadow-sm">
                            +{calculationResult.shelfLifeDays} Hari Lagi
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between flex-wrap gap-2 pt-1 border-t border-primary/20">
                          <div>
                            <span className="text-lg sm:text-xl font-black text-on-surface">
                              {calculationResult.expiryDateFormatted}
                            </span>
                            <span className="text-xs text-outline block font-mono">
                              ({calculationResult.expiryDate})
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-outline block uppercase">Zona Direkomendasikan:</span>
                            <span className="text-xs font-bold text-secondary">
                              {storageType === "chiller"
                                ? "Kulkas (Chiller)"
                                : storageType === "freezer"
                                ? "Freezer"
                                : "Suhu Ruang"}
                            </span>
                          </div>
                        </div>

                        {/* Catatan spesifik bila ada peringatan khusus (misal pisang di chiller) */}
                        {selectedFruit.id === "pisang" && storageType === "chiller" && condition === "unripe" && (
                          <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">warning</span>
                            <span>
                              Perhatian: Menyimpan pisang yang masih hijau di chiller akan menghentikan pematangannya secara permanen. Sebaiknya taruh di suhu ruang terlebih dahulu.
                            </span>
                          </div>
                        )}

                        {selectedFruit.id === "stroberi" && storageType === "room_temp" && (
                          <div className="p-2 rounded-lg bg-error-container/20 border border-error/30 text-[11px] text-error flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">info</span>
                            <span>
                              Stroberi di suhu ruang tropis cepat sekali membusuk (1-2 hari). Sangat disarankan disimpan di kulkas beralas tisu kering.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: TIPS PENYIMPANAN */}
                {activeTab === "tips" && (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                      <span>Cara Simpan {selectedFruit.name} Agar Segar Lebih Lama:</span>
                    </span>
                    {selectedFruit.storageTips.map((tip, idx) => (
                      <div
                        key={idx}
                        className="bg-surface-container-low p-2.5 rounded-xl border border-outline-variant/15 flex items-start gap-2.5 text-xs text-on-surface leading-relaxed"
                      >
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 3: TANDA-TANDA KEBUSUKAN */}
                {activeTab === "spoilage" && (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                    <span className="text-xs font-bold text-error flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">report</span>
                      <span>Indikator {selectedFruit.name} Sudah Rusak / Tidak Layak Konsumsi:</span>
                    </span>
                    {selectedFruit.spoilageSigns.map((sign, idx) => (
                      <div
                        key={idx}
                        className="bg-surface-container-low p-2.5 rounded-xl border border-error/20 flex items-start gap-2.5 text-xs text-on-surface leading-relaxed"
                      >
                        <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">
                          dangerous
                        </span>
                        <span>{sign}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-outline">
                <span className="text-4xl mb-2">🍍</span>
                <p className="text-xs font-semibold">Pilih buah dari daftar sebelah kiri untuk melihat estimasi dan panduan.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant/20 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-bright text-on-surface text-xs font-semibold transition-colors"
          >
            Tutup
          </button>

          {/* Mode 1: Dipanggil dari AddPantryModal */}
          {onApplyExpiry && (
            <button
              type="button"
              onClick={handleApplyToForm}
              className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>Terapkan Tanggal ke Form ({calculationResult?.expiryDate})</span>
            </button>
          )}

          {/* Mode 2: Dipanggil dari DapurInventaris (Direct add) */}
          {onAddToPantry && (
            <button
              type="button"
              onClick={handleCreatePantryDirectly}
              className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">add_box</span>
              <span>+ Masukkan Buah ke Dapur ({calculationResult?.expiryDate})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

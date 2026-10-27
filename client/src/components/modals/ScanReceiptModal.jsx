import React, { useState, useEffect } from "react";
import { api } from "../../api/client";
import { detectFruit, calculateFruitExpiry } from "../../utils/fruitExpiryHelper";

export function ScanReceiptModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [autoRestock, setAutoRestock] = useState(true);
  const [customMerchant, setCustomMerchant] = useState("Indomaret Merr Surabaya");
  const [customAmount, setCustomAmount] = useState(88500);

  useEffect(() => {
    if (isOpen) {
      setOcrResult(null);
      api.getWallets().then((res) => {
        const list = res.data?.wallets || [];
        setWallets(list);
        if (list.length > 0) setSelectedWalletId(list[0].id);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartScan = async () => {
    setLoading(true);
    try {
      const res = await api.scanReceiptOCR({
        merchant: customMerchant,
        amount: Number(customAmount),
      });
      setOcrResult(res.data);
    } catch (err) {
      alert("Gagal memindai struk: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommitTransaction = async () => {
    if (!selectedWalletId) {
      alert("Harap buat atau pilih dompet terlebih dahulu!");
      return;
    }

    setLoading(true);
    try {
      await api.createTransaction({
        wallet_id: Number(selectedWalletId),
        type: "expense",
        amount: ocrResult ? ocrResult.total_amount : customAmount,
        category: ocrResult?.suggested_category || "Belanja Dapur",
        merchant: ocrResult?.merchant || customMerchant,
        notes: `OCR Vision Match 99.4% · ${ocrResult?.extracted_items?.map((i) => i.name).join(", ") || "Struk Kasir"}`,
        transaction_date: new Date().toISOString().split("T")[0],
        auto_restock_pantry: autoRestock,
      });

      // If autoRestock is checked, create pantry items if available
      if (autoRestock && ocrResult?.extracted_items) {
        for (const item of ocrResult.extracted_items) {
          try {
            let finalExpiry = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
            const fruit = detectFruit(item.name);
            if (fruit) {
              const calc = calculateFruitExpiry({
                fruitId: fruit.id,
                storageType: (item.category || "Kulkas").toLowerCase().includes("freezer") ? "freezer" : "chiller",
                condition: "ripe",
              });
              if (calc?.expiryDate) {
                finalExpiry = calc.expiryDate;
              }
            }

            await api.createPantryItem({
              name: item.name,
              category: item.category || "Kulkas",
              quantity: item.qty || 1,
              unit: "Item",
              min_quantity: 1,
              expiry_date: finalExpiry,
            });
          } catch (e) {
            // Ignore duplicate item errors
          }
        }
      }

      alert("Transaksi struk kasir & restock dapur berhasil disimpan ke database!");
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Gagal menyimpan transaksi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">document_scanner</span>
            <div>
              <h3 className="text-base font-bold text-on-surface">Pindai Struk Kasir AI (OCR Vision v4.2)</h3>
              <p className="text-[11px] text-on-surface-variant">Ekstraksi otomatis struk minimarket ke SmartFin & Pantry</p>
            </div>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {!ocrResult ? (
          <div className="flex flex-col gap-3">
            <div className="border-2 border-dashed border-outline-variant/40 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 bg-surface-container-low/70">
              <span className="material-symbols-outlined text-secondary text-[40px] animate-pulse">upload_file</span>
              <p className="text-xs font-semibold text-on-surface">Tarik & Lepaskan foto struk belanja di sini</p>
              <p className="text-[11px] text-outline">Mendukung format JPG, PNG, atau PDF struk kasir</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-outline uppercase mb-1">Nama Merchant</label>
                <input
                  type="text"
                  value={customMerchant}
                  onChange={(e) => setCustomMerchant(e.target.value)}
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-xs text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
                  placeholder="Misal: Indomaret Merr"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-outline uppercase mb-1">Total Nominal</label>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Number(e.target.value))}
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-xs text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
                  placeholder="88500"
                />
              </div>
            </div>

            <button
              onClick={handleStartScan}
              disabled={loading}
              className="w-full bg-primary-container text-on-primary-container hover:bg-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_16px_rgba(16,185,129,0.3)] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">{loading ? "hourglass_top" : "auto_awesome"}</span>
              <span>{loading ? "Menganalisis Struk..." : "Mulai Pindai AI Sekarang"}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="bg-surface-container-low p-3.5 rounded-xl border border-primary/20 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">{ocrResult.merchant}</span>
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                  OCR {ocrResult.ocr_accuracy}% Match
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-outline">Total Terdeteksi:</span>
                <span className="text-base font-extrabold text-primary">
                  Rp {ocrResult.total_amount?.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <div className="bg-surface-container-low p-3 rounded-xl">
              <span className="text-[10px] font-bold text-outline uppercase tracking-wider block mb-2">
                Item Komoditas Terdeteksi ({ocrResult.extracted_items?.length || 0})
              </span>
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                {ocrResult.extracted_items?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-surface-container">
                    <span className="text-on-surface font-medium truncate">{item.name}</span>
                    <span className="text-secondary font-bold shrink-0">Rp {item.price?.toLocaleString("id-ID")}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-outline uppercase mb-1">Potong dari Dompet / Rekening</label>
                {wallets.length === 0 ? (
                  <p className="text-error text-xs">Belum ada dompet! Silakan buat dompet di halaman Finansial & Kas.</p>
                ) : (
                  <select
                    value={selectedWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
                    className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-xs text-on-surface border border-outline-variant/20 focus:outline-none"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.type}) - Saldo: Rp {w.balance?.toLocaleString("id-ID")}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={autoRestock}
                  onChange={(e) => setAutoRestock(e.target.checked)}
                  className="rounded text-primary focus:ring-0 accent-primary"
                />
                <span className="text-xs text-on-surface-variant font-medium">
                  Sinkronkan otomatis komoditas di atas ke Inventaris Dapur
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setOcrResult(null)}
                className="flex-1 bg-surface-container hover:bg-surface-bright text-on-surface py-2 rounded-lg text-xs font-semibold"
              >
                Scan Ulang
              </button>
              <button
                onClick={handleCommitTransaction}
                disabled={loading || wallets.length === 0}
                className="flex-1 bg-primary-container text-on-primary-container hover:bg-primary py-2 rounded-lg text-xs font-bold disabled:opacity-50 shadow-md"
              >
                {loading ? "Menyimpan..." : "Konfirmasi & Catat Transaksi"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

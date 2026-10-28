import React, { useState, useEffect, useRef } from "react";
import { api, getImageUrl } from "../../api/client";
import { ScanBarcodeModal } from "./ScanBarcodeModal";

export function EditProductModal({
  isOpen,
  onClose,
  product,
  categories = [],
  onSuccess = () => {},
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [baseUnit, setBaseUnit] = useState("pcs");
  const [barcode, setBarcode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [notes, setNotes] = useState("");

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isScanOpen, setIsScanOpen] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setCategoryId(product.category_id ? String(product.category_id) : "");
      setBaseUnit(product.base_unit || "pcs");
      setBarcode(product.barcode || "");
      setImageUrl(product.image_url || "");
      setNotes(product.notes || "");
      setError("");
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar (JPG, PNG, WEBP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 10MB");
      return;
    }

    setUploadingImage(true);
    setError("");

    try {
      const res = await api.uploadImage(file);
      if (res.url) {
        setImageUrl(res.url);
      }
    } catch (err) {
      setError("Gagal mengunggah gambar: " + err.message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama produk wajib diisi");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await api.updatePriceProduct(product.id, {
        name: name.trim(),
        category_id: categoryId ? parseInt(categoryId, 10) : null,
        base_unit: baseUnit.trim() || "pcs",
        barcode: barcode.trim(),
        image_url: imageUrl.trim(),
        notes: notes.trim(),
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Gagal memperbarui detail produk");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-5 border-b border-outline-variant/15 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">edit_note</span>
              </div>
              <div>
                <h3 className="font-extrabold text-base text-on-surface">Edit Detail Produk</h3>
                <p className="text-xs text-outline-variant">
                  Perbarui nama, foto, barcode, dan satuan produk
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

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* Product Image Section */}
            <div>
              <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-2">
                Foto / Gambar Produk
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-surface-container-highest/40 border border-outline-variant/20">
                {/* Preview Box */}
                <div className="w-24 h-24 rounded-2xl bg-surface-container-high border border-outline-variant/30 overflow-hidden shrink-0 flex items-center justify-center relative group">
                  {imageUrl ? (
                    <>
                      <img
                        src={getImageUrl(imageUrl)}
                        alt={name || "Preview"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-red-400 text-[10px] font-bold"
                        title="Hapus Gambar"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                        <span>Hapus</span>
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-2 text-outline-variant">
                      <span className="material-symbols-outlined text-3xl">image</span>
                      <span className="text-[10px] block mt-0.5">Tanpa Foto</span>
                    </div>
                  )}
                </div>

                {/* Upload Buttons */}
                <div className="space-y-2 flex-1 w-full text-center sm:text-left">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageFileChange}
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {uploadingImage ? "progress_activity" : "upload"}
                      </span>
                      <span>{uploadingImage ? "Mengunggah..." : "Pilih File / Kamera"}</span>
                    </button>

                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="px-3 py-2 bg-surface-container hover:bg-red-500/10 text-outline-variant hover:text-red-400 border border-outline-variant/20 rounded-xl text-xs font-semibold transition-all"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-outline-variant">
                    Format JPG, PNG, atau WEBP. Maksimal ukuran file 10MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
                Nama Produk / Barang *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Minyak Goreng Filma 2L, Telur Ayam 1kg"
                className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-4 py-2.5 text-xs text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary transition-colors font-medium"
              />
            </div>

            {/* Category and Base Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
                  Kategori
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">Pilih Kategori...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
                  Satuan Acuan Perbandingan *
                </label>
                <select
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                  className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors uppercase font-medium"
                >
                  <option value="pcs">pcs (buah / biji)</option>
                  <option value="kg">kg (kilogram)</option>
                  <option value="gram">gram</option>
                  <option value="liter">liter</option>
                  <option value="ml">ml (mililiter)</option>
                  <option value="pack">pack</option>
                  <option value="botol">botol</option>
                  <option value="dus">dus / kardus</option>
                  <option value="ikat">ikat</option>
                  <option value="butir">butir</option>
                </select>
              </div>
            </div>

            {/* Barcode / SKU with Scan Button */}
            <div>
              <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
                Barcode / Kode Produk (EAN, UPC)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Contoh: 8992388123456"
                  className="flex-1 bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl px-4 py-2.5 text-xs text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setIsScanOpen(true)}
                  className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                  title="Pindai barcode dengan kamera"
                >
                  <span className="material-symbols-outlined text-[18px]">barcode_scanner</span>
                  <span>Scan</span>
                </button>
              </div>
              <p className="text-[10px] text-outline-variant mt-1">
                Scan barcode fisik produk di supermarket untuk membandingkan harga otomatis tanpa mengetik.
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Spesifikasi ukuran, merk favorit, atau tips penyimpanan..."
                className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-2xl p-3 text-xs text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-outline-variant/15 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-surface-container-high text-on-surface text-xs font-semibold rounded-2xl hover:bg-surface-container-highest transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || uploadingImage}
                className="px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 flex items-center gap-2"
              >
                {saving ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">check</span>
                )}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <ScanBarcodeModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onScan={(scanned) => setBarcode(scanned)}
        title="Pindai Barcode Produk"
        description="Arahkan kamera ke barcode kemasan barang"
      />
    </>
  );
}

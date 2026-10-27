import React, { useState } from "react";
import { api } from "../../api/client";
import { OSMMapPicker } from "../OSMMapPicker";

export function AddStoreModal({ isOpen, onClose, onStoreCreated }) {
  const [name, setName] = useState("");
  const [storeType, setStoreType] = useState("minimarket");
  const [isMobile, setIsMobile] = useState(false);
  const [addressText, setAddressText] = useState("");
  const [lat, setLat] = useState(-7.4478);
  const [lng, setLng] = useState(112.7183);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama toko wajib diisi");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.createStore({
        name: name.trim(),
        store_type: storeType,
        is_mobile: isMobile,
        address_text: addressText,
        lat: lat || null,
        lng: lng || null,
      });

      if (res.data) {
        onStoreCreated(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || "Gagal menyimpan toko");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-outline-variant/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">storefront</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-on-surface">Tambah Toko / Pedagang</h3>
              <p className="text-xs text-outline-variant">Simpan lokasi toko untuk perbandingan harga</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-container text-outline-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
              Nama Toko / Pedagang *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Indomaret Pondok Jati, Tukang Sayur Mas Budi"
              className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary/80 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
                Jenis Toko
              </label>
              <select
                value={storeType}
                onChange={(e) => {
                  setStoreType(e.target.value);
                  if (e.target.value === "tukang_sayur") {
                    setIsMobile(true);
                  }
                }}
                className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-colors"
              >
                <option value="minimarket">Minimarket (Indomaret, Alfamart)</option>
                <option value="supermarket">Supermarket / Hypermarket</option>
                <option value="pasar">Pasar Tradisional</option>
                <option value="tukang_sayur">Tukang Sayur Keliling</option>
                <option value="grosir">Toko Grosir / Agen</option>
                <option value="warung">Warung Madura / Kelontong</option>
                <option value="online">Online / E-Commerce</option>
              </select>
            </div>

            <div className="flex items-center sm:pt-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isMobile}
                  onChange={(e) => setIsMobile(e.target.checked)}
                  className="rounded border-outline-variant/40 text-primary focus:ring-primary w-4 h-4 bg-surface-container-highest"
                />
                <span className="text-xs text-on-surface font-medium">
                  Pedagang Keliling (Rombong / Gerobak)
                </span>
              </label>
            </div>
          </div>

          {/* Map Location */}
          <div>
            <label className="block text-xs font-semibold text-outline-variant uppercase tracking-wider mb-1.5">
              Titik Lokasi (OpenStreetMap)
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
                <span>Simpan Toko</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

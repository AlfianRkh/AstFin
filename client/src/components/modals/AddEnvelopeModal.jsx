import React, { useState } from "react";
import { api } from "../../api/client";

export function AddEnvelopeModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [allocatedAmount, setAllocatedAmount] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !allocatedAmount || parseFloat(allocatedAmount) <= 0) {
      alert("Harap masukkan nama pos dan anggaran yang valid");
      return;
    }

    setLoading(true);
    try {
      await api.createEnvelope({
        name: name.trim(),
        allocated_amount: parseFloat(allocatedAmount),
        month_year: new Date().toISOString().slice(0, 7),
      });
      setName("");
      setAllocatedAmount("");
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Gagal membuat pos anggaran: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-high rounded-2xl max-w-md w-full p-6 shadow-2xl border border-surface-container-highest flex flex-col gap-4 text-on-surface">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">drafts</span>
            <h3 className="text-base font-bold text-on-surface">Tambah Pos Anggaran Digital (Envelope)</h3>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Nama Pos Anggaran</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Belanja Dapur & Groceries, Gadget, Hiburan"
              className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Alokasi Anggaran Bulan Ini (Rp)</label>
            <input
              type="number"
              required
              value={allocatedAmount}
              onChange={(e) => setAllocatedAmount(e.target.value)}
              placeholder="Contoh: 2000000"
              className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary font-bold"
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
              {loading ? "Menyimpan..." : "Simpan Pos Anggaran"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from "react";
import { api } from "../api/client";

export function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Current logged in user to avoid self-deletion
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("omni_user")) || {};
    } catch {
      return {};
    }
  }, []);

  const [formData, setFormData] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    role_name: "user",
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getUsers();
      setUsers(res.data || []);
    } catch (err) {
      alert("Gagal memuat daftar pengguna: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleChangeRole = async (userId, newRole) => {
    try {
      await api.updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role_name: newRole } : u))
      );
    } catch (err) {
      alert("Gagal memperbarui peran: " + err.message);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (userId === currentUser.id) {
      alert("Anda tidak dapat menghapus akun Anda sendiri!");
      return;
    }
    if (!window.confirm(`Yakin ingin menghapus akun '${username}'? Semua data terkait akun ini akan terpengaruh.`)) {
      return;
    }

    try {
      await api.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      alert("Gagal menghapus pengguna: " + err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.password) {
      alert("Username, Email, dan Password wajib diisi!");
      return;
    }
    if (formData.password.length < 6) {
      alert("Kata sandi minimal 6 karakter!");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.createUser(formData);
      setShowAddModal(false);
      setFormData({
        full_name: "",
        username: "",
        email: "",
        password: "",
        role_name: "user",
      });
      loadUsers();
    } catch (err) {
      alert("Gagal membuat akun: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const q = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role_name && u.role_name.toLowerCase().includes(q))
    );
  }, [users, searchTerm]);

  return (
    <div className="flex flex-col w-full px-space-md lg:px-space-xl py-space-lg">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-space-lg">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">admin_panel_settings</span>
            <h1 className="text-2xl font-extrabold text-on-surface">Manajemen Pengguna & Peran</h1>
          </div>
          <p className="text-xs text-on-surface-variant">
            Tools Administrator untuk membuat akun baru (User, Finance, Admin) dan mengelola hak akses sistem.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          <span>+ Buat Akun Baru</span>
        </button>
      </div>

      {/* Filter and Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-space-md">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Cari pengguna berdasarkan nama, username, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface-container rounded-xl text-xs text-on-surface placeholder:text-outline/60 border border-outline-variant/20 focus:border-primary focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-on-surface-variant self-end sm:self-center">
          <span className="font-semibold text-on-surface">{filteredUsers.length}</span> pengguna terdaftar
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface-container-low rounded-2xl p-space-lg shadow-xl border border-outline-variant/15 overflow-x-auto">
        <table className="w-full text-left text-xs text-on-surface border-collapse">
          <thead>
            <tr className="border-b border-outline-variant/20 text-outline uppercase font-bold text-[10px]">
              <th className="pb-3 px-3">ID</th>
              <th className="pb-3 px-3">Nama Lengkap</th>
              <th className="pb-3 px-3">Username</th>
              <th className="pb-3 px-3">Email</th>
              <th className="pb-3 px-3">Role Saat Ini</th>
              <th className="pb-3 px-3">Ubah Role</th>
              <th className="pb-3 px-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-8 text-on-surface-variant text-xs">
                  Memuat data pengguna...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-8 text-on-surface-variant text-xs">
                  Tidak ada data pengguna yang cocok.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const isMe = u.id === currentUser.id;
                return (
                  <tr key={u.id} className="hover:bg-surface-container/50 transition-colors">
                    <td className="py-3 px-3 font-mono text-outline">#{u.id}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-on-surface flex items-center gap-1.5">
                        {u.full_name || "-"}
                        {isMe && (
                          <span className="px-1.5 py-0.2 bg-primary/20 text-primary text-[9px] rounded font-bold uppercase">
                            Anda
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-secondary font-medium">{u.username}</td>
                    <td className="py-3 px-3 text-outline">{u.email}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] inline-flex items-center gap-1 ${
                          u.role_name === "admin"
                            ? "bg-primary-container text-on-primary-container"
                            : u.role_name === "finance"
                            ? "bg-secondary-container text-on-secondary-container"
                            : "bg-surface-container-highest text-on-surface-variant"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {u.role_name === "admin"
                            ? "shield_person"
                            : u.role_name === "finance"
                            ? "account_balance"
                            : "person"}
                        </span>
                        {u.role_name}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={u.role_name}
                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                        className="bg-surface-container rounded-lg px-2.5 py-1 text-xs text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary transition-colors"
                      >
                        <option value="user">User (Standar)</option>
                        <option value="finance">Finance (Keuangan)</option>
                        <option value="admin">Admin (Administrator)</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {!isMe && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          title="Hapus Pengguna"
                          className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Buat Akun Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-surface-container-high border border-outline-variant/20 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">person_add</span>
                <h2 className="text-base font-bold text-on-surface">Buat Akun Pengguna Baru</h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  placeholder="misal: Budi Santoso"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container rounded-xl text-xs text-on-surface border border-outline-variant/20 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="misal: budisantoso"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container rounded-xl text-xs text-on-surface border border-outline-variant/20 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="misal: budi@domain.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container rounded-xl text-xs text-on-surface border border-outline-variant/20 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                  Kata Sandi (Password)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container rounded-xl text-xs text-on-surface border border-outline-variant/20 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                  Tentukan Peran (Role)
                </label>
                <select
                  value={formData.role_name}
                  onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container rounded-xl text-xs text-on-surface border border-outline-variant/20 focus:border-primary focus:outline-none"
                >
                  <option value="user">User - Pengguna Standar (Dompet, Transaksi, Pantry, Perbandingan Harga)</option>
                  <option value="finance">Finance - Hak Akses Divisi Keuangan & Pembukuan</option>
                  <option value="admin">Admin - Administrator Lengkap (Kelola Pengguna & Seluruh Konfigurasi)</option>
                </select>
                <p className="text-[10px] text-on-surface-variant mt-1">
                  Pilihlah peran sesuai wewenang akun yang ingin dibuat.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/15 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>{isSubmitting ? "Menyimpan..." : "Buat Akun"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


import React, { useState, useEffect } from "react";
import { api } from "../api/client";

export function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
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
      alert(`Peran pengguna berhasil diubah menjadi ${newRole}!`);
      loadUsers();
    } catch (err) {
      alert("Gagal memperbarui peran: " + err.message);
    }
  };

  return (
    <div className="flex flex-col w-full px-space-md lg:px-space-xl py-space-lg">
      <div className="flex flex-col gap-1 mb-space-lg">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[24px]">admin_panel_settings</span>
          <h1 className="text-2xl font-extrabold text-on-surface">Manajemen Pengguna & Peran (Role-Based Access Control)</h1>
        </div>
        <p className="text-xs text-on-surface-variant">
          Modul eksklusif Administrator untuk mengelola hak akses role pengguna (admin, finance, user).
        </p>
      </div>

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
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-container/50 transition-colors">
                <td className="py-3 px-3 font-mono text-outline">#{u.id}</td>
                <td className="py-3 px-3 font-semibold text-on-surface">{u.full_name}</td>
                <td className="py-3 px-3 text-secondary font-medium">{u.username}</td>
                <td className="py-3 px-3 text-outline">{u.email}</td>
                <td className="py-3 px-3">
                  <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                    u.role_name === "admin"
                      ? "bg-primary-container text-on-primary-container"
                      : u.role_name === "finance"
                      ? "bg-secondary-container text-on-secondary-container"
                      : "bg-surface-container-highest text-on-surface-variant"
                  }`}>
                    {u.role_name}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <select
                    value={u.role_name}
                    onChange={(e) => handleChangeRole(u.id, e.target.value)}
                    className="bg-surface-container rounded-lg px-2.5 py-1 text-xs text-on-surface border border-outline-variant/20 focus:outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="finance">Finance</option>
                    <option value="user">User</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

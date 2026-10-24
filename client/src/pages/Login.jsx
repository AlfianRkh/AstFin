import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [roleName, setRoleName] = useState("user");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await register({
          username: username.trim(),
          email: email.trim(),
          password,
          full_name: fullName.trim() || username.trim(),
          role_name: roleName,
        });
      } else {
        await login({
          username_or_email: username.trim(),
          password,
        });
      }
      navigate("/");
    } catch (err) {
      setError(err.message || "Autentikasi gagal. Silakan periksa kembali data Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-[130px]"></div>
      <div className="pointer-events-none absolute -bottom-20 left-10 -z-10 h-72 w-72 rounded-full bg-secondary/10 blur-[110px]"></div>

      <div className="max-w-md w-full bg-surface-container-low rounded-2xl p-8 shadow-2xl border border-surface-container-highest flex flex-col gap-6 text-on-surface">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center font-bold text-2xl shadow-[0_0_20px_rgba(78,222,163,0.3)] mb-3">
            <span className="material-symbols-outlined text-[30px]">all_inclusive</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-on-surface">OmniLife Nexus</h1>
          <p className="text-xs text-primary font-bold uppercase tracking-widest mt-0.5">Unified Life OS v2.4</p>
          <p className="text-xs text-on-surface-variant mt-2">
            {isRegister ? "Daftar akun baru & mulai kelola ekosistem hidup Anda" : "Masuk ke pusat komando finansial & logistik cerdas"}
          </p>
        </div>

        {error && (
          <div className="bg-error-container/30 border border-error/40 text-error rounded-xl p-3 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          {isRegister && (
            <div>
              <label className="block text-[11px] font-bold text-outline uppercase mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Contoh: Alfian Saputra"
                className="w-full bg-surface-container rounded-lg px-3 py-2.5 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">
              {isRegister ? "Username" : "Username atau Email"}
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isRegister ? "alfian_s" : "Masukkan username atau email"}
              className="w-full bg-surface-container rounded-lg px-3 py-2.5 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-[11px] font-bold text-outline uppercase mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alfian@example.com"
                className="w-full bg-surface-container rounded-lg px-3 py-2.5 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">Kata Sandi (Password)</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full bg-surface-container rounded-lg px-3 py-2.5 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-[11px] font-bold text-outline uppercase mb-1">Peran / Role Pengguna</label>
              <select
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className="w-full bg-surface-container rounded-lg px-3 py-2 text-on-surface border border-outline-variant/30 focus:outline-none text-xs"
              >
                <option value="admin">Administrator (Full Control & User Management)</option>
                <option value="finance">Finance Manager (Kas & Ledger Khusus)</option>
                <option value="user">User Biasa (Personal Life OS)</option>
              </select>
              <p className="text-[10px] text-outline mt-1">*Pengguna pertama otomatis terdaftar sebagai Administrator.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-container text-on-primary-container hover:bg-primary py-2.5 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] disabled:opacity-50 mt-2"
          >
            {loading ? "Memproses..." : isRegister ? "Daftar Akun Baru" : "Masuk ke Dashboard"}
          </button>
        </form>

        <div className="flex items-center justify-center text-xs text-on-surface-variant border-t border-outline-variant/20 pt-4">
          <span>{isRegister ? "Sudah memiliki akun?" : "Belum punya akun?"}</span>
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="text-primary font-bold ml-1.5 hover:underline"
          >
            {isRegister ? "Masuk Sekarang" : "Daftar Pengguna Baru"}
          </button>
        </div>

        <div className="bg-surface-container-high/40 p-3 rounded-xl flex items-center justify-between text-[11px] text-outline">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-primary">security</span>
            Bcrypt + JWT HS256
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-secondary">speed</span>
            Pure Golang Engine
          </span>
        </div>
      </div>
    </div>
  );
}

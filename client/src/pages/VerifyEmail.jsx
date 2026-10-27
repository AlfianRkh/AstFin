import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../api/client";

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialEmail = searchParams.get("email") || "";
  const devCodeParam = searchParams.get("dev_code") || "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(devCodeParam);
  const [timeLeft, setTimeLeft] = useState(20 * 60); // 20 minutes in seconds
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [devCode, setDevCode] = useState(devCodeParam);

  // Countdown timer 20 minutes
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = email.trim();
    const cleanCode = code.trim();

    if (!cleanEmail) {
      setError("Alamat email wajib diisi.");
      return;
    }
    if (!cleanCode || cleanCode.length < 6) {
      setError("Silakan masukkan 6-digit kode verifikasi lengkap.");
      return;
    }
    if (timeLeft <= 0) {
      setError("Masa berlaku kode telah habis (20 menit). Silakan klik 'Kirim Ulang Kode'.");
      return;
    }

    try {
      setLoading(true);
      await api.verifyEmail({ email: cleanEmail, code: cleanCode });
      setSuccess("Selamat! Akun Anda berhasil diverifikasi dan diaktifkan. Mengalihkan ke login...");
      setTimeout(() => {
        navigate(`/login?verified=true&email=${encodeURIComponent(cleanEmail)}`);
      }, 1500);
    } catch (err) {
      setError(err.message || "Gagal memverifikasi kode OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Masukkan email Anda terlebih dahulu untuk mengirim ulang kode.");
      return;
    }

    try {
      setResending(true);
      setError("");
      const res = await api.resendVerificationCode({ email: cleanEmail });
      setTimeLeft(20 * 60); // Reset timer 20 minutes
      setSuccess("Kode verifikasi baru berhasil dikirim ke email Anda! (Berlaku 20 menit)");
      if (res.data?.dev_code) {
        setDevCode(res.data.dev_code);
        setCode(res.data.dev_code);
      }
    } catch (err) {
      setError(err.message || "Gagal mengirim ulang kode verifikasi.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-[130px]"></div>
      <div className="pointer-events-none absolute -bottom-20 left-10 -z-10 h-72 w-72 rounded-full bg-secondary/10 blur-[110px]"></div>

      <div className="max-w-md w-full bg-surface-container-low rounded-2xl p-8 shadow-2xl border border-surface-container-highest flex flex-col gap-6 text-on-surface">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center font-bold text-2xl shadow-[0_0_25px_rgba(78,222,163,0.3)] mb-3">
            <span className="material-symbols-outlined text-[32px]">mark_email_read</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-on-surface">Aktivasi & Verifikasi Akun</h1>
          <p className="text-xs text-primary font-bold uppercase tracking-widest mt-0.5">Kode OTP 20 Menit</p>
          <p className="text-xs text-on-surface-variant mt-2 max-w-sm">
            Masukkan 6 digit kode verifikasi yang telah kami kirimkan ke alamat email terdaftar Anda.
          </p>
        </div>

        {/* Timer Badge */}
        <div className="flex items-center justify-center">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              timeLeft === 0
                ? "bg-error/15 text-error border-error/30"
                : timeLeft < 300
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "bg-surface-container-high text-primary border-outline-variant/30"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {timeLeft === 0 ? "timer_off" : "timer"}
            </span>
            <span>
              {timeLeft === 0
                ? "Kode Kedaluwarsa"
                : `Sisa Waktu Berlaku: ${formatTimer(timeLeft)}`}
            </span>
          </div>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="bg-primary/15 border border-primary/40 text-primary rounded-xl p-3 text-xs flex items-center gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{success}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-error-container/30 border border-error/40 text-error rounded-xl p-3 text-xs flex items-center gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Developer Offline Hint */}
        {devCode && (
          <div className="bg-secondary/15 border border-secondary/30 rounded-xl p-2.5 text-[11px] text-secondary flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">terminal</span>
              <span>Mode Lokal/Dev OTP: <strong>{devCode}</strong></span>
            </span>
            <button
              type="button"
              onClick={() => setCode(devCode)}
              className="text-[10px] font-bold text-primary hover:underline uppercase"
            >
              Pasang Kode
            </button>
          </div>
        )}

        {/* Verification Form */}
        <form onSubmit={handleVerify} className="flex flex-col gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-outline uppercase mb-1">
              Alamat Email Terdaftar
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full bg-surface-container rounded-lg px-3 py-2.5 text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary text-xs"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-outline uppercase">
                Kode Verifikasi 6 Digit
              </label>
              <span className="text-[10px] text-on-surface-variant font-mono">6 Angka</span>
            </div>
            <input
              type="text"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9a-zA-Z]/g, ""))}
              placeholder="Contoh: 123456"
              className="w-full bg-surface-container rounded-xl px-3 py-3 text-center text-on-surface font-mono text-2xl font-black tracking-[0.5em] border border-outline-variant/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:tracking-normal placeholder:text-sm placeholder:font-normal placeholder:text-outline/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading || timeLeft === 0}
            className="w-full bg-primary-container text-on-primary-container hover:bg-primary py-2.5 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] disabled:opacity-50 mt-1 flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <span>Memverifikasi...</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Verifikasi & Aktivasi Akun</span>
              </>
            )}
          </button>
        </form>

        {/* Resend & Back to Login */}
        <div className="flex flex-col gap-2.5 text-xs text-center border-t border-outline-variant/20 pt-4">
          <div className="flex items-center justify-center gap-1 text-on-surface-variant">
            <span>Tidak menerima kode atau waktu habis?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-primary font-bold hover:underline disabled:opacity-50 ml-1"
            >
              {resending ? "Mengirim..." : "Kirim Ulang Kode"}
            </button>
          </div>

          <Link
            to="/login"
            className="text-outline hover:text-on-surface transition-colors flex items-center justify-center gap-1 text-[11px] mt-1"
          >
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            <span>Kembali ke Halaman Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

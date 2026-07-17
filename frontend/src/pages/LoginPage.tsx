import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, Loader2, ArrowLeft, Mail } from "lucide-react";
import sigapLogo from "../components/photos/SIGAP Logo.png";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import client from "../api/client";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login, user, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "ADMIN") {
        navigate("/admin", { replace: true });
      } else if (user.role === "ME") {
        navigate("/me", { replace: true });
      } else if (user.role === "SUPPORT") {
        navigate("/support", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const loadingId = toast.showLoading("Memproses login...");

    try {
      const response = await client.post("/login", { email, password });
      const { token: newToken } = response.data;
      toast.dismiss(loadingId);
      toast.showSuccess("Login berhasil! Mengalihkan ke dashboard...");
      login(newToken);
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err.response && err.response.data && err.response.data.error) {
        const errMsg = err.response.data.error;
        if (errMsg === "invalid email or password") {
          toast.showError("Email atau password salah. Coba lagi.");
        } else {
          toast.showError(errMsg);
        }
      } else {
        toast.showError("Koneksi gagal. Pastikan server backend Anda berjalan.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center bg-slate-50 px-5 py-10 text-ink">
      {/* Floating Back to Home */}
      <a
        href="/"
        className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-semibold text-muted shadow-sm transition hover:border-brand-100 hover:bg-brand-50 hover:text-brand-600"
      >
        <ArrowLeft size={14} />
        Kembali ke Beranda
      </a>

      {/* Decorative Background Accents */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-brand-200/20 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-300/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <section className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-[0_20px_50px_rgba(16,24,40,0.06)] relative overflow-hidden">
        {/* Subtle top brand line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-brand-600" />

        <img src={sigapLogo} alt="SIGAP Logo" className="mx-auto h-12 w-auto object-contain mt-2" />

        <div className="mt-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
            Staff Internal Portal
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">
            Masuk SIGAP JALAN
          </h1>
          <p className="mt-2 text-xs leading-5 text-muted">
            Akses dashboard monitoring untuk Admin, Support, dan Maintenance Engineering.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-ink">Email</label>
            <div className="mt-2 relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@sigapjalan.id"
                required
                className="h-12 w-full pl-10 pr-4 rounded-xl border border-line bg-white text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink">Password</label>
            <div className="mt-2 relative">
              <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                required
                className="h-12 w-full pl-10 pr-4 rounded-xl border border-line bg-white text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:opacity-75 shadow-sm mt-2"
          >
            {isLoading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <LockKeyhole size={17} />
            )}
            {isLoading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-muted border-t border-line/60 pt-4">
          Pembuatan akun baru hanya dapat dilakukan oleh Administrator.
        </p>
      </section>
    </main>
  );
};

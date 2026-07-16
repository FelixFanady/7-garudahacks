import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login, user, loading } = useAuth();
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
    setError(null);
    setIsLoading(true);

    try {
      const response = await client.post("/login", { email, password });
      const { token: newToken } = response.data;

      login(newToken);

      // Role-based redirect is handled by the useEffect below (user state update triggers it)
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.error) {
        // Translation for common errors
        const errMsg = err.response.data.error;
        if (errMsg === "invalid email or password") {
          setError("Email atau password salah.");
        } else {
          setError(errMsg);
        }
      } else {
        setError("Koneksi gagal. Pastikan server backend Anda berjalan.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-5 py-10 text-ink">
      <section className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-soft">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white">
          <ShieldCheck size={24} strokeWidth={2.4} />
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
            Staff Internal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
            Masuk SIGAP JALAN
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Akses tertutup untuk Admin dan Maintenance Engineering.
          </p>
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-danger ring-1 ring-red-100">
            <AlertCircle size={18} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-ink">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@sigapjalan.id"
              required
              className="mt-2 h-12 w-full rounded-lg border border-line bg-white px-4 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              required
              className="mt-2 h-12 w-full rounded-lg border border-line bg-white px-4 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:opacity-75"
          >
            {isLoading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <LockKeyhole size={17} />
            )}
            {isLoading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-muted">
          Pembuatan akun staf hanya dapat dilakukan oleh Admin.
        </p>
      </section>
    </main>
  );
};

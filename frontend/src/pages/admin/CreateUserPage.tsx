import React, { useState } from "react";
import { UserPlus, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import client from "../../api/client";

export const CreateUserPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("ME");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await client.post("/admin/create-user", {
        email,
        password,
        role,
      });

      setSuccess(`Akun staf dengan email ${email} dan peran ${role} berhasil dibuat.`);
      setEmail("");
      setPassword("");
      setRole("ME");
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.error) {
        const errMsg = err.response.data.error;
        if (errMsg === "email already exists") {
          setError("Email sudah terdaftar.");
        } else if (errMsg.includes("min=6")) {
          setError("Password minimal harus 6 karakter.");
        } else {
          setError(errMsg);
        }
      } else {
        setError("Gagal membuat akun. Pastikan koneksi server backend terhubung.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
          <UserPlus className="text-brand-600" size={24} />
          Buat Akun Staf Baru
        </h1>
        <p className="mt-2 text-sm text-muted">
          Daftarkan email staf baru untuk memberikan hak akses administratif (ADMIN), verifikasi laporan (SUPPORT), atau teknis lapangan (ME).
        </p>
      </div>

      <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
        {success && (
          <div className="mb-6 flex items-start gap-2 rounded-lg bg-emerald-50 p-4 text-sm text-success ring-1 ring-emerald-100">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <p>{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-lg bg-red-50 p-4 text-sm text-danger ring-1 ring-red-100">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink">
              Email Staf
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staf@sigapjalan.id"
              required
              className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink">
              Password (min. 6 karakter)
            </label>
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password staf"
                required
                minLength={6}
                className="h-11 w-full rounded-lg border border-line bg-white px-4 pr-11 text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink">
              Peran / Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
            >
              <option value="ME">ME (Maintenance Engineering)</option>
              <option value="SUPPORT">SUPPORT (Verification Staff)</option>
              <option value="ADMIN">ADMIN (System Administrator)</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:opacity-75"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <UserPlus size={16} />
              )}
              {isLoading ? "Menyimpan..." : "Daftarkan Staf"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

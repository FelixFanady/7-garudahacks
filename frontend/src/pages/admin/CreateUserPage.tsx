import React, { useState } from "react";
import { UserPlus, Loader2, Eye, EyeOff } from "lucide-react";
import client from "../../api/client";
import { useToast } from "../../context/ToastContext";

export const CreateUserPage = () => {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("ME");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const loadingId = toast.showLoading("Membuat akun staf...");
    try {
      await client.post("/admin/create-user", {
        email,
        password,
        role,
      });

      toast.dismiss(loadingId);
      toast.showSuccess(`Akun staf dengan email ${email} dan peran ${role} berhasil dibuat.`);
      setEmail("");
      setPassword("");
      setRole("ME");
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err?.response?.status === 401) return; // handled globally
      if (err.response && err.response.data && err.response.data.error) {
        const errMsg = err.response.data.error;
        if (errMsg === "email already exists") {
          toast.showError("Email sudah terdaftar.");
        } else if (errMsg.includes("min=6")) {
          toast.showError("Password minimal harus 6 karakter.");
        } else {
          toast.showError(errMsg);
        }
      } else {
        toast.showError("Gagal membuat akun. Pastikan koneksi server backend terhubung.");
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

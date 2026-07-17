import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Loader2,
  AlertCircle,
  UserX,
  UserCheck,
  KeyRound,
  Trash2,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import client from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

interface StaffUser {
  id: number;
  email: string;
  role: "ADMIN" | "ME" | "SUPPORT";
  is_banned: boolean;
  created_at: string;
}

export const StaffListPage = () => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Modal State for Change Password
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Modal State for Delete Confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<StaffUser | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const loadingId = toast.showLoading("Memuat daftar staf...");
    try {
      const response = await client.get("/admin/users");
      setUsers(response.data);
      toast.dismiss(loadingId);
    } catch (err: any) {
      toast.dismiss(loadingId);
      // 401 is handled globally by axios interceptor (auto-logout)
      if (err?.response?.status !== 401) {
        toast.showError(
          "Gagal memuat daftar staf. Pastikan koneksi backend aktif.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleBan = async (user: StaffUser) => {
    if (user.email === "admin@sigap.gov" || (currentUser && user.id === currentUser.id)) return;

    const loadingId = toast.showLoading(
      user.is_banned ? "Mengaktifkan akun..." : "Memblokir akun...",
    );
    try {
      await client.put(`/admin/users/${user.id}/ban`, {
        is_banned: !user.is_banned,
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, is_banned: !u.is_banned } : u,
        ),
      );
      toast.dismiss(loadingId);
      toast.showSuccess(
        `Status akun ${user.email} berhasil diubah menjadi ${
          !user.is_banned ? "DINONAKTIFKAN" : "AKTIF"
        }.`,
      );
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err?.response?.status !== 401) {
        toast.showError(
          err.response?.data?.error || "Gagal mengubah status blokir staf.",
        );
      }
    }
  };

  const handleChangePasswordClick = (user: StaffUser) => {
    setSelectedUser(user);
    setNewPassword("");
    setShowNewPassword(false);
    setPasswordError(null);
    setIsPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (newPassword.length < 6) {
      setPasswordError("Password minimal harus 6 karakter.");
      return;
    }

    setSubmittingPassword(true);
    setPasswordError(null);
    const loadingId = toast.showLoading("Memperbarui password...");
    try {
      await client.put(`/admin/users/${selectedUser.id}/change-password`, {
        password: newPassword,
      });

      toast.dismiss(loadingId);
      toast.showSuccess(
        `Password untuk staf ${selectedUser.email} berhasil diperbarui.`,
      );
      setIsPasswordModalOpen(false);
      setSelectedUser(null);
      setNewPassword("");
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err?.response?.status !== 401) {
        const msg = err.response?.data?.error || "Gagal memperbarui password.";
        setPasswordError(msg);
        toast.showError(msg);
      }
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleDeleteClick = (user: StaffUser) => {
    if (user.email === "admin@sigap.gov" || (currentUser && user.id === currentUser.id)) return;
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    setSubmittingDelete(true);
    const loadingId = toast.showLoading("Menghapus akun staf...");
    try {
      await client.delete(`/admin/users/${userToDelete.id}`);
      toast.dismiss(loadingId);
      toast.showSuccess(`Akun staf ${userToDelete.email} berhasil dihapus.`);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err?.response?.status !== 401) {
        toast.showError(
          err.response?.data?.error || "Gagal menghapus akun staf.",
        );
      }
      setIsDeleteModalOpen(false);
    } finally {
      setSubmittingDelete(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.email
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "ALL" ? true : u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-line bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Users className="text-brand-600" size={24} />
            Daftar Akun Staf
          </h1>
          <p className="mt-2 text-sm text-muted">
            Kelola akses staf internal SIGAP JALAN. Anda bisa mengubah password,
            memblokir/mengaktifkan akun, atau menghapus staf dari sistem.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            placeholder="Cari email staf..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full pl-10 pr-4 rounded-lg border border-line bg-white text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-line bg-white text-sm text-ink outline-none transition focus:border-brand-600"
          >
            <option value="ALL">Semua Peran</option>
            <option value="ADMIN">ADMIN</option>
            <option value="ME">ME (Maintenance Eng.)</option>
            <option value="SUPPORT">SUPPORT</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="rounded-xl border border-line bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted">
            <Loader2 size={32} className="animate-spin text-brand-600" />
            <p className="text-sm font-medium">Memuat data staf...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <AlertCircle size={32} className="mx-auto mb-2 text-muted" />
            <p className="text-sm font-medium">Staf tidak ditemukan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Peran</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Tanggal Dibuat</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-muted">
                      {user.id}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-ink">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          user.role === "ADMIN"
                            ? "bg-purple-50 text-purple-700"
                            : user.role === "SUPPORT"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-orange-50 text-amber-700"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          user.is_banned
                            ? "bg-red-50 text-danger"
                            : "bg-emerald-50 text-success"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${user.is_banned ? "bg-danger" : "bg-success"}`}
                        />
                        {user.is_banned ? "Diblokir" : "Aktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {user.email !== "admin@sigap.gov" && currentUser && user.id !== currentUser.id && (
                          <>
                            <button
                              onClick={() => handleToggleBan(user)}
                              title={
                                user.is_banned ? "Aktifkan Akun" : "Blokir Akun"
                              }
                              className={`p-1.5 rounded-lg border transition ${
                                user.is_banned
                                  ? "border-emerald-200 text-success hover:bg-emerald-50"
                                  : "border-red-200 text-danger hover:bg-red-50"
                              }`}
                            >
                              {user.is_banned ? (
                                <UserCheck size={16} />
                              ) : (
                                <UserX size={16} />
                              )}
                            </button>

                            <button
                              onClick={() => handleDeleteClick(user)}
                              title="Hapus Akun"
                              className="p-1.5 rounded-lg border border-red-200 text-danger hover:bg-red-50 transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleChangePasswordClick(user)}
                          title="Ubah Password"
                          className="p-1.5 rounded-lg border border-line text-muted hover:text-brand-600 hover:bg-slate-50 transition"
                        >
                          <KeyRound size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-xl border border-line shadow-soft overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h3 className="font-semibold text-ink flex items-center gap-2">
                <KeyRound className="text-brand-600" size={18} />
                Ubah Password Staf
              </h3>
              <button
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setSelectedUser(null);
                }}
                className="text-muted hover:text-ink transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              <div>
                <p className="text-xs text-muted">Akun Staf:</p>
                <p className="text-sm font-semibold text-ink mt-0.5">
                  {selectedUser.email}
                </p>
              </div>

              {passwordError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-danger">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <p>{passwordError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink">
                  Password Baru (min. 6 karakter)
                </label>
                <div className="relative mt-2">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan password baru"
                    required
                    minLength={6}
                    className="h-10 w-full rounded-lg border border-line bg-white px-3 pr-10 text-sm text-ink outline-none transition focus:border-brand-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setSelectedUser(null);
                  }}
                  className="h-10 px-4 rounded-lg text-sm font-medium text-muted hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingPassword}
                  className="h-10 px-4 rounded-lg bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-70 flex items-center gap-2"
                >
                  {submittingPassword && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Simpan Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-xl border border-line shadow-soft overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h3 className="font-semibold text-danger flex items-center gap-2">
                <Trash2 size={18} />
                Konfirmasi Hapus Akun
              </h3>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                className="text-muted hover:text-ink transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-ink">
                Apakah Anda yakin ingin menghapus akun staf{" "}
                <strong>{userToDelete.email}</strong>? Tindakan ini tidak dapat
                dibatalkan dan staf tersebut akan kehilangan semua hak akses.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setUserToDelete(null);
                  }}
                  className="h-10 px-4 rounded-lg text-sm font-medium text-muted hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={submittingDelete}
                  className="h-10 px-4 rounded-lg bg-danger text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-70 flex items-center gap-2"
                >
                  {submittingDelete && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Hapus Permanen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

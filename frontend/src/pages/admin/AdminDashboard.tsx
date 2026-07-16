import React from "react";
import { Link } from "react-router-dom";
import { UserPlus, Users, HardHat } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export const AdminDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Selamat Datang, Admin!
        </h1>
        <p className="mt-2 text-sm text-muted">
          Di panel ini, Anda dapat mengelola akun staf internal (Maintenance Engineering) dan mengawasi sistem.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <Users size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Staf</p>
              <h3 className="mt-1 text-2xl font-bold text-ink">--</h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <HardHat size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Maintenance Eng.</p>
              <h3 className="mt-1 text-2xl font-bold text-ink">--</h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-brand-900">Registrasi Staf Baru</h4>
            <p className="mt-1 text-xs text-muted">Tambahkan akses untuk tim lapangan atau administrator lainnya.</p>
          </div>
          <Link
            to="/admin/create-user"
            className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            <UserPlus size={14} />
            Buat Akun
          </Link>
        </div>
      </div>
    </div>
  );
};

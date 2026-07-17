import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, Users, HardHat, Loader2, FileBarChart2, Shield } from "lucide-react";
import client from "../../api/client";
import { useToast } from "../../context/ToastContext";

// ── Types ──────────────────────────────────────────────────────────────────────
interface StaffUser {
  id: number;
  email: string;
  role: "ADMIN" | "ME" | "SUPPORT";
  is_banned: boolean;
  created_at: string;
}

interface Report {
  id: number;
  status: "MENUNGGU_VERIFIKASI" | "DIJADWALKAN" | "SELESAI";
  source: "CITIZEN" | "SYSTEM";
}

// ── SVG Pie Chart ──────────────────────────────────────────────────────────────
interface PieSlice {
  label: string;
  value: number;
  color: string;
}

const PieChart: React.FC<{ slices: PieSlice[]; size?: number }> = ({
  slices,
  size = 160,
}) => {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  let cumulativeAngle = -90; // start from top
  const paths: { d: string; color: string; pct: number; label: string }[] = [];

  slices.forEach((slice) => {
    if (slice.value === 0) return;
    const angle = (slice.value / total) * 360;
    const startRad = (cumulativeAngle * Math.PI) / 180;
    const endRad = ((cumulativeAngle + angle) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    const d = `M${cx},${cy} L${x1},${y1} A${r},${r},0,${largeArc},1,${x2},${y2} Z`;
    paths.push({
      d,
      color: slice.color,
      pct: Math.round((slice.value / total) * 100),
      label: slice.label,
    });
    cumulativeAngle += angle;
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="drop-shadow-sm"
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.color}
          stroke="white"
          strokeWidth="2"
          className="transition-all duration-300"
        >
          <title>
            {p.label}: {p.pct}%
          </title>
        </path>
      ))}
      {/* Donut hole */}
      <circle cx={cx} cy={cy} r={r * 0.52} fill="white" />
    </svg>
  );
};

// ── Legend ─────────────────────────────────────────────────────────────────────
const Legend: React.FC<{ slices: PieSlice[]; total: number }> = ({
  slices,
  total,
}) => (
  <div className="flex flex-col gap-2.5 justify-center">
    {slices.map((s) => (
      <div key={s.label} className="flex items-center gap-2.5">
        <span
          className="inline-block h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: s.color }}
        />
        <span className="text-xs text-muted flex-1 leading-tight">
          {s.label}
        </span>
        <span className="text-xs font-bold text-ink">
          {s.value}
          <span className="ml-1 text-muted font-normal">
            ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
          </span>
        </span>
      </div>
    ))}
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
export const AdminDashboard = () => {
  const toast = useToast();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => {
    const userLoadId = toast.showLoading("Memuat data staf...");
    client
      .get("/admin/users")
      .then((res) => {
        setUsers(res.data || []);
        toast.dismiss(userLoadId);
      })
      .catch((err) => {
        toast.dismiss(userLoadId);
        if (err?.response?.status !== 401)
          toast.showError("Gagal memuat data staf.");
      })
      .finally(() => setLoadingUsers(false));

    const reportLoadId = toast.showLoading("Memuat data laporan...");
    client
      .get("/public/reports")
      .then((res) => {
        setReports(res.data || []);
        toast.dismiss(reportLoadId);
      })
      .catch((err) => {
        toast.dismiss(reportLoadId);
        if (err?.response?.status !== 401)
          toast.showError("Gagal memuat data laporan.");
      })
      .finally(() => setLoadingReports(false));
  }, []);

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalStaff = users.length;
  const meCount = users.filter((u) => u.role === "ME").length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const supportCount = users.filter((u) => u.role === "SUPPORT").length;

  const totalReports = reports.length;
  const menungguCount = reports.filter(
    (r) => r.status === "MENUNGGU_VERIFIKASI"
  ).length;
  const dijadwalkanCount = reports.filter(
    (r) => r.status === "DIJADWALKAN"
  ).length;
  const selesaiCount = reports.filter((r) => r.status === "SELESAI").length;

  // ── Pie data ─────────────────────────────────────────────────────────────────
  const reportStatusSlices: PieSlice[] = [
    { label: "Menunggu Verifikasi", value: menungguCount, color: "#F59E0B" },
    { label: "Dijadwalkan / Proses", value: dijadwalkanCount, color: "#1769E0" },
    { label: "Selesai Diperbaiki", value: selesaiCount, color: "#14804A" },
  ];

  const staffRoleSlices: PieSlice[] = [
    { label: "Maintenance Eng. (ME)", value: meCount, color: "#F97316" },
    { label: "Admin", value: adminCount, color: "#7C3AED" },
    { label: "Support", value: supportCount, color: "#0EA5E9" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Welcome Banner ── */}
      <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Selamat Datang, Admin!
        </h1>
        <p className="mt-2 text-sm text-muted">
          Di panel ini, Anda dapat mengelola akun staf internal (Maintenance
          Engineering) dan mengawasi sistem.
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Staff */}
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <Users size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Total Staf
              </p>
              <h3 className="mt-1 text-2xl font-bold text-ink">
                {loadingUsers ? (
                  <Loader2 size={20} className="animate-spin text-brand-600" />
                ) : (
                  totalStaff
                )}
              </h3>
            </div>
          </div>
        </div>

        {/* Maintenance Eng */}
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50 text-orange-500">
              <HardHat size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Maintenance Eng.
              </p>
              <h3 className="mt-1 text-2xl font-bold text-ink">
                {loadingUsers ? (
                  <Loader2 size={20} className="animate-spin text-brand-600" />
                ) : (
                  meCount
                )}
              </h3>
            </div>
          </div>
        </div>

        {/* CTA Card */}
        <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-brand-900">
              Registrasi Staf Baru
            </h4>
            <p className="mt-1 text-xs text-muted">
              Tambahkan akses untuk tim lapangan atau administrator lainnya.
            </p>
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

      {/* ── Charts Row ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Report Status Pie */}
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <FileBarChart2 size={18} className="text-brand-600" />
            <h2 className="text-sm font-bold text-ink">
              Distribusi Status Laporan
            </h2>
          </div>

          {loadingReports ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={28} className="animate-spin text-brand-600" />
            </div>
          ) : totalReports === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted">
              Belum ada data laporan.
            </div>
          ) : (
            <div className="flex items-center gap-8">
              <div className="relative shrink-0">
                <PieChart slices={reportStatusSlices} size={160} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-ink leading-none">
                    {totalReports}
                  </span>
                  <span className="text-[10px] text-muted font-medium mt-0.5">
                    laporan
                  </span>
                </div>
              </div>
              <Legend slices={reportStatusSlices} total={totalReports} />
            </div>
          )}
        </div>

        {/* Staff Role Pie */}
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Shield size={18} className="text-purple-600" />
            <h2 className="text-sm font-bold text-ink">
              Distribusi Peran Staf
            </h2>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={28} className="animate-spin text-brand-600" />
            </div>
          ) : totalStaff === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted">
              Belum ada data staf.
            </div>
          ) : (
            <div className="flex items-center gap-8">
              <div className="relative shrink-0">
                <PieChart slices={staffRoleSlices} size={160} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-ink leading-none">
                    {totalStaff}
                  </span>
                  <span className="text-[10px] text-muted font-medium mt-0.5">
                    staf
                  </span>
                </div>
              </div>
              <Legend slices={staffRoleSlices} total={totalStaff} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, CheckCircle2, Clock, ShieldAlert, ChevronRight, Loader2, RefreshCw, BarChart2 } from "lucide-react";
import client from "../../api/client";

interface Report {
  id: number;
  uid: string;
  location: string;
  description: string;
  reporter_name: string;
  reporter_email: string;
  source: "CITIZEN" | "SYSTEM";
  status: "MENUNGGU_VERIFIKASI" | "DIJADWALKAN" | "SELESAI";
  is_false_report: boolean;
  scheduled_date: string | null;
  created_at: string;
}

export const SupportDashboard = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.get("/support/reports");
      setReports(response.data);
    } catch (err: any) {
      setError("Gagal memuat laporan. Pastikan koneksi server aktif.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const totalCount = reports.length;
  const pendingCount = reports.filter(r => r.status === "MENUNGGU_VERIFIKASI" && !r.is_false_report).length;
  const scheduledCount = reports.filter(r => r.status === "DIJADWALKAN" && !r.is_false_report).length;
  const resolvedCount = reports.filter(r => r.status === "SELESAI").length;
  const falseReportCount = reports.filter(r => r.is_false_report).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-line bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <ShieldCheck className="text-brand-600" size={24} />
            Dashboard Support
          </h1>
          <p className="mt-2 text-sm text-muted">
            Tinjau laporan warga maupun sistem kecerdasan buatan (dashcam AI), verifikasi data kerusakan jalan, dan jadwalkan ke Maintenance Engineering (ME).
          </p>
        </div>
        <button
          onClick={fetchReports}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-muted hover:text-ink transition shrink-0"
          title="Refresh Data"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-4 text-sm text-danger ring-1 ring-red-100">
          <ShieldAlert size={18} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-50 text-muted">
              <BarChart2 size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Laporan</p>
              <h3 className="mt-1 text-2xl font-bold text-ink">{totalCount}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-50 text-warning">
              <Clock size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Menunggu Verifikasi</p>
              <h3 className="mt-1 text-2xl font-bold text-ink">{pendingCount}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <ShieldAlert size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Dijadwalkan (ME)</p>
              <h3 className="mt-1 text-2xl font-bold text-ink">{scheduledCount}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-success">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Selesai Diperbaiki</p>
              <h3 className="mt-1 text-2xl font-bold text-ink">{resolvedCount}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-500">
              <ShieldAlert size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">False Report</p>
              <h3 className="mt-1 text-2xl font-bold text-ink">{falseReportCount}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Reports Table/List */}
      <div className="rounded-xl border border-line bg-white shadow-sm overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h3 className="font-semibold text-ink">Semua Laporan Jalan Berlubang</h3>
          <p className="text-xs text-muted mt-1">Daftar lengkap laporan jalan yang masuk dari publik (warga) dan deteksi dashcam AI sistem.</p>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted">
            <Loader2 size={32} className="animate-spin text-brand-600" />
            <p className="text-sm font-medium">Memuat data laporan...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <CheckCircle2 size={36} className="mx-auto text-success mb-3" />
            <p className="text-sm font-medium">Belum ada laporan jalan berlubang.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {reports.map((report) => (
              <Link
                key={report.id}
                to={`/support/reports/${report.uid}`}
                className="flex items-center justify-between p-6 hover:bg-slate-50 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                      ID-{report.uid}
                    </span>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                      report.source === "SYSTEM"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-blue-100 text-brand-700"
                    }`}>
                      {report.source === "SYSTEM" ? "DASHCAM AI" : "WARGA"}
                    </span>
                    <span className="text-sm font-semibold text-ink">{report.location}</span>
                  </div>
                  <p className="text-xs text-muted max-w-2xl truncate">{report.description}</p>
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-muted">
                    {report.source === "CITIZEN" ? (
                      <span>Pelapor: <strong className="text-ink">{report.reporter_name}</strong></span>
                    ) : (
                      <span>Pelapor: <strong className="text-purple-700">Sistem Kecerdasan Buatan</strong></span>
                    )}
                    <span>•</span>
                    <span>Diterima: <strong className="text-ink">{new Date(report.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {(() => {
                    if (report.is_false_report) {
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                          <ShieldAlert size={11} />
                          False Report
                        </span>
                      );
                    }

                    const isCompleted = report.status === "SELESAI";
                    let isOverdue = false;
                    if (report.status !== "SELESAI" && report.scheduled_date) {
                      const sched = new Date(report.scheduled_date);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      sched.setHours(0, 0, 0, 0);
                      isOverdue = sched.getTime() < today.getTime();
                    }

                    let badgeClass = "bg-slate-50 text-slate-500 border border-slate-200";
                    let statusLabel = report.status === "MENUNGGU_VERIFIKASI" ? "Menunggu Verifikasi" : "Dijadwalkan";

                    if (isCompleted) {
                      badgeClass = "bg-emerald-50 text-success border border-emerald-200";
                      statusLabel = "Selesai";
                    } else if (isOverdue) {
                      badgeClass = "bg-red-50 text-danger border border-red-200 animate-pulse";
                      statusLabel = "Terlambat (Deadline)";
                    }

                    return (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
                        {statusLabel}
                      </span>
                    );
                  })()}
                  <ChevronRight size={18} className="text-muted" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

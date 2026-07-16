import React from "react";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";

interface Report {
  id: number;
  uid: string;
  location: string;
  description: string;
  source: "CITIZEN" | "SYSTEM";
  status: "MENUNGGU_VERIFIKASI" | "DIJADWALKAN" | "SELESAI";
  photo: string;
  scheduled_date: string | null;
  created_at: string;
}

export const PublicReportCard = ({ report }: { report: Report }) => {
  const isCompleted = report.status === "SELESAI";
  let isOverdue = false;
  if (report.status !== "SELESAI" && report.scheduled_date) {
    const sched = new Date(report.scheduled_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    sched.setHours(0, 0, 0, 0);
    isOverdue = sched.getTime() < today.getTime();
  }

  let badgeClass = "bg-slate-50 text-slate-500 ring-slate-200"; // neutral
  let statusLabel = report.status === "MENUNGGU_VERIFIKASI" ? "Menunggu" : "Dijadwalkan";

  if (isCompleted) {
    badgeClass = "bg-emerald-50 text-success ring-emerald-200";
    statusLabel = "Selesai";
  } else if (isOverdue) {
    badgeClass = "bg-red-50 text-danger ring-red-200 animate-pulse";
    statusLabel = "Terlambat";
  }

  return (
    <Link 
      to={`/laporan/transparansi/${report.uid}`}
      className="group block overflow-hidden rounded-xl border border-line bg-white shadow-[0_10px_30px_rgba(16,24,40,0.04)] transition hover:shadow-soft flex flex-col h-full hover:border-brand-300"
    >
      {/* Photo header */}
      <div className="relative h-48 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
        {report.photo ? (
          <img
            src={`data:image/jpeg;base64,${report.photo}`}
            alt="Bukti Laporan"
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <span className="text-xs text-muted">Tidak ada foto bukti</span>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink shadow-sm">
          Foto bukti laporan
        </span>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded w-fit inline-block">
              {report.uid}
            </span>
            <h3 className="mt-2 text-base font-semibold leading-snug text-ink truncate group-hover:text-brand-600 transition" title={report.location}>
              {report.location}
            </h3>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${badgeClass}`}>
            {statusLabel}
          </span>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted line-clamp-3 flex-1">{report.description}</p>

        <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3 text-xs text-muted shrink-0">
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={14} />
            Dibuat: {new Date(report.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          {report.scheduled_date && (
            <span className="inline-flex items-center gap-2 font-medium text-brand-600">
              <CalendarDays size={14} />
              Jadwal: {new Date(report.scheduled_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

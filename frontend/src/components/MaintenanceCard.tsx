import { CalendarDays, MapPin } from "lucide-react";
import type { MaintenanceReport, MaintenanceStatus } from "../data/maintenanceReports";

const statusStyles: Record<MaintenanceStatus, string> = {
  Menunggu: "bg-amber-50 text-warning ring-amber-200",
  Diperbaiki: "bg-blue-50 text-brand-700 ring-blue-200",
  Selesai: "bg-emerald-50 text-success ring-emerald-200"
};

export const MaintenanceCard = ({ report }: { report: MaintenanceReport }) => {
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_10px_30px_rgba(16,24,40,0.04)]">
      <div className={`relative h-44 bg-gradient-to-br ${report.imageTone}`}>
        <div className="absolute inset-x-5 bottom-5 h-16 rounded-lg bg-white/45 backdrop-blur-sm" />
        <div className="absolute bottom-8 left-8 h-2 w-28 rounded-full bg-white/80" />
        <div className="absolute bottom-12 right-8 h-10 w-20 rounded-md bg-slate-700/10" />
        <span className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink shadow-sm">
          Foto bukti lapangan
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{report.id}</p>
            <h3 className="mt-2 text-lg font-semibold leading-snug text-ink">{report.location}</h3>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusStyles[report.status]}`}>
            {report.status}
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted">{report.description}</p>

        <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={16} />
            {report.date}
          </span>
          <span className="inline-flex items-center gap-2">
            <MapPin size={16} />
            {report.officer}
          </span>
        </div>
      </div>
    </article>
  );
};

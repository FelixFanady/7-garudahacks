import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  HardHat,
  Clock,
  CheckCircle2,
  ChevronRight,
  Loader2,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import client from "../../api/client";
import { useToast } from "../../context/ToastContext";

interface Report {
  id: number;
  uid: string;
  location: string;
  description: string;
  source: "CITIZEN" | "SYSTEM";
  status: "MENUNGGU_VERIFIKASI" | "DIJADWALKAN" | "SELESAI";
  scheduled_date: string | null;
  created_at: string;
}

export const MeDashboard = () => {
  const toast = useToast();
  const [tasks, setTasks] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar States
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterMode, setFilterMode] = useState<
    "MONTH_UNFINISHED" | "SELECTED_DATE"
  >("MONTH_UNFINISHED");

  const fetchTasks = async () => {
    setLoading(true);
    const loadingId = toast.showLoading("Memuat daftar tugas...");
    try {
      const response = await client.get("/me/reports");
      setTasks(response.data);
      toast.dismiss(loadingId);
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err?.response?.status !== 401) {
        toast.showError("Gagal memuat tugas. Pastikan koneksi server aktif.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const totalCount = tasks.length;
  const activeCount = tasks.filter((t) => t.status === "DIJADWALKAN").length;
  const completedCount = tasks.filter((t) => t.status === "SELESAI").length;

  // Helper: check if two date objects fall on the same day
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Calendar Math
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const currentMonthDays = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month days fill
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false,
    });
  }

  // Current month days fill
  for (let i = 1; i <= currentMonthDays; i++) {
    cells.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  // Next month days fill (fill up to 42 slots to cover 6 weeks)
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
    setFilterMode("MONTH_UNFINISHED");
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
    setFilterMode("MONTH_UNFINISHED");
  };

  const hasTasksOnDay = (date: Date) => {
    return tasks.some((task) => {
      if (!task.scheduled_date) return false;
      const taskDate = new Date(task.scheduled_date);
      return isSameDay(taskDate, date) && task.status === "DIJADWALKAN";
    });
  };

  // Filter tasks based on current filter mode
  const filteredTasks = tasks.filter((task) => {
    if (!task.scheduled_date) return false;
    const taskDate = new Date(task.scheduled_date);
    if (filterMode === "MONTH_UNFINISHED") {
      return (
        taskDate.getFullYear() === currentMonth.getFullYear() &&
        taskDate.getMonth() === currentMonth.getMonth() &&
        task.status !== "SELESAI"
      );
    } else {
      return isSameDay(taskDate, selectedDate);
    }
  });

  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
          <HardHat className="text-brand-600" size={24} />
          Dashboard Maintenance Engineering (ME)
        </h1>
        <p className="mt-2 text-sm text-muted">
          Pilih tanggal pada kalender untuk melihat daftar tugas perbaikan jalan
          berlubang yang ditugaskan kepada Anda. Klik pada tugas untuk
          memperbarui status dan melampirkan foto bukti.
        </p>
      </div>


      {/* Stats Grid */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <HardHat size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Total Tugas
              </p>
              <h3 className="mt-1 text-2xl font-bold text-ink">{totalCount}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-brand-600">
              <Clock size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Tugas Aktif
              </p>
              <h3 className="mt-1 text-2xl font-bold text-ink">
                {activeCount}
              </h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-success">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Tugas Selesai
              </p>
              <h3 className="mt-1 text-2xl font-bold text-ink">
                {completedCount}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar and Tasks */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Column 1: Calendar Widget */}
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm h-fit">
          <div className="flex items-center justify-between pb-4">
            <h3 className="font-bold text-ink text-sm">
              {monthNames[month]} {year}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-line hover:bg-slate-50 text-muted hover:text-ink transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-line hover:bg-slate-50 text-muted hover:text-ink transition"
              >
                <ChevronRightIcon size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-bold text-ink border-b border-line pb-2 mb-2">
            <div>S</div>
            <div>M</div>
            <div>T</div>
            <div>W</div>
            <div>T</div>
            <div>F</div>
            <div>S</div>
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-y-3 text-center text-sm font-medium">
            {cells.map((cell, index) => {
              const isSelected = isSameDay(cell.date, selectedDate);
              const isToday = isSameDay(cell.date, new Date());
              const hasTask = hasTasksOnDay(cell.date);

              return (
                <div
                  key={index}
                  onClick={() => {
                    setSelectedDate(cell.date);
                    setFilterMode("SELECTED_DATE");
                  }}
                  className="flex flex-col items-center justify-center cursor-pointer group"
                >
                  <div
                    className={`h-8 w-8 flex items-center justify-center rounded-full transition-all relative ${
                      isSelected
                        ? "bg-brand-600 text-white font-semibold"
                        : isToday
                          ? "border border-brand-600 text-brand-600 font-semibold"
                          : cell.isCurrentMonth
                            ? "text-ink hover:bg-slate-100"
                            : "text-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {cell.date.getDate()}
                  </div>
                  {/* Task Indicator Dot */}
                  <div className="h-1.5 w-full flex justify-center mt-0.5">
                    {hasTask && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-red-700" : "bg-red-500"}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 2-3: Tasks List for Selected Date */}
        <div className="lg:col-span-2 rounded-xl border border-line bg-white shadow-sm overflow-hidden h-fit">
          <div className="border-b border-line px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-ink">
                {filterMode === "MONTH_UNFINISHED"
                  ? `Tugas Belum Selesai: ${monthNames[month]} ${year}`
                  : `Tugas Perbaikan: ${selectedDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`}
              </h3>
              <p className="text-xs text-muted mt-1">
                {filterMode === "MONTH_UNFINISHED"
                  ? "Menampilkan semua agenda perbaikan yang belum selesai di bulan ini."
                  : "Menampilkan agenda perbaikan jalan berlubang yang dijadwalkan pada hari ini."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {filterMode === "SELECTED_DATE" && (
                <button
                  onClick={() => setFilterMode("MONTH_UNFINISHED")}
                  className="text-xs text-brand-600 hover:text-brand-700 font-semibold underline mr-2"
                >
                  Lihat Semua Bulan Ini
                </button>
              )}
              <span className="text-xs bg-slate-100 text-muted px-2.5 py-1 rounded-full font-semibold">
                {filteredTasks.length} Tugas
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted">
              <Loader2 size={32} className="animate-spin text-brand-600" />
              <p className="text-sm font-medium">Memuat tugas...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-16 text-center text-muted">
              <CheckCircle2 size={36} className="mx-auto text-success mb-3" />
              <p className="text-sm font-medium">
                {filterMode === "MONTH_UNFINISHED"
                  ? "Semua tugas di bulan ini telah selesai dikerjakan!"
                  : "Tidak ada tugas perbaikan untuk tanggal ini."}
              </p>
              <p className="text-xs text-muted mt-1">
                {filterMode === "MONTH_UNFINISHED"
                  ? "Gunakan kalender untuk melihat target jadwal atau filter tanggal lainnya."
                  : "Gunakan kalender di sebelah kiri untuk melihat tanggal pengerjaan lainnya."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {filteredTasks.map((task) => (
                <Link
                  key={task.id}
                  to={`/me/reports/${task.uid}`}
                  className="flex items-center justify-between p-6 hover:bg-slate-50 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                        ID-{task.uid}
                      </span>
                      <span className="text-sm font-semibold text-ink">
                        {task.location}
                      </span>
                    </div>
                    <p className="text-xs text-muted max-w-xl truncate">
                      {task.description}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-muted">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                          task.source === "SYSTEM"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-brand-700"
                        }`}
                      >
                        {task.source === "SYSTEM"
                          ? "SISTEM (DASHCAM)"
                          : "WARGA"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {(() => {
                      const isCompleted = task.status === "SELESAI";
                      let isOverdue = false;
                      if (task.status !== "SELESAI" && task.scheduled_date) {
                        const sched = new Date(task.scheduled_date);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        sched.setHours(0, 0, 0, 0);
                        isOverdue = sched.getTime() < today.getTime();
                      }

                      let badgeClass =
                        "bg-slate-50 text-slate-500 border border-slate-200"; // neutral no color
                      let statusLabel = "Dalam Proses";

                      if (isCompleted) {
                        badgeClass =
                          "bg-emerald-50 text-success border border-emerald-200";
                        statusLabel = "Selesai";
                      } else if (isOverdue) {
                        badgeClass =
                          "bg-red-50 text-danger border border-red-200 animate-pulse";
                        statusLabel = "Terlambat (Deadline)";
                      }

                      return (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
                        >
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
    </div>
  );
};

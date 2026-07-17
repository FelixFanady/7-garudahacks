import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, CheckCircle2, Clock, ShieldAlert, ChevronRight, Loader2, RefreshCw, BarChart2, Filter, X, Circle, Search, SlidersHorizontal, Calendar, ChevronLeft } from "lucide-react";
import client from "../../api/client";
import { useToast } from "../../context/ToastContext";

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
  const toast = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async (isRefresh = false) => {
    setLoading(true);
    const loadingId = toast.showLoading(isRefresh ? "Memperbarui data laporan..." : "Memuat data laporan...");
    try {
      const response = await client.get("/support/reports");
      setReports(response.data);
      toast.dismiss(loadingId);
      if (isRefresh) toast.showSuccess("Data laporan berhasil diperbarui.");
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err?.response?.status !== 401) {
        toast.showError("Gagal memuat laporan. Pastikan koneksi server aktif.");
      }
    } finally {
      setLoading(false);
    }
  };

  const [filterId, setFilterId] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterReporter, setFilterReporter] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const formatDateToLocalStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

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

  // Next month days fill
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    const clickedStr = formatDateToLocalStr(date);
    if (!filterStartDate || (filterStartDate && filterEndDate)) {
      setFilterStartDate(clickedStr);
      setFilterEndDate("");
    } else {
      if (clickedStr < filterStartDate) {
        setFilterStartDate(clickedStr);
      } else {
        setFilterEndDate(clickedStr);
      }
    }
  };

  const isAnyFilterActive =
    filterId !== "" ||
    filterLocation !== "" ||
    filterReporter !== "" ||
    filterStatus !== "ALL" ||
    filterStartDate !== "" ||
    filterEndDate !== "";

  const handleResetFilters = () => {
    setFilterId("");
    setFilterLocation("");
    setFilterReporter("");
    setFilterStatus("ALL");
    setFilterStartDate("");
    setFilterEndDate("");
  };

  const filteredReports = reports.filter((report) => {
    if (filterId.trim()) {
      const searchId = filterId.trim().toLowerCase().replace(/^id-/, "");
      const matchesUid = report.uid.toLowerCase().includes(searchId);
      const matchesId = report.id.toString().includes(searchId);
      if (!matchesUid && !matchesId) return false;
    }

    if (filterLocation.trim()) {
      const searchLoc = filterLocation.trim().toLowerCase();
      if (!report.location.toLowerCase().includes(searchLoc)) return false;
    }

    if (filterReporter.trim()) {
      const searchReporter = filterReporter.trim().toLowerCase();
      const reporterName =
        report.source === "SYSTEM"
          ? "sistem kecerdasan buatan"
          : report.reporter_name.toLowerCase();
      if (!reporterName.includes(searchReporter)) return false;
    }

    if (filterStatus !== "ALL") {
      if (filterStatus === "FALSE_REPORT") {
        if (!report.is_false_report) return false;
      } else {
        if (report.is_false_report) return false;
        if (report.status !== filterStatus) return false;
      }
    }

    if (filterStartDate) {
      const reportDate = new Date(report.created_at);
      const startDate = new Date(filterStartDate);
      startDate.setHours(0, 0, 0, 0);
      if (reportDate < startDate) return false;
    }

    if (filterEndDate) {
      const reportDate = new Date(report.created_at);
      const endDate = new Date(filterEndDate);
      endDate.setHours(23, 59, 59, 999);
      if (reportDate > endDate) return false;
    }

    return true;
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const totalCount = reports.length;
  const pendingCount = reports.filter(r => r.status === "MENUNGGU_VERIFIKASI" && !r.is_false_report).length;
  const scheduledCount = reports.filter(r => r.status === "DIJADWALKAN" && !r.is_false_report).length;
  const resolvedCount = reports.filter(r => r.status === "SELESAI").length;
  const falseReportCount = reports.filter(r => r.is_false_report).length;

  const getStatusCount = (val: string) => {
    switch (val) {
      case "ALL": return totalCount;
      case "MENUNGGU_VERIFIKASI": return pendingCount;
      case "DIJADWALKAN": return scheduledCount;
      case "SELESAI": return resolvedCount;
      case "FALSE_REPORT": return falseReportCount;
      default: return 0;
    }
  };

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
          onClick={() => fetchReports(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-muted hover:text-ink transition shrink-0"
          title="Refresh Data"
        >
          <RefreshCw size={18} />
        </button>
      </div>


      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-muted">
              <BarChart2 size={16} />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted leading-tight">Total Laporan</p>
              <h3 className="mt-0.5 text-xl font-bold text-ink">{totalCount}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-warning">
              <Clock size={16} />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted leading-tight">Menunggu</p>
              <h3 className="mt-0.5 text-xl font-bold text-ink">{pendingCount}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <ShieldCheck size={16} />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted leading-tight">Dijadwalkan</p>
              <h3 className="mt-0.5 text-xl font-bold text-ink">{scheduledCount}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-success">
              <CheckCircle2 size={16} />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted leading-tight">Selesai</p>
              <h3 className="mt-0.5 text-xl font-bold text-ink">{resolvedCount}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-50 text-red-500">
              <ShieldAlert size={16} />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted leading-tight">False Report</p>
              <h3 className="mt-0.5 text-xl font-bold text-ink">{falseReportCount}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Sidebar Filters */}
        <div className="w-full lg:w-80 shrink-0 space-y-6">
          <div className="rounded-xl border border-line bg-white p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-semibold text-ink flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-brand-600" />
                Status & Waktu
              </h3>
              {isAnyFilterActive && (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 transition"
                  title="Reset Semua Filter"
                >
                  <X size={14} />
                  Reset
                </button>
              )}
            </div>

            {/* Status Tabs */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Status Laporan</p>
              <div className="space-y-1.5">
                {(
                  [
                    { val: "ALL", label: "Semua Laporan", icon: Circle },
                    { val: "MENUNGGU_VERIFIKASI", label: "Menunggu Verifikasi", icon: Clock },
                    { val: "DIJADWALKAN", label: "Dijadwalkan", icon: ShieldCheck },
                    { val: "SELESAI", label: "Selesai", icon: CheckCircle2 },
                    { val: "FALSE_REPORT", label: "False Report", icon: ShieldAlert },
                  ] as { val: string; label: string; icon: any }[]
                ).map(({ val, label, icon: Icon }) => (
                  <button
                    key={val}
                    onClick={() => setFilterStatus(val)}
                    className={`flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs font-semibold transition border ${
                      filterStatus === val
                        ? val === "FALSE_REPORT"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : val === "SELESAI"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : val === "DIJADWALKAN"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : val === "MENUNGGU_VERIFIKASI"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-brand-50 text-brand-700 border-brand-200"
                        : "border-line text-muted hover:bg-slate-50 hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={14} />
                      <span>{label}</span>
                    </div>
                    <span className={`text-[10px] rounded-full px-2 py-0.5 ${
                      filterStatus === val
                        ? val === "FALSE_REPORT"
                          ? "bg-red-100 text-red-800"
                          : val === "SELESAI"
                          ? "bg-emerald-100 text-emerald-800"
                          : val === "DIJADWALKAN"
                          ? "bg-blue-100 text-blue-800"
                          : val === "MENUNGGU_VERIFIKASI"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-brand-100 text-brand-800"
                        : "bg-slate-100 text-muted"
                    }`}>
                      {getStatusCount(val)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Filters */}
            <div className="space-y-4 pt-3 border-t border-line">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Calendar size={14} className="text-brand-600" />
                Rentang Tanggal
              </p>

              <div className="rounded-lg border border-line bg-slate-50/50 p-3.5 space-y-3">
                {/* Month Navigation */}
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="font-bold text-ink text-xs uppercase tracking-wider">
                    {monthNames[month]} {year}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 rounded-md border border-line bg-white hover:bg-slate-50 text-muted hover:text-ink transition"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 rounded-md border border-line bg-white hover:bg-slate-50 text-muted hover:text-ink transition"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Weekdays */}
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-muted">
                  <div>M</div>
                  <div>S</div>
                  <div>S</div>
                  <div>R</div>
                  <div>K</div>
                  <div>J</div>
                  <div>S</div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-y-1 text-center text-xs font-semibold">
                  {cells.map((cell, index) => {
                    const cellStr = formatDateToLocalStr(cell.date);
                    const isStart = cellStr === filterStartDate;
                    const isEnd = cellStr === filterEndDate;
                    const isToday = cellStr === formatDateToLocalStr(new Date());
                    const isWithin = filterStartDate && filterEndDate && cellStr > filterStartDate && cellStr < filterEndDate;

                    let containerClass = "w-full h-7 flex items-center justify-center cursor-pointer relative";
                    let textClass = "h-7 w-7 flex items-center justify-center transition-all rounded-full";

                    if (isStart && filterEndDate) {
                      containerClass += " bg-brand-50/70 rounded-l-full";
                      textClass = "h-7 w-7 flex items-center justify-center bg-brand-600 text-white font-bold rounded-full shadow-sm";
                    } else if (isStart) {
                      textClass = "h-7 w-7 flex items-center justify-center bg-brand-600 text-white font-bold rounded-full shadow-sm";
                    } else if (isEnd) {
                      containerClass += " bg-brand-50/70 rounded-r-full";
                      textClass = "h-7 w-7 flex items-center justify-center bg-brand-600 text-white font-bold rounded-full shadow-sm";
                    } else if (isWithin) {
                      containerClass += " bg-brand-50 text-brand-700";
                      textClass = "h-7 w-7 flex items-center justify-center text-brand-700 font-semibold rounded-none";
                    } else if (isToday) {
                      textClass = "h-7 w-7 flex items-center justify-center border border-brand-600 text-brand-600 font-bold rounded-full";
                    } else if (cell.isCurrentMonth) {
                      textClass = "h-7 w-7 flex items-center justify-center text-ink hover:bg-slate-100 rounded-full";
                    } else {
                      textClass = "h-7 w-7 flex items-center justify-center text-slate-300 hover:bg-slate-50 rounded-full";
                    }

                    return (
                      <div
                        key={index}
                        onClick={() => handleDateClick(cell.date)}
                        className={containerClass}
                      >
                        <div className={textClass}>
                          {cell.date.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Range Info & Reset */}
              <div className="space-y-2">
                {filterStartDate && (
                  <div className="rounded-lg bg-brand-50/40 border border-brand-100 px-3 py-2 text-xs flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold text-brand-600 tracking-wider">Rentang Terpilih</span>
                    <span className="font-semibold text-ink">
                      {formatDisplayDate(filterStartDate)}
                      {filterEndDate ? ` - ${formatDisplayDate(filterEndDate)}` : " (Pilih tanggal akhir)"}
                    </span>
                  </div>
                )}
                {(filterStartDate || filterEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStartDate("");
                      setFilterEndDate("");
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 transition"
                  >
                    <X size={14} />
                    Hapus Rentang Tanggal
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Search Inputs & Reports List */}
        <div className="flex-1 w-full space-y-6">
          {/* Top: Box Filter */}
          <div className="rounded-xl border border-line bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-ink flex items-center gap-2 pb-2 border-b border-line">
              <Search size={18} className="text-brand-600" />
              Pencarian Laporan
            </h3>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {/* Filter ID */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  ID Laporan
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={filterId}
                    onChange={(e) => setFilterId(e.target.value)}
                    placeholder="Cari ID (misal: ID-xxx)"
                    className="h-10 w-full rounded-lg border border-line bg-white pl-3 pr-8 text-xs text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                  />
                  {filterId && (
                    <button
                      onClick={() => setFilterId("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Jalan */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Jalan / Lokasi
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    placeholder="Cari nama jalan..."
                    className="h-10 w-full rounded-lg border border-line bg-white pl-3 pr-8 text-xs text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                  />
                  {filterLocation && (
                    <button
                      onClick={() => setFilterLocation("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Reporter */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Nama Pelapor
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={filterReporter}
                    onChange={(e) => setFilterReporter(e.target.value)}
                    placeholder="Cari nama pelapor / sistem..."
                    className="h-10 w-full rounded-lg border border-line bg-white pl-3 pr-8 text-xs text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                  />
                  {filterReporter && (
                    <button
                      onClick={() => setFilterReporter("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: Data List */}
          <div className="rounded-xl border border-line bg-white shadow-sm overflow-hidden">
            <div className="border-b border-line px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="font-semibold text-ink">Semua Laporan Jalan Berlubang</h3>
                <p className="text-xs text-muted mt-1">Daftar lengkap laporan jalan yang masuk dari publik (warga) dan deteksi dashcam AI sistem.</p>
              </div>
              {isAnyFilterActive && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-muted shrink-0 self-start sm:self-center">
                  Menampilkan {filteredReports.length} dari {reports.length}
                </span>
              )}
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
            ) : filteredReports.length === 0 ? (
              <div className="p-12 text-center text-muted">
                <Filter size={36} className="mx-auto text-muted mb-3 animate-pulse" />
                <p className="text-sm font-medium">Tidak ada laporan yang cocok dengan filter.</p>
                <button
                  onClick={handleResetFilters}
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 px-4 text-xs font-semibold text-ink transition"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {filteredReports.map((report) => (
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
      </div>
    </div>
  );
};

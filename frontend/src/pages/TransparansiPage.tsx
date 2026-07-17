import React, { useState, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle2, Search, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { PublicReportCard } from "../components/PublicReportCard";
import client from "../api/client";
import { useSearchParams } from "react-router-dom";

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

export const TransparansiPage = () => {
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filter states
  const [searchId, setSearchId] = useState(searchParams.get("search") || "");
  const [filterDate, setFilterDate] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchId, filterDate]);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.get("/public/reports");
      setReports(response.data || []);
    } catch (err: any) {
      setError("Gagal memuat daftar laporan transparansi. Pastikan koneksi server aktif.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const totalCount = reports.length;
  const pendingCount = reports.filter(r => r.status === "MENUNGGU_VERIFIKASI").length;
  const scheduledCount = reports.filter(r => r.status === "DIJADWALKAN").length;
  const resolvedCount = reports.filter(r => r.status === "SELESAI").length;

  // Filter reports list based on criteria
  const filteredReports = reports.filter(r => {
    const matchesId = r.uid.toLowerCase().includes(searchId.trim().toLowerCase());
    
    let matchesDate = true;
    if (filterDate) {
      const createdStr = new Date(r.created_at).toISOString().split("T")[0];
      const scheduledStr = r.scheduled_date ? new Date(r.scheduled_date).toISOString().split("T")[0] : "";
      matchesDate = (createdStr === filterDate) || (scheduledStr === filterDate);
    }

    return matchesId && matchesDate;
  });

  const totalItems = filteredReports.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentReports = filteredReports.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      <SiteHeader />

      <main className="flex-1 mx-auto max-w-7xl w-full px-5 sm:px-8 py-12">
        {/* Title Block */}
        <div className="rounded-2xl border border-line bg-white p-8 shadow-sm mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
            Transparansi Publik
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Progres Perbaikan Jalan
          </h1>
          <p className="mt-2 text-sm text-muted max-w-2xl leading-relaxed">
            Daftar lengkap laporan kerusakan jalan berlubang yang dilaporkan oleh masyarakat atau terdeteksi oleh sistem kecerdasan buatan, lengkap dengan status perbaikan dan bukti fotonya.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-lg bg-red-50 p-4 text-sm text-danger ring-1 ring-red-100">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid gap-5 grid-cols-2 sm:grid-cols-4 mb-8">
          <div className="rounded-xl border border-line bg-white p-5 shadow-sm text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Laporan</p>
            <h3 className="mt-1 text-2xl font-bold text-ink">{totalCount}</h3>
          </div>
          <div className="rounded-xl border border-line bg-white p-5 shadow-sm text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Menunggu Verifikasi</p>
            <h3 className="mt-1 text-2xl font-bold text-ink">{pendingCount}</h3>
          </div>
          <div className="rounded-xl border border-line bg-white p-5 shadow-sm text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Dalam Proses ME</p>
            <h3 className="mt-1 text-2xl font-bold text-ink">{scheduledCount}</h3>
          </div>
          <div className="rounded-xl border border-line bg-white p-5 shadow-sm text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Selesai Diperbaiki</p>
            <h3 className="mt-1 text-2xl font-bold text-emerald-600">{resolvedCount}</h3>
          </div>
        </div>

        {/* Search and Filters Section */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm mb-8 flex flex-col md:flex-row gap-5 items-stretch">
          <div className="flex-1 relative">
            <label className="block text-xs font-bold text-ink mb-2 uppercase tracking-wide">Cari ID Laporan (e.g. ABC123)</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Ketik ID unik laporan..."
                className="h-11 w-full pl-10 pr-4 rounded-lg border border-line bg-white text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="w-full md:w-80">
            <label className="block text-xs font-bold text-ink mb-2 uppercase tracking-wide">Tanggal (Dibuat / Jadwal)</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="h-11 w-full pl-10 pr-4 rounded-lg border border-line bg-white text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              />
            </div>
          </div>

          {(searchId || filterDate) && (
            <div className="flex items-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSearchId("");
                  setFilterDate("");
                }}
                className="h-11 w-full md:w-auto px-5 rounded-lg border border-line hover:bg-slate-50 transition text-sm font-semibold text-muted"
              >
                Reset Filter
              </button>
            </div>
          )}
        </div>

        {/* Reports Listing Grid */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-muted">
            <Loader2 size={36} className="animate-spin text-brand-600" />
            <p className="text-sm font-medium">Memuat data laporan...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-16 text-center text-muted bg-white border border-line rounded-2xl shadow-sm">
            <CheckCircle2 size={40} className="mx-auto text-success mb-3" />
            <p className="text-sm font-medium">Tidak ada laporan perbaikan yang cocok dengan kriteria filter.</p>
          </div>
        ) : (
          <div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {currentReports.map((report) => (
                <PublicReportCard key={report.id} report={report} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-10 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-line pt-6">
                <p className="text-xs text-muted">
                  Menampilkan <span className="font-semibold text-ink">{indexOfFirstItem + 1}</span>-{indexOfLastItem > totalItems ? totalItems : indexOfLastItem} dari <span className="font-semibold text-ink">{totalItems}</span> laporan
                </p>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold transition ${
                        currentPage === page
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-line bg-white hover:bg-slate-50 text-muted hover:text-ink"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  MapPinned,
  Loader2,
  Camera,
  HardHat,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PublicReportCard } from "../components/PublicReportCard";
import { MapRoutingPreview } from "../components/MapRoutingPreview";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import client from "../api/client";

export const HomePage = () => {
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

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(
        `/laporan/transparansi?search=${encodeURIComponent(searchQuery.trim())}`,
      );
    }
  };

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await client.get("/public/reports");
        setReports(response.data || []);
      } catch (err) {
        console.error("Failed to fetch reports for home page:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  return (
    <main className="min-h-screen bg-white text-ink">
      <SiteHeader />

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-14 pt-16 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pb-20 lg:pt-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
            <CheckCircle2 size={16} />
            Transparansi perbaikan jalan berbasis AI
          </p>
          <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-tight text-ink sm:text-6xl lg:text-7xl">
            SIGAP JALAN
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Sistem Antisipasi Jalan Berlubang yang membantu masyarakat memilih
            rute lebih aman, melihat laporan kerusakan, dan memantau progres
            perbaikan secara terbuka.
          </p>

          {/* Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-8 max-w-md relative"
          >
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                size={18}
              />
              <input
                type="text"
                placeholder="Cari ID laporan (e.g. ID-Lapor)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 w-full pl-11 pr-24 rounded-full border border-line bg-white text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-5 rounded-full bg-brand-600 text-xs font-semibold text-white hover:bg-brand-700 transition"
              >
                Cari
              </button>
            </div>
          </form>

          {/* Quick Actions Menu (Inspired by Banyuwangi-style circular icons grid) */}
          <div className="mt-10 pt-6 border-t border-line/80">
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
              Akses Layanan
            </p>
            <div className="flex flex-wrap gap-6 sm:gap-8">
              <a
                href="/lapor"
                className="flex flex-col items-center gap-2 group text-center w-20"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 shadow-sm border border-brand-100/50 transition duration-300 group-hover:scale-105 group-hover:shadow-md group-hover:bg-brand-600 group-hover:text-white">
                  <Camera size={20} />
                </span>
                <span className="text-[11px] font-semibold text-ink group-hover:text-brand-600 transition">
                  Laporkan
                </span>
              </a>
              <a
                href="/laporan/transparansi"
                className="flex flex-col items-center gap-2 group text-center w-20"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-warning shadow-sm border border-amber-100/50 transition duration-300 group-hover:scale-105 group-hover:shadow-md group-hover:bg-brand-600 group-hover:text-white">
                  <BarChart3 size={20} />
                </span>
                <span className="text-[11px] font-semibold text-ink group-hover:text-warning transition">
                  Transparansi
                </span>
              </a>
              <a
                href="#rute"
                className="flex flex-col items-center gap-2 group text-center w-20"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-success shadow-sm border border-emerald-100/50 transition duration-300 group-hover:scale-105 group-hover:shadow-md group-hover:bg-brand-600 group-hover:text-white">
                  <MapPinned size={20} />
                </span>
                <span className="text-[11px] font-semibold text-ink group-hover:text-success transition">
                  Rute Aman
                </span>
              </a>
              <a
                href="/login"
                className="flex flex-col items-center gap-2 group text-center w-20"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-muted shadow-sm border border-line transition duration-300 group-hover:scale-105 group-hover:shadow-md group-hover:bg-brand-600 group-hover:text-white">
                  <HardHat size={20} />
                </span>
                <span className="text-[11px] font-semibold text-ink group-hover:text-muted transition">
                  Portal Staf
                </span>
              </a>
            </div>
          </div>
        </div>

        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
          <div className="absolute inset-0 [background-image:linear-gradient(90deg,rgba(102,112,133,0.13)_1px,transparent_1px),linear-gradient(rgba(102,112,133,0.13)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="absolute left-8 top-8 rounded-xl bg-white p-4 shadow-soft">
            <MapPinned className="text-brand-600" size={28} />
            <p className="mt-3 text-sm font-semibold text-ink">
              Deteksi titik risiko
            </p>
            <p className="mt-1 text-xs text-muted">
              Koordinat, status, dan prioritas.
            </p>
          </div>
          <div className="absolute bottom-8 right-8 w-64 rounded-xl bg-white p-5 shadow-soft">
            <BarChart3 className="text-success" size={26} />
            <p className="mt-3 text-3xl font-semibold text-ink">87%</p>
            <p className="mt-1 text-sm text-muted">
              laporan prioritas telah diverifikasi ME.
            </p>
          </div>
          <div className="absolute left-[24%] top-[48%] h-3 w-[56%] -rotate-12 rounded-full bg-brand-600/25" />
          <div className="absolute left-[18%] top-[64%] h-3 w-[48%] rotate-6 rounded-full bg-emerald-500/25" />
          <span className="absolute left-[54%] top-[37%] h-5 w-5 rounded-full bg-danger ring-8 ring-orange-100" />
          <span className="absolute left-[30%] top-[66%] h-5 w-5 rounded-full bg-brand-600 ring-8 ring-blue-100" />
        </div>
      </section>

      <MapRoutingPreview />

      <section id="transparansi" className="bg-surface py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-9 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
                Transparansi Perbaikan Jalan
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Progres laporan perbaikan yang bisa dipantau publik.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted">
              Pantau progres perbaikan jalan di wilayah Anda.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {loading ? (
              <div className="col-span-3 py-12 flex flex-col items-center justify-center gap-2 text-muted">
                <Loader2 className="animate-spin text-brand-600" size={28} />
                <p className="text-sm">Memuat progres perbaikan...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="col-span-3 text-center py-8 text-muted">
                Belum ada laporan perbaikan jalan yang aktif.
              </div>
            ) : (
              reports
                .slice(0, 3)
                .map((report) => (
                  <PublicReportCard key={report.id} report={report} />
                ))
            )}
          </div>

          <div className="mt-10 flex justify-center">
            <a
              href="/laporan/transparansi"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-6 text-sm font-semibold text-ink hover:border-brand-100 hover:bg-brand-50 transition"
            >
              Lihat Lebih Banyak Laporan
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
};

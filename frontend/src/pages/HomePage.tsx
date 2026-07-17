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
  Shield,
  Zap,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PublicReportCard } from "../components/PublicReportCard";
import { MapRoutingPreview } from "../components/MapRoutingPreview";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import client from "../api/client";
import mapImage from "../photos/map_1.png";

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

  const totalReports = reports.length;
  const selesai = reports.filter((r) => r.status === "SELESAI").length;
  const dijadwalkan = reports.filter((r) => r.status === "DIJADWALKAN").length;

  return (
    <main className="min-h-screen bg-white text-ink">
      <SiteHeader />

      {/* ── Hero Section ── */}
      <section
        id="hero"
        className="relative overflow-hidden border-b border-line/60"
      >
        {/* Subtle grid decoration */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 70% 50%, rgba(23,105,224,0.06) 0%, transparent 55%), " +
              "radial-gradient(circle at 10% 80%, rgba(20,128,74,0.04) 0%, transparent 40%)",
          }}
        />

        <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[1fr_1fr] lg:items-center lg:pb-24 lg:pt-24">
          {/* Left: copy */}
          <div className="relative z-10">
            {/* Heading */}
            <h1 className="mt-6 text-[2.85rem] font-bold tracking-tight text-ink sm:text-6xl lg:text-[4rem] leading-[1.12]">
              SIGAP
              <span className="block text-brand-600">JALAN</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-8 text-muted">
              Sistem Antisipasi Jalan Berlubang yang membantu masyarakat memilih
              rute lebih aman, melihat laporan kerusakan, dan memantau progres
              perbaikan secara terbuka.
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearchSubmit} className="mt-8 max-w-[26rem]">
              <div className="relative flex items-center">
                <Search
                  className="absolute left-4 text-muted pointer-events-none"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Cari ID laporan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 w-full pl-10 pr-28 rounded-xl border border-line bg-white text-sm text-ink outline-none shadow-sm transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 h-9 px-5 rounded-lg bg-brand-600 text-xs font-semibold text-white transition hover:bg-brand-700 active:scale-95"
                >
                  Cari
                </button>
              </div>
            </form>

            {/* Quick Actions */}
            <div className="mt-10">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted/70 mb-4">
                Akses Layanan
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  {
                    href: "/lapor",
                    icon: Camera,
                    label: "Laporkan",
                    color: "text-brand-600",
                    bg: "bg-brand-50 hover:bg-brand-600",
                    border: "border-brand-100",
                  },
                  {
                    href: "/laporan/transparansi",
                    icon: BarChart3,
                    label: "Transparansi",
                    color: "text-amber-600",
                    bg: "bg-amber-50 hover:bg-brand-600",
                    border: "border-amber-100",
                  },
                  {
                    href: "/maps",
                    icon: MapPinned,
                    label: "Maps",
                    color: "text-emerald-600",
                    bg: "bg-emerald-50 hover:bg-brand-600",
                    border: "border-emerald-100",
                  },
                  {
                    href: "/login",
                    icon: HardHat,
                    label: "Login",
                    color: "text-slate-500",
                    bg: "bg-slate-50 hover:bg-brand-600",
                    border: "border-slate-200",
                  },
                ].map(({ href, icon: Icon, label, color, bg, border }) => (
                  <a
                    key={href}
                    href={href}
                    className={`group flex items-center gap-2.5 rounded-xl border ${border} ${bg} px-4 py-2.5 transition-all duration-200 hover:border-brand-600 hover:text-white hover:shadow-md active:scale-95`}
                  >
                    <Icon
                      size={16}
                      className={`${color} group-hover:text-white transition`}
                    />
                    <span
                      className={`text-xs font-semibold ${color} group-hover:text-white transition`}
                    >
                      {label}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right: map image */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_24px_60px_rgba(16,24,40,0.1)]">
              <img
                src={mapImage}
                alt="Deteksi Titik Risiko Map"
                className="w-full h-full object-cover"
              />
              {/* Overlay badge */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur border border-line/50">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-ink">
                  Peta Aktif – Data Real-time
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid grid-cols-2 divide-x divide-line md:grid-cols-4">
            {[
              {
                icon: Shield,
                value: totalReports,
                label: "Total Laporan",
                color: "text-brand-600",
              },
              {
                icon: CheckCircle2,
                value: selesai,
                label: "Berhasil Diperbaiki",
                color: "text-emerald-600",
              },
              {
                icon: Zap,
                value: dijadwalkan,
                label: "Sedang Dijadwalkan",
                color: "text-amber-600",
              },
              {
                icon: Users,
                value: "100%",
                label: "Transparan & Publik",
                color: "text-brand-600",
              },
            ].map(({ icon: Icon, value, label, color }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center gap-1 py-6 px-4 text-center"
              >
                <Icon size={18} className={`${color} mb-1`} />
                <span className={`text-2xl font-bold ${color}`}>
                  {loading && typeof value === "number" ? "–" : value}
                </span>
                <span className="text-[11px] text-muted font-medium">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Map Routing Section ── */}
      <MapRoutingPreview />

      {/* ── Transparansi Section ── */}
      <section id="transparansi" className="bg-surface py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          {/* Header */}
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
                Transparansi Perbaikan Jalan
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Progres laporan yang bisa{" "}
                <span className="text-brand-600">dipantau publik.</span>
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                Setiap laporan kerusakan jalan dicatat dan terbuka untuk umum.
                Pantau progres perbaikan jalan di wilayah Anda.
              </p>
            </div>
            <a
              href="/laporan/transparansi"
              className="inline-flex shrink-0 h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-5 text-sm font-semibold text-ink shadow-sm hover:border-brand-200 hover:bg-brand-50 transition"
            >
              Lihat Semua
              <ArrowRight size={15} />
            </a>
          </div>

          {/* Cards */}
          <div className="grid gap-5 md:grid-cols-3">
            {loading ? (
              <div className="col-span-3 py-16 flex flex-col items-center justify-center gap-3 text-muted">
                <Loader2 className="animate-spin text-brand-600" size={28} />
                <p className="text-sm">Memuat data laporan...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="col-span-3 rounded-xl border border-dashed border-line bg-white py-16 text-center text-sm text-muted">
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

          {/* CTA bottom */}
          {!loading && reports.length > 3 && (
            <div className="mt-10 flex justify-center">
              <a
                href="/laporan/transparansi"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-7 text-sm font-semibold text-ink shadow-sm hover:border-brand-200 hover:bg-brand-50 transition"
              >
                Lihat Lebih Banyak Laporan
                <ArrowRight size={16} />
              </a>
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
};

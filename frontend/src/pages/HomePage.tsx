import React, { useState, useEffect } from "react";
import { ArrowRight, BarChart3, CheckCircle2, MapPinned, Loader2 } from "lucide-react";
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
            Sistem Antisipasi Jalan Berlubang yang membantu masyarakat memilih rute
            lebih aman, melihat laporan kerusakan, dan memantau progres perbaikan
            secara terbuka.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/lapor"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Laporkan Jalan Rusak
              <ArrowRight size={17} />
            </a>
            <a
              href="#rute"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:border-brand-100 hover:bg-brand-50"
            >
              Cek Rute Aman
            </a>
            <a
              href="#transparansi"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:border-brand-100 hover:bg-brand-50"
            >
              Progres Perbaikan
            </a>
          </div>
        </div>

        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
          <div className="absolute inset-0 [background-image:linear-gradient(90deg,rgba(102,112,133,0.13)_1px,transparent_1px),linear-gradient(rgba(102,112,133,0.13)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="absolute left-8 top-8 rounded-xl bg-white p-4 shadow-soft">
            <MapPinned className="text-brand-600" size={28} />
            <p className="mt-3 text-sm font-semibold text-ink">Deteksi titik risiko</p>
            <p className="mt-1 text-xs text-muted">Koordinat, status, dan prioritas.</p>
          </div>
          <div className="absolute bottom-8 right-8 w-64 rounded-xl bg-white p-5 shadow-soft">
            <BarChart3 className="text-success" size={26} />
            <p className="mt-3 text-3xl font-semibold text-ink">87%</p>
            <p className="mt-1 text-sm text-muted">laporan prioritas telah diverifikasi ME.</p>
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
                Transparansi ME
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Progres laporan perbaikan yang bisa dipantau publik.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted">
              Data dummy berikut menggambarkan alur laporan dari validasi lapangan,
              pengerjaan, hingga bukti selesai.
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
              reports.slice(0, 3).map((report) => (
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

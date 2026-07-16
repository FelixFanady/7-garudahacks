import { MapPin, Navigation, Route } from "lucide-react";

export const MapRoutingPreview = () => {
  return (
    <section id="rute" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
          Routing Dijkstra
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Peta rute aman untuk menghindari titik jalan berlubang.
        </h2>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-soft">
        <div className="flex flex-col gap-4 border-b border-line px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
              <Route size={20} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Simulasi rute publik</p>
              <p className="text-sm text-muted">Placeholder Gmaps-style untuk integrasi peta.</p>
            </div>
          </div>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700">
            <Navigation size={17} />
            Hitung Rute
          </button>
        </div>

        <div className="relative min-h-[430px] bg-surface">
          <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(90deg,#dfe6ef_1px,transparent_1px),linear-gradient(#dfe6ef_1px,transparent_1px)] [background-size:64px_64px]" />
          <div className="absolute left-[8%] top-[20%] h-3 w-[72%] -rotate-6 rounded-full bg-brand-600/20" />
          <div className="absolute left-[18%] top-[56%] h-3 w-[60%] rotate-12 rounded-full bg-emerald-500/20" />
          <div className="absolute left-[31%] top-[18%] h-[62%] w-3 rotate-12 rounded-full bg-slate-400/20" />
          <div className="absolute left-[12%] top-[31%] flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-ink shadow-soft">
            <MapPin size={16} className="text-brand-600" />
            Titik awal
          </div>
          <div className="absolute right-[14%] top-[61%] flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-ink shadow-soft">
            <MapPin size={16} className="text-success" />
            Tujuan
          </div>
          <div className="absolute left-[48%] top-[43%] rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-danger shadow-soft">
            Lubang terdeteksi
          </div>
          <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-3 rounded-xl border border-line bg-white/92 p-4 shadow-soft backdrop-blur md:left-auto md:w-80">
            <p className="text-sm font-semibold text-ink">Rute rekomendasi AI</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="font-semibold text-ink">8.4 km</p>
                <p className="text-xs text-muted">Jarak</p>
              </div>
              <div>
                <p className="font-semibold text-ink">18 mnt</p>
                <p className="text-xs text-muted">Estimasi</p>
              </div>
              <div>
                <p className="font-semibold text-ink">4 titik</p>
                <p className="text-xs text-muted">Dihindari</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

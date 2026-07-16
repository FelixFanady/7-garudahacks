import { ShieldCheck } from "lucide-react";

export const SiteHeader = () => {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="SIGAP JALAN home">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
            <ShieldCheck size={20} strokeWidth={2.3} />
          </span>
          <span className="text-sm font-semibold tracking-[0.18em] text-ink">SIGAP JALAN</span>
        </a>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          <a className="transition hover:text-ink" href="/lapor">
            Laporkan Jalan
          </a>
          <a className="transition hover:text-ink" href="/#rute">
            Rute Aman
          </a>
          <a className="transition hover:text-ink" href="/laporan/transparansi">
            Transparansi
          </a>
          <a className="transition hover:text-ink" href="/login">
            Staff
          </a>
        </nav>
      </div>
    </header>
  );
};

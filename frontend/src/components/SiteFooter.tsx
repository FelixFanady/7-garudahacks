import React from "react";
import sigapLogo from "../photos/siap_logo.png";

export const SiteFooter = () => {
  return (
    <footer className="border-t border-line bg-slate-50 text-ink py-12 px-5 sm:px-8 mt-auto">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-line">
          {/* Brand Info */}
          <div className="flex items-center gap-3">
            <img
              src={sigapLogo}
              alt="SIGAP Logo"
              className="h-8 w-auto object-contain shrink-0"
            />
            <div>
              <span className="text-sm font-bold tracking-[0.15em] text-ink uppercase">
                SIGAP JALAN
              </span>
              <p className="text-xs text-muted mt-0.5">
                Sistem Antisipasi Jalan Berlubang & Progres Perbaikan AI
              </p>
            </div>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-muted">
            <a className="hover:text-ink transition" href="/#hero">
              Beranda
            </a>
            <a className="hover:text-ink transition" href="/lapor">
              Laporkan Jalan
            </a>
            <a className="hover:text-ink transition" href="/#rute">
              Rute Aman
            </a>
            <a
              className="hover:text-ink transition"
              href="/laporan/transparansi"
            >
              Transparansi Laporan
            </a>
            <a className="hover:text-ink transition" href="/login">
              Portal Staf
            </a>
          </nav>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 text-[11px] text-muted">
          <p>
            © 2026 SIGAP JALAN. Dikembangkan untuk keselamatan berkendara
            bersama.
          </p>
          <div className="flex gap-4">
            <span className="cursor-default hover:text-ink transition">
              Kebijakan Privasi
            </span>
            <span>•</span>
            <span className="cursor-default hover:text-ink transition">
              Syarat & Ketentuan
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

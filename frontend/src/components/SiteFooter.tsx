import React from "react";
import sigapLogo from "../photos/siap_logo.png";

export const SiteFooter = () => {
  return (
    <footer className="border-t border-line bg-white text-ink">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-3">
              <img
                src={sigapLogo}
                alt="SIGAP Logo"
                className="h-8 w-auto object-contain shrink-0"
              />
              <span className="text-sm font-bold tracking-[0.15em] text-ink uppercase">
                SIGAP JALAN
              </span>
            </div>
            <p className="text-xs leading-6 text-muted">
              Sistem Antisipasi Jalan Berlubang berbasis AI untuk transparansi
              dan keselamatan berkendara bersama.
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 sm:grid-cols-3">
            {[
              { href: "/", label: "Beranda" },
              { href: "/lapor", label: "Laporkan Jalan" },
              { href: "/maps", label: "Maps" },
              { href: "/laporan/transparansi", label: "Transparansi" },
              { href: "/login", label: "Login" },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-xs font-medium text-muted hover:text-ink transition"
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom strip */}
        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted">
            © 2026 SIGAP JALAN. Because We Care About Roads. All rights
            reserved.
          </p>
          <div className="flex gap-5 text-[11px] text-muted">
            <span className="cursor-default hover:text-ink transition">
              Kebijakan Privasi
            </span>
            <span>•</span>
            <span className="cursor-default hover:text-ink transition">
              Syarat &amp; Ketentuan
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

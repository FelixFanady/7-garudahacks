import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import sigapLogo from "../photos/siap_logo.png";

export const SiteHeader = () => {
  const { user } = useAuth();

  const getHomePath = () => {
    if (!user) return "/";
    if (user.role === "ADMIN") return "/admin";
    if (user.role === "ME") return "/me";
    if (user.role === "SUPPORT") return "/support";
    return "/";
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to={getHomePath()} className="flex items-center gap-3" aria-label="SIGAP JALAN home">
          <img src={sigapLogo} alt="SIGAP Logo" className="h-9 w-auto object-contain" />
          <span className="text-sm font-semibold tracking-[0.18em] text-ink">SIGAP JALAN</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          <a className="transition hover:text-ink" href="/lapor">
            Laporkan Jalan
          </a>
          <a className="transition hover:text-ink" href="/maps">
            Rute Aman
          </a>
          <a className="transition hover:text-ink" href="/laporan/transparansi">
            Transparansi
          </a>
          <a className="transition hover:text-ink" href="/login">
            Login
          </a>
        </nav>
      </div>
    </header>
  );
};

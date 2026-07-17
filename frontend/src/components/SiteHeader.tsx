import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Menu, X } from "lucide-react";
import sigapLogo from "../photos/siap_logo.png";

export const SiteHeader = () => {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getHomePath = () => {
    if (!user) return "/";
    if (user.role === "ADMIN") return "/admin";
    if (user.role === "ME") return "/me";
    if (user.role === "SUPPORT") return "/support";
    return "/";
  };

  const navLinks = [
    { href: "/lapor", label: "Laporkan Jalan" },
    { href: "/maps", label: "Maps" },
    { href: "/laporan/transparansi", label: "Transparansi" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        {/* Brand */}
        <Link
          to={getHomePath()}
          className="flex items-center gap-2.5 group"
          aria-label="SIGAP JALAN home"
        >
          <img
            src={sigapLogo}
            alt="SIGAP Logo"
            className="h-9 w-auto object-contain"
          />
          <span className="text-sm font-bold tracking-[0.18em] text-ink group-hover:text-brand-600 transition">
            SIGAP JALAN
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted transition hover:bg-slate-50 hover:text-ink"
            >
              {label}
            </a>
          ))}
          <a
            href="/login"
            className="ml-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
          >
            Login
          </a>
        </nav>

        {/* Mobile menu button */}
        <button
          className="flex md:hidden items-center justify-center h-9 w-9 rounded-lg border border-line text-muted hover:bg-slate-50 transition"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-line bg-white px-5 py-4 flex flex-col gap-1">
          {navLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-slate-50 hover:text-ink transition"
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </a>
          ))}
          <a
            href="/login"
            className="mt-2 rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold text-ink hover:bg-brand-50 hover:text-brand-700 transition text-center"
            onClick={() => setMobileOpen(false)}
          >
            Login
          </a>
        </div>
      )}
    </header>
  );
};

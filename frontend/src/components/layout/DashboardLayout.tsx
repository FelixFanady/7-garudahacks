import React from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { 
  ShieldCheck, 
  LayoutDashboard, 
  UserPlus, 
  CheckSquare, 
  LogOut, 
  User 
} from "lucide-react";

export const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const adminMenu = [
    {
      label: "Dashboard Admin",
      path: "/admin",
      icon: LayoutDashboard,
    },
    {
      label: "Daftar Staf",
      path: "/admin/staff",
      icon: User,
    },
    {
      label: "Buat Akun Staf",
      path: "/admin/create-user",
      icon: UserPlus,
    },
  ];

  const supportMenu = [
    {
      label: "Dashboard Support",
      path: "/support",
      icon: LayoutDashboard,
    },
    {
      label: "Verifikasi Laporan",
      path: "/support", // Point to /support for now
      icon: CheckSquare,
    },
  ];

  const meMenu = [
    {
      label: "Dashboard ME",
      path: "/me",
      icon: LayoutDashboard,
    },
    {
      label: "Tugas Perbaikan",
      path: "/me",
      icon: CheckSquare,
    },
  ];

  let activeMenu = meMenu;
  if (user.role === "ADMIN") {
    activeMenu = adminMenu;
  } else if (user.role === "SUPPORT") {
    activeMenu = supportMenu;
  }

  return (
    <div className="flex h-screen w-full bg-surface text-ink font-sans">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-line bg-white">
        {/* Sidebar Header */}
        <div className="flex h-16 items-center gap-3 border-b border-line px-6">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <ShieldCheck size={18} strokeWidth={2.3} />
          </span>
          <span className="text-sm font-bold tracking-[0.15em] text-ink uppercase">SIGAP JALAN</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 px-4 py-6">
          {activeMenu.map((item, index) => {
            const Icon = item.icon;
            // Since Tugas Perbaikan and Dashboard ME might have the same path (/me), 
            // we can distinguish them by label or let them highlight normally
            const isActive = location.pathname === item.path && (item.label !== "Tugas Perbaikan" || location.pathname.includes("/tasks"));
            
            return (
              <Link
                key={item.label + index}
                to={item.path}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-brand-50 text-brand-600"
                    : "text-muted hover:bg-slate-50 hover:text-ink"
                }`}
              >
                <Icon size={18} className={isActive ? "text-brand-600" : "text-muted"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3 rounded-lg px-2 py-3 bg-slate-50">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-brand-700">
              <User size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{user.email}</p>
              <p className="text-[10px] font-medium text-brand-600 uppercase tracking-wider">{user.role}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-danger hover:bg-red-50 transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-line bg-white px-8">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {user.role === "ADMIN" 
                ? "Panel Admin" 
                : user.role === "SUPPORT" 
                ? "Panel Support" 
                : "Panel Maintenance Engineering"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Sistem Aktif
            </span>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

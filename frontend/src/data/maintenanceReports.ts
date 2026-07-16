export type MaintenanceStatus = "Menunggu" | "Diperbaiki" | "Selesai";

export type MaintenanceReport = {
  id: string;
  location: string;
  status: MaintenanceStatus;
  date: string;
  officer: string;
  description: string;
  imageTone: string;
};

export const maintenanceReports: MaintenanceReport[] = [
  {
    id: "SJ-2407-018",
    location: "Jl. Sudirman KM 3, Jakarta Pusat",
    status: "Diperbaiki",
    date: "16 Jul 2026",
    officer: "ME Area Pusat",
    description: "Tambalan struktural sedang dikerjakan pada jalur lambat arah utara.",
    imageTone: "from-sky-100 via-slate-100 to-emerald-100"
  },
  {
    id: "SJ-2407-011",
    location: "Jl. Raya Serpong, Tangerang Selatan",
    status: "Menunggu",
    date: "15 Jul 2026",
    officer: "ME Area Banten",
    description: "Validasi lapangan selesai, menunggu jadwal material dan pengalihan arus.",
    imageTone: "from-amber-100 via-orange-50 to-slate-100"
  },
  {
    id: "SJ-2407-006",
    location: "Jl. Ahmad Yani, Bekasi",
    status: "Selesai",
    date: "14 Jul 2026",
    officer: "ME Area Timur",
    description: "Perbaikan selesai, foto bukti dan koordinat akhir telah diverifikasi.",
    imageTone: "from-emerald-100 via-teal-50 to-slate-100"
  }
];

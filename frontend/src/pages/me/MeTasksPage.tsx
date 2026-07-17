import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  HardHat,
  Clock,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
  MapPin,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  Calendar,
  Circle,
  CheckSquare,
  RotateCcw,
  MessageSquare,
  Camera,
  Send,
  Image,
  AlertCircle,
  Check,
  Pencil,
  ArrowLeft,
  User,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import client from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { ImageModal } from "../../components/ImageModal";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Report {
  id: number;
  uid: string;
  location: string;
  description: string;
  reporter_name: string;
  reporter_email: string;
  photo: string;
  source: "CITIZEN" | "SYSTEM";
  status: "MENUNGGU_VERIFIKASI" | "DIJADWALKAN" | "SELESAI";
  scheduled_date: string | null;
  assigned_me: { id: number; email: string }[] | null;
  is_false_report: boolean;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: number;
  message: string;
  photo: string | null;
  is_final_proof: boolean;
  created_at: string;
  sender: { email: string; role: "ADMIN" | "ME" | "SUPPORT" };
}

type StatusFilter = "ALL" | "DIJADWALKAN" | "SELESAI" | "OVERDUE";
type SourceFilter = "ALL" | "CITIZEN" | "SYSTEM";
type SortField = "scheduled_date" | "created_at" | "status";
type SortDir = "asc" | "desc";

// ─── Helpers ────────────────────────────────────────────────────────────────────
const monthNames = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
];

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const isTaskOverdue = (task: Report) => {
  if (task.status === "SELESAI" || !task.scheduled_date) return false;
  const sched = new Date(task.scheduled_date);
  const today = new Date();
  sched.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return sched.getTime() < today.getTime();
};

const getStatusLabel = (task: Report): { label: string; cls: string } => {
  if (task.status === "SELESAI")
    return { label: "Selesai", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
  if (isTaskOverdue(task))
    return { label: "Terlambat", cls: "bg-red-50 text-red-700 border border-red-200 animate-pulse" };
  return { label: "Dijadwalkan", cls: "bg-blue-50 text-blue-700 border border-blue-200" };
};

// ─── TaskCard ───────────────────────────────────────────────────────────────────
const TaskCard = ({
  task,
  isSelected,
  onClick,
}: {
  task: Report;
  isSelected: boolean;
  onClick: () => void;
}) => {
  const { label, cls } = getStatusLabel(task);
  const overdue = isTaskOverdue(task);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-line transition-all duration-150 group relative ${
        isSelected
          ? "bg-brand-50 border-l-2 border-l-brand-600"
          : overdue
          ? "hover:bg-red-50/50 border-l-2 border-l-transparent hover:border-l-red-400"
          : "hover:bg-slate-50 border-l-2 border-l-transparent hover:border-l-brand-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">
              #{task.uid}
            </span>
            <span
              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                task.source === "SYSTEM"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-sky-100 text-sky-700"
              }`}
            >
              {task.source === "SYSTEM" ? "DASHCAM" : "WARGA"}
            </span>
          </div>
          <p className="text-xs font-semibold text-ink truncate leading-snug">{task.location}</p>
          <p className="text-[11px] text-muted truncate mt-0.5">{task.description}</p>
          {task.scheduled_date && (
            <div className="flex items-center gap-1 mt-1.5">
              <Calendar size={10} className="text-muted shrink-0" />
              <span className="text-[10px] text-muted">
                {new Date(task.scheduled_date).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
        <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
          {label}
        </span>
      </div>
    </button>
  );
};

// ─── Detail Panel ───────────────────────────────────────────────────────────────
const DetailPanel = ({
  task,
  onClose,
  onRefresh,
}: {
  task: Report;
  onClose: () => void;
  onRefresh: () => void;
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const [report, setReport] = useState<Report>(task);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activePhoto, setActivePhoto] = useState<{ src: string; alt: string } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [chatMessage, setChatMessage] = useState("");
  const [chatPhoto, setChatPhoto] = useState<File | null>(null);
  const [chatPhotoPreview, setChatPhotoPreview] = useState<string | null>(null);
  const [sendingChat, setSendingChat] = useState(false);
  const [isProof, setIsProof] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    commentId: number;
    isFinalProof: boolean;
  } | null>(null);
  const [mapCoords, setMapCoords] = useState<[number, number] | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevCommentsLengthRef = useRef(0);

  const parseCoordinates = (loc: string): [number, number] | null => {
    const regex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
    const match = loc.match(regex);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }
    return null;
  };

  const fetchDetail = useCallback(
    async (silent = false) => {
      try {
        const res = await client.get(`/reports/${task.uid}`);
        setReport(res.data.report);
        setComments(res.data.comments);
      } catch (err) {
        // silent
      } finally {
        if (!silent) setLoadingDetail(false);
      }
    },
    [task.uid]
  );

  useEffect(() => {
    setLoadingDetail(true);
    setReport(task);
    setMapCoords(null);
    setChatMessage("");
    setChatPhoto(null);
    setChatPhotoPreview(null);
    fetchDetail();
    const interval = setInterval(() => fetchDetail(true), 8000);
    return () => clearInterval(interval);
  }, [task.uid]);

  useEffect(() => {
    if (!report.location) return;
    const coords = parseCoordinates(report.location);
    if (coords) {
      setMapCoords(coords);
    } else {
      const geocode = async () => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(report.location)}&limit=1`
          );
          const data = await res.json();
          if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            if (!isNaN(lat) && !isNaN(lon)) setMapCoords([lat, lon]);
          }
        } catch {}
      };
      geocode();
    }
  }, [report.location]);

  useEffect(() => {
    if (!mapCoords) return;
    const L = (window as any).L;
    if (!L) return;
    const [lat, lng] = mapCoords;
    const mapId = `detail-map-${task.uid}`;
    const timeout = setTimeout(() => {
      const container = document.getElementById(mapId);
      if (!container) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([lat, lng], 16);
        return;
      }
      const map = L.map(container, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      L.marker([lat, lng]).addTo(map);
      mapInstanceRef.current = map;
    }, 150);
    return () => {
      clearTimeout(timeout);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapCoords, task.uid]);

  useEffect(() => {
    if (comments.length > prevCommentsLengthRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCommentsLengthRef.current = comments.length;
  }, [comments]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const handleChatPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setChatPhoto(file);
      setChatPhotoPreview(URL.createObjectURL(file));
    }
  };
  const handleRemoveChatPhoto = () => {
    setChatPhoto(null);
    setChatPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() && !chatPhoto) return;
    setSendingChat(true);
    const loadingId = toast.showLoading("Mengirim komentar...");
    const formData = new FormData();
    formData.append("message", chatMessage);
    if (chatPhoto) formData.append("photo", chatPhoto);
    if (isProof) formData.append("is_proof", "true");
    try {
      const res = await client.post(`/reports/${task.uid}/comments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.dismiss(loadingId);
      setComments((prev) => [...prev, res.data]);
      setChatMessage("");
      handleRemoveChatPhoto();
      if (isProof) {
        setIsProof(false);
        toast.showSuccess("Bukti penyelesaian berhasil dikirim.");
        fetchDetail();
      } else {
        toast.showSuccess("Komentar berhasil dikirim.");
      }
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err?.response?.status !== 401)
        toast.showError(err.response?.data?.error || "Gagal mengirim chat.");
    } finally {
      setSendingChat(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!window.confirm("Tandai tugas ini sebagai selesai?")) return;
    setCompleteLoading(true);
    const lid = toast.showLoading("Menyelesaikan tugas...");
    try {
      await client.put(`/me/reports/${task.uid}/status`);
      toast.dismiss(lid);
      toast.showSuccess("Tugas berhasil diselesaikan!");
      fetchDetail();
      onRefresh();
    } catch (err: any) {
      toast.dismiss(lid);
      if (err?.response?.status !== 401)
        toast.showError(err.response?.data?.error || "Gagal mengupdate status.");
    } finally {
      setCompleteLoading(false);
    }
  };

  const isCompleted = report.status === "SELESAI";
  const isScheduled = report.status === "DIJADWALKAN";
  const showCompleteBtn =
    user?.role === "ME" &&
    isScheduled &&
    report.assigned_me?.some((me) => me.id === user.id);
  const { label: statusLabel, cls: statusCls } = getStatusLabel(report);

  if (loadingDetail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted h-full">
        <Loader2 size={28} className="animate-spin text-brand-600" />
        <p className="text-sm font-medium">Memuat detail laporan...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Detail Header */}
      <div className="shrink-0 border-b border-line bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                ID-{report.uid}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  report.source === "SYSTEM"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-sky-100 text-sky-700"
                }`}
              >
                {report.source === "SYSTEM" ? "DASHCAM AI" : "WARGA"}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusCls}`}>
                {statusLabel}
              </span>
            </div>
            <h2 className="mt-1.5 text-sm font-semibold text-ink flex items-center gap-1.5 leading-snug">
              <MapPin size={14} className="text-muted shrink-0" />
              <span className="truncate">{report.location}</span>
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link
              to={`/me/reports/${report.uid}`}
              title="Buka halaman detail penuh"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-200 hover:bg-brand-100 hover:border-brand-300 transition"
            >
              <ExternalLink size={13} />
              <span>Detail Penuh</span>
            </Link>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-slate-100 transition"
              title="Tutup detail"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Report Info */}
        <div className="p-5 space-y-4">
          {/* False Report Banner */}
          {report.is_false_report && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <ShieldAlert size={14} className="shrink-0" />
              <span className="font-semibold">Laporan Palsu — disembunyikan dari publik.</span>
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Deskripsi</p>
            <p className="text-xs text-ink leading-relaxed">{report.description}</p>
          </div>

          {/* Scheduled & Reporter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 border border-line p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Tanggal Kerja</p>
              <p className="text-xs font-semibold text-ink flex items-center gap-1">
                <Calendar size={12} className="text-brand-600" />
                {report.scheduled_date
                  ? new Date(report.scheduled_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-line p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Pelapor</p>
              <p className="text-xs font-semibold text-ink truncate">
                {report.source === "CITIZEN" ? report.reporter_name : "Sistem (Dashcam)"}
              </p>
            </div>
          </div>

          {/* Assigned ME */}
          {report.assigned_me && report.assigned_me.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Petugas ME</p>
              <div className="flex flex-wrap gap-1.5">
                {report.assigned_me.map((me) => (
                  <span
                    key={me.id}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100"
                  >
                    <HardHat size={11} className="text-brand-600" />
                    {me.email}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Photo */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Foto Kerusakan</p>
            <div className="rounded-lg overflow-hidden border border-line bg-slate-50 flex items-center justify-center aspect-video">
              {report.photo ? (
                <img
                  src={`data:image/jpeg;base64,${report.photo}`}
                  alt="Bukti"
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setActivePhoto({
                    src: `data:image/jpeg;base64,${report.photo}`,
                    alt: `Foto Kerusakan - ID: ${report.uid}`
                  })}
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted">
                  <Image size={24} className="text-slate-300" />
                  <span className="text-xs">Tidak ada foto</span>
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          {mapCoords && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1">
                <MapPin size={10} className="text-brand-600" />
                Peta Lokasi
              </p>
              <div className="rounded-lg overflow-hidden border border-line h-44 relative">
                <div id={`detail-map-${task.uid}`} className="h-full w-full z-10" />
              </div>
            </div>
          )}

          {/* Complete Button */}
          {showCompleteBtn && (
            <button
              onClick={handleCompleteTask}
              disabled={completeLoading}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50 shadow-sm"
            >
              {completeLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              Tandai Sebagai Selesai
            </button>
          )}
        </div>

        {/* Chat / Activity Log */}
        <div className="border-t border-line">
          <div className="px-5 py-3 bg-slate-50/80 flex items-center gap-2">
            <MessageSquare size={14} className="text-brand-600" />
            <h3 className="text-xs font-bold text-ink">Catatan Aktivitas & Chat</h3>
          </div>

          <div className="p-4 space-y-3 min-h-[120px] bg-slate-50/40">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-muted">
                <MessageSquare size={20} className="text-slate-300" />
                <p className="text-xs">Belum ada aktivitas.</p>
              </div>
            ) : (
              comments.map((comment) => {
                const isMine = comment.sender.email === user?.email;
                return (
                  <div
                    key={comment.id}
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1 text-[10px] text-muted mb-0.5 px-1">
                      <strong className="text-ink text-[10px]">{comment.sender.email}</strong>
                      <span className="rounded bg-brand-50 px-1 text-brand-600 font-bold uppercase text-[9px]">
                        {comment.sender.role}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(comment.created_at).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          commentId: comment.id,
                          isFinalProof: !!comment.is_final_proof,
                        });
                      }}
                      className={`rounded-xl px-3 py-2 text-xs max-w-[90%] transition-all ${
                        comment.is_final_proof
                          ? isMine
                            ? "bg-blue-600 text-white border-2 border-blue-400 ring-4 ring-blue-200/40 rounded-tr-none"
                            : "bg-blue-50 border-2 border-blue-300 text-blue-900 ring-4 ring-blue-100/50 rounded-tl-none"
                          : isMine
                          ? "bg-brand-600 text-white rounded-tr-none"
                          : "bg-white border border-line text-ink rounded-tl-none"
                      }`}
                    >
                      {comment.is_final_proof && (
                        <div
                          className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full mb-1 w-fit ${
                            isMine ? "bg-blue-700/70 text-blue-100" : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          <CheckCircle2 size={9} />
                          Bukti Final Perbaikan
                        </div>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{comment.message}</p>
                      {comment.photo && (
                        <div className="mt-1.5 rounded-lg overflow-hidden border border-line/30 max-w-[200px]">
                          <img
                            src={`data:image/jpeg;base64,${comment.photo}`}
                            alt="Lampiran"
                            className="max-h-32 w-full object-cover cursor-zoom-in"
                            onClick={() => setActivePhoto({
                              src: `data:image/jpeg;base64,${comment.photo}`,
                              alt: `Foto Lampiran - ID: ${report.uid}`
                            })}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="border-t border-line p-4 bg-white space-y-2">
            {chatPhotoPreview && (
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-line">
                <img
                  src={chatPhotoPreview}
                  alt="Preview"
                  className="h-10 w-10 object-cover rounded border border-line"
                />
                <span className="text-xs text-muted flex-1">Foto siap kirim</span>
                <button
                  onClick={handleRemoveChatPhoto}
                  className="p-1 rounded-full bg-slate-200 text-muted hover:text-ink transition"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {user?.role === "ME" && report.status !== "SELESAI" && (
              <label className="flex items-center gap-2 text-[11px] font-semibold text-ink cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={isProof}
                  onChange={(e) => setIsProof(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-line text-brand-600"
                />
                <span>Jadikan sebagai bukti penyelesaian</span>
              </label>
            )}

            <form onSubmit={handleSendChat} className="flex gap-2 items-center">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleChatPhotoChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg border border-line text-muted hover:text-ink hover:bg-slate-50 transition shrink-0"
                title="Unggah Foto"
              >
                <Camera size={15} />
              </button>
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Tulis catatan atau instruksi..."
                className="h-9 flex-1 px-3 rounded-lg border border-line bg-white text-xs text-ink outline-none transition focus:border-brand-600"
              />
              <button
                type="submit"
                disabled={sendingChat || (!chatMessage.trim() && !chatPhoto)}
                className="h-9 w-9 flex items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-50 shrink-0"
              >
                {sendingChat ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-white border border-line rounded-lg shadow-xl p-1.5 min-w-[160px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={async () => {
              try {
                await client.put(
                  `/reports/${task.uid}/comments/${contextMenu.commentId}/final-proof`
                );
                fetchDetail(true);
              } catch {
                alert("Gagal memperbarui status bukti final.");
              }
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 rounded text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 transition text-blue-900"
          >
            <CheckCircle2 size={13} className="text-blue-600" />
            {contextMenu.isFinalProof ? "Hapus Bukti Final" : "Jadikan Bukti Final"}
          </button>
        </div>
      )}

      <ImageModal
        isOpen={activePhoto !== null}
        onClose={() => setActivePhoto(null)}
        src={activePhoto?.src || ""}
        alt={activePhoto?.alt || ""}
      />
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export const MeTasksPage = () => {
  const toast = useToast();
  const [allTasks, setAllTasks] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Report | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("scheduled_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showFilters, setShowFilters] = useState(true);

  const fetchTasks = async () => {
    setLoading(true);
    const lid = toast.showLoading("Memuat daftar tugas...");
    try {
      const res = await client.get("/me/reports");
      setAllTasks(res.data);
      toast.dismiss(lid);
    } catch (err: any) {
      toast.dismiss(lid);
      if (err?.response?.status !== 401)
        toast.showError("Gagal memuat tugas. Pastikan server aktif.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Derived stats
  const totalCount = allTasks.length;
  const activeCount = allTasks.filter((t) => t.status === "DIJADWALKAN").length;
  const completedCount = allTasks.filter((t) => t.status === "SELESAI").length;
  const overdueCount = allTasks.filter(isTaskOverdue).length;

  // Filtering logic
  const filteredTasks = allTasks
    .filter((task) => {
      // Search
      const q = searchQuery.toLowerCase();
      if (
        q &&
        !task.uid.toLowerCase().includes(q) &&
        !task.location.toLowerCase().includes(q) &&
        !task.description.toLowerCase().includes(q)
      )
        return false;
      // Status
      if (statusFilter === "OVERDUE" && !isTaskOverdue(task)) return false;
      if (statusFilter === "DIJADWALKAN" && task.status !== "DIJADWALKAN") return false;
      if (statusFilter === "SELESAI" && task.status !== "SELESAI") return false;
      // Source
      if (sourceFilter !== "ALL" && task.source !== sourceFilter) return false;
      // Date range
      if (dateFrom && task.scheduled_date) {
        if (new Date(task.scheduled_date) < new Date(dateFrom)) return false;
      }
      if (dateTo && task.scheduled_date) {
        if (new Date(task.scheduled_date) > new Date(dateTo + "T23:59:59")) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let va: number = 0;
      let vb: number = 0;
      if (sortField === "scheduled_date") {
        va = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
        vb = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
      } else if (sortField === "created_at") {
        va = new Date(a.created_at).getTime();
        vb = new Date(b.created_at).getTime();
      } else if (sortField === "status") {
        const order: Record<string, number> = { DIJADWALKAN: 0, SELESAI: 1, MENUNGGU_VERIFIKASI: 2 };
        va = order[a.status] ?? 99;
        vb = order[b.status] ?? 99;
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });

  const hasActiveFilters =
    searchQuery || statusFilter !== "ALL" || sourceFilter !== "ALL" || dateFrom || dateTo;

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setSourceFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSortField("scheduled_date");
    setSortDir("asc");
  };

  const handleTaskClick = (task: Report) => {
    setSelectedTask(task);
    // Auto-expand sidebar on small if collapsed
  };

  return (
    <div className="h-full flex flex-col overflow-hidden -m-8">
      {/* Top Stats Bar */}
      <div className="shrink-0 bg-white border-b border-line px-6 py-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 mr-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white shadow-sm">
            <HardHat size={18} />
          </span>
          <div>
            <h1 className="text-sm font-bold text-ink leading-tight">Tugas Perbaikan</h1>
            <p className="text-[10px] text-muted">Maintenance Engineering</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap ml-auto">
          {[
            { label: "Total", val: totalCount, cls: "bg-slate-100 text-slate-700" },
            { label: "Dijadwalkan", val: activeCount, cls: "bg-blue-50 text-blue-700" },
            { label: "Selesai", val: completedCount, cls: "bg-emerald-50 text-emerald-700" },
            { label: "Terlambat", val: overdueCount, cls: overdueCount > 0 ? "bg-red-50 text-red-700 animate-pulse" : "bg-slate-100 text-slate-400" },
          ].map(({ label, val, cls }) => (
            <div key={label} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
              <span>{val}</span>
              <span className="font-medium opacity-70">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT: Filter Sidebar ──────────────────────────────────────────── */}
        <div
          className={`shrink-0 flex flex-col border-r border-line bg-white transition-all duration-300 ease-in-out overflow-hidden ${
            sidebarCollapsed ? "w-0" : "w-72"
          }`}
        >
          <div className="flex flex-col h-full min-w-[288px]">
            {/* Sidebar Header */}
            <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-brand-600" />
                <span className="text-xs font-bold text-ink">Filter & Pencarian</span>
              </div>
              <div className="flex items-center gap-1.5">
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1 text-[10px] font-semibold text-danger hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 transition"
                  >
                    <RotateCcw size={10} />
                    Reset
                  </button>
                )}
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className="p-1 rounded text-muted hover:text-ink hover:bg-slate-100 transition"
                  title="Toggle filter panel"
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${showFilters ? "" : "-rotate-90"}`}
                  />
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Search */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    Cari
                  </label>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ID, lokasi, deskripsi..."
                      className="h-8 w-full pl-8 pr-3 rounded-lg border border-line bg-slate-50 text-xs text-ink outline-none transition focus:border-brand-600 focus:bg-white"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    Status
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { val: "ALL", label: "Semua", icon: Circle },
                        { val: "DIJADWALKAN", label: "Dijadwalkan", icon: Clock },
                        { val: "SELESAI", label: "Selesai", icon: CheckCircle2 },
                        { val: "OVERDUE", label: "Terlambat", icon: AlertTriangle },
                      ] as { val: StatusFilter; label: string; icon: any }[]
                    ).map(({ val, label, icon: Icon }) => (
                      <button
                        key={val}
                        onClick={() => setStatusFilter(val)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition border ${
                          statusFilter === val
                            ? val === "OVERDUE"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : val === "SELESAI"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : val === "DIJADWALKAN"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-brand-50 text-brand-700 border-brand-200"
                            : "border-line text-muted hover:bg-slate-50 hover:text-ink"
                        }`}
                      >
                        <Icon size={12} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Source Filter */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    Sumber Laporan
                  </label>
                  <div className="flex gap-1.5">
                    {(
                      [
                        { val: "ALL", label: "Semua" },
                        { val: "CITIZEN", label: "Warga" },
                        { val: "SYSTEM", label: "Dashcam" },
                      ] as { val: SourceFilter; label: string }[]
                    ).map(({ val, label }) => (
                      <button
                        key={val}
                        onClick={() => setSourceFilter(val)}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition border ${
                          sourceFilter === val
                            ? val === "SYSTEM"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : val === "CITIZEN"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : "bg-brand-50 text-brand-700 border-brand-200"
                            : "border-line text-muted hover:bg-slate-50 hover:text-ink"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    Rentang Tanggal Kerja
                  </label>
                  <div className="space-y-1.5">
                    <div>
                      <p className="text-[10px] text-muted mb-0.5">Dari</p>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="h-8 w-full px-2.5 rounded-lg border border-line bg-slate-50 text-xs text-ink outline-none transition focus:border-brand-600 focus:bg-white"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted mb-0.5">Sampai</p>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="h-8 w-full px-2.5 rounded-lg border border-line bg-slate-50 text-xs text-ink outline-none transition focus:border-brand-600 focus:bg-white"
                      />
                    </div>
                    {(dateFrom || dateTo) && (
                      <button
                        onClick={() => { setDateFrom(""); setDateTo(""); }}
                        className="text-[10px] font-semibold text-muted hover:text-ink flex items-center gap-1"
                      >
                        <X size={10} />
                        Hapus rentang
                      </button>
                    )}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    Urutkan
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={sortField}
                      onChange={(e) => setSortField(e.target.value as SortField)}
                      className="flex-1 h-8 px-2 rounded-lg border border-line bg-slate-50 text-xs text-ink outline-none focus:border-brand-600 focus:bg-white"
                    >
                      <option value="scheduled_date">Tgl Kerja</option>
                      <option value="created_at">Tgl Buat</option>
                      <option value="status">Status</option>
                    </select>
                    <button
                      onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border border-line bg-slate-50 text-muted hover:bg-slate-100 hover:text-ink transition"
                      title={sortDir === "asc" ? "Ascending" : "Descending"}
                    >
                      <ArrowUpDown size={13} className={sortDir === "desc" ? "rotate-180" : ""} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Results Count */}
            <div className="shrink-0 px-4 py-2.5 border-t border-line bg-slate-50/80 flex items-center justify-between">
              <span className="text-[11px] text-muted font-medium">
                {filteredTasks.length} dari {allTasks.length} tugas
              </span>
              {hasActiveFilters && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                  <Filter size={9} />
                  Terfilter
                </span>
              )}
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto border-t border-line">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted">
                  <Loader2 size={24} className="animate-spin text-brand-600" />
                  <p className="text-xs">Memuat tugas...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted px-4 text-center">
                  <CheckSquare size={28} className="text-slate-300" />
                  <p className="text-xs font-medium">
                    {allTasks.length === 0
                      ? "Tidak ada tugas yang ditugaskan."
                      : "Tidak ada tugas yang sesuai filter."}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                    >
                      <RotateCcw size={10} />
                      Reset Filter
                    </button>
                  )}
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isSelected={selectedTask?.uid === task.uid}
                    onClick={() => handleTaskClick(task)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* ─── Collapse Toggle Button ─────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center bg-white border-r border-line">
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="flex flex-col items-center justify-center h-16 w-5 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 border-r border-line text-muted transition group"
            title={sidebarCollapsed ? "Buka panel filter" : "Tutup panel filter"}
          >
            {sidebarCollapsed ? (
              <ChevronRight size={14} className="group-hover:text-brand-600" />
            ) : (
              <ChevronLeft size={14} className="group-hover:text-brand-600" />
            )}
          </button>
        </div>

        {/* ─── RIGHT: Detail Panel ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {selectedTask ? (
            <DetailPanel
              key={selectedTask.uid}
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
              onRefresh={fetchTasks}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted bg-slate-50/40">
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl bg-brand-50 flex items-center justify-center">
                  <HardHat size={36} className="text-brand-300" />
                </div>
                <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-white border-2 border-brand-100 flex items-center justify-center">
                  <ChevronLeft size={16} className="text-brand-400" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-ink">Pilih Tugas</p>
                <p className="text-xs text-muted mt-1 max-w-xs">
                  Klik salah satu tugas di panel kiri untuk melihat detail, catatan aktivitas, dan mengirim chat.
                </p>
              </div>
              {!sidebarCollapsed && filteredTasks.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full border border-brand-100">
                  <Filter size={11} />
                  {filteredTasks.length} tugas tersedia
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

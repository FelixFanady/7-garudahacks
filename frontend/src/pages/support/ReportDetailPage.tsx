import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, Calendar, User, HardHat, Clock, Check, 
  Send, Image, Loader2, AlertCircle, CheckCircle2, MapPin, 
  MessageSquare, Camera, X, CheckSquare, ChevronLeft, ChevronRight, ChevronDown, Pencil,
  ShieldAlert, ShieldCheck, XCircle
} from "lucide-react";
import client from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ImageModal } from "../../components/ImageModal";
import { ConfirmModal } from "../../components/ConfirmModal";

interface MEStaff {
  id: number;
  email: string;
}

interface Comment {
  id: number;
  message: string;
  photo: string | null;
  is_final_proof: boolean;
  created_at: string;
  sender: {
    email: string;
    role: "ADMIN" | "ME" | "SUPPORT";
  };
}

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
  assigned_me: {
    id: number;
    email: string;
  }[] | null;
  is_false_report: boolean;
  created_at: string;
  updated_at: string;
}

export const ReportDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [report, setReport] = useState<Report | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<{ src: string; alt: string } | null>(null);
  
  // Support assignment states
  const [meStaffList, setMeStaffList] = useState<MEStaff[]>([]);
  const [selectedMeIds, setSelectedMeIds] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isEditing, setIsEditing] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    commentId: number;
    isFinalProof: boolean;
  } | null>(null);

  const mapInstanceRef = useRef<any>(null);
  const [mapCoords, setMapCoords] = useState<[number, number] | null>(null);

  const parseCoordinates = (loc: string): [number, number] | null => {
    const regex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
    const match = loc.match(regex);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return [lat, lng];
      }
    }
    return null;
  };

  useEffect(() => {
    if (!report) return;

    const coords = parseCoordinates(report.location);
    if (coords) {
      setMapCoords(coords);
    } else {
      const geocodeAddress = async () => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(report.location)}&limit=1`);
          const data = await res.json();
          if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            if (!isNaN(lat) && !isNaN(lon)) {
              setMapCoords([lat, lon]);
            }
          }
        } catch (e) {
          console.error("Geocoding failed", e);
        }
      };
      geocodeAddress();
    }
  }, [report?.location]);

  useEffect(() => {
    if (!mapCoords) return;

    const L = (window as any).L;
    if (!L) return;

    const [lat, lng] = mapCoords;

    let mapTimeout = setTimeout(() => {
      const container = document.getElementById("detail-map");
      if (!container) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([lat, lng], 16);
        if ((window as any).detailMarker) {
          (window as any).detailMarker.setLatLng([lat, lng]);
        }
        return;
      }

      const map = L.map(container, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: true,
        touchZoom: true
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      const marker = L.marker([lat, lng], { draggable: false }).addTo(map);
      (window as any).detailMarker = marker;
      mapInstanceRef.current = map;
    }, 100);

    return () => {
      clearTimeout(mapTimeout);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        (window as any).detailMarker = null;
      }
    };
  }, [mapCoords]);

  // Scheduler Calendar States
  const [schedMonth, setSchedMonth] = useState(new Date());

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const schedYear = schedMonth.getFullYear();
  const schedMonthIdx = schedMonth.getMonth();

  const schedFirstDayIndex = new Date(schedYear, schedMonthIdx, 1).getDay();
  const schedCurrentMonthDays = new Date(schedYear, schedMonthIdx + 1, 0).getDate();
  const schedPrevMonthDays = new Date(schedYear, schedMonthIdx, 0).getDate();

  const schedCells: { date: Date; isCurrentMonth: boolean }[] = [];

  for (let i = schedFirstDayIndex - 1; i >= 0; i--) {
    schedCells.push({
      date: new Date(schedYear, schedMonthIdx - 1, schedPrevMonthDays - i),
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= schedCurrentMonthDays; i++) {
    schedCells.push({
      date: new Date(schedYear, schedMonthIdx, i),
      isCurrentMonth: true,
    });
  }

  const schedRemaining = 42 - schedCells.length;
  for (let i = 1; i <= schedRemaining; i++) {
    schedCells.push({
      date: new Date(schedYear, schedMonthIdx + 1, i),
      isCurrentMonth: false,
    });
  }

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // ME task completion state
  const [completeLoading, setCompleteLoading] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // False report toggle state
  const [falseReportLoading, setFalseReportLoading] = useState(false);
  const [showFalseReportConfirm, setShowFalseReportConfirm] = useState(false);

  // Cancel schedule state
  const [cancelScheduleLoading, setCancelScheduleLoading] = useState(false);
  const [showCancelScheduleConfirm, setShowCancelScheduleConfirm] = useState(false);

  // Chat message states
  const [chatMessage, setChatMessage] = useState("");
  const [chatPhoto, setChatPhoto] = useState<File | null>(null);
  const [chatPhotoPreview, setChatPhotoPreview] = useState<string | null>(null);
  const [sendingChat, setSendingChat] = useState(false);
  const [isProof, setIsProof] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchDetails = async (silent = false) => {
    try {
      const response = await client.get(`/reports/${id}`);
      setReport(response.data.report);
      setComments(response.data.comments);
    } catch (err: any) {
      if (!silent) {
        if (err?.response?.status !== 401) {
          setFetchError("Gagal memuat detail laporan. Pastikan ID laporan valid.");
        }
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const fetchMeStaff = async () => {
    try {
      const response = await client.get("/support/me-staff");
      setMeStaffList(response.data);
    } catch (err) {
      console.error("Failed to load ME staff list", err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDetails();
    if (user && (user.role === "ADMIN" || user.role === "SUPPORT")) {
      fetchMeStaff();
    }

    // Polling comments and status updates every 5 seconds for real-time sync
    const interval = setInterval(() => {
      fetchDetails(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [id, user]);

  const prevCommentsLengthRef = useRef(0);
  useEffect(() => {
    if (comments.length > prevCommentsLengthRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCommentsLengthRef.current = comments.length;
  }, [comments]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const closeContextMenu = () => setContextMenu(null);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("click", closeContextMenu);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("click", closeContextMenu);
    };
  }, []);

  const filteredMeStaff = meStaffList.filter(staff =>
    staff.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMeIds.length === 0 || !scheduledDate) {
      toast.showError("Silakan pilih minimal satu petugas ME dan tanggal pengerjaan.");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(scheduledDate);
    targetDate.setHours(0, 0, 0, 0);
    if (targetDate.getTime() < today.getTime()) {
      toast.showError("Tanggal pengerjaan tidak boleh hari sebelumnya.");
      return;
    }

    setAssignLoading(true);
    const loadingId = toast.showLoading("Menjadwalkan tugas perbaikan...");

    try {
      const response = await client.put(`/support/reports/${id}/schedule`, {
        assigned_me_ids: selectedMeIds.map(val => parseInt(val)),
        scheduled_date: scheduledDate,
      });

      setReport(response.data.report);
      toast.dismiss(loadingId);
      toast.showSuccess("Perbaikan berhasil dijadwalkan dan ditugaskan.");
      setIsEditing(false);
      fetchDetails();
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err?.response?.status !== 401) {
        toast.showError(err.response?.data?.error || "Gagal menjadwalkan tugas.");
      }
    } finally {
      setAssignLoading(false);
    }
  };

  const handleToggleFalseReport = async () => {
    setShowFalseReportConfirm(false);
    setFalseReportLoading(true);
    const loadingId = toast.showLoading("Memperbarui status laporan...");
    try {
      const response = await client.put(`/support/reports/${id}/false-report`);
      setReport(prev => prev ? { ...prev, is_false_report: response.data.is_false_report } : prev);
      toast.dismiss(loadingId);
      toast.showSuccess(response.data.message);
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err?.response?.status !== 401) {
        toast.showError(err.response?.data?.error || "Gagal mengubah status laporan palsu.");
      }
    } finally {
      setFalseReportLoading(false);
    }
  };

  const handleCancelSchedule = async () => {
    setShowCancelScheduleConfirm(false);
    setCancelScheduleLoading(true);
    const loadingId = toast.showLoading("Membatalkan penugasan ME...");
    try {
      const response = await client.put(`/support/reports/${id}/cancel-schedule`);
      setReport(response.data.report);
      toast.dismiss(loadingId);
      toast.showSuccess(response.data.message || "Penugasan ME berhasil dibatalkan.");
      fetchDetails();
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err?.response?.status !== 401) {
        toast.showError(err.response?.data?.error || "Gagal membatalkan penugasan ME.");
      }
    } finally {
      setCancelScheduleLoading(false);
    }
  };

  const handleCompleteTask = async () => {
    setShowCompleteConfirm(false);
    setCompleteLoading(true);
    const loadingId = toast.showLoading("Menyelesaikan tugas...");
    try {
      await client.put(`/me/reports/${id}/status`);
      toast.dismiss(loadingId);
      toast.showSuccess("Tugas berhasil diselesaikan! Status laporan terupdate.");
      fetchDetails();
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err?.response?.status !== 401) {
        toast.showError(err.response?.data?.error || "Gagal mengupdate status tugas.");
      }
    } finally {
      setCompleteLoading(false);
    }
  };

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
    if (chatPhoto) {
      formData.append("photo", chatPhoto);
    }
    if (isProof) {
      formData.append("is_proof", "true");
    }

    try {
      const response = await client.post(`/reports/${id}/comments`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.dismiss(loadingId);
      setComments(prev => [...prev, response.data]);
      setChatMessage("");
      handleRemoveChatPhoto();
      if (isProof) {
        setIsProof(false);
        toast.showSuccess("Bukti penyelesaian berhasil dikirim.");
        fetchDetails();
      } else {
        toast.showSuccess("Komentar berhasil dikirim.");
      }
    } catch (err: any) {
      toast.dismiss(loadingId);
      if (err?.response?.status !== 401) {
        toast.showError(err.response?.data?.error || "Gagal mengirim chat/komentar.");
      }
    } finally {
      setSendingChat(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-muted">
        <Loader2 size={32} className="animate-spin text-brand-600" />
        <p className="text-sm font-medium">Memuat rincian laporan...</p>
      </div>
    );
  }

  if (fetchError && !report) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center max-w-xl mx-auto">
        <AlertCircle className="mx-auto text-danger mb-2" size={32} />
        <h4 className="font-semibold text-danger">Gagal Memuat Detail</h4>
        <p className="text-sm text-red-700 mt-1">{fetchError}</p>
        <Link to={user?.role === "ME" ? "/me" : "/support"} className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white hover:bg-brand-700">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  if (!report) return null;

  const isPending = report.status === "MENUNGGU_VERIFIKASI";
  const isScheduled = report.status === "DIJADWALKAN";
  const isCompleted = report.status === "SELESAI";

  const showScheduler = (user?.role === "SUPPORT" || user?.role === "ADMIN") && (isPending || isScheduled || isCompleted);
  const showCompleteBtn = user?.role === "ME" && isScheduled && report.assigned_me?.some(me => me.id === user.id);

  const hasSidebar = showScheduler || showCompleteBtn;

  const contentBlock = (
    <div className="space-y-6">
      {/* Detail Card */}
      <div className="rounded-xl border border-line bg-white shadow-sm overflow-hidden">
        <div className="border-b border-line px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                ID-{report.uid}
              </span>
              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                report.source === "SYSTEM" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-brand-700"
              }`}>
                {report.source === "SYSTEM" ? "DASHCAM AI" : "WARGA"}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-ink flex items-center gap-1.5">
              <MapPin size={18} className="text-muted" />
              {report.location}
            </h2>
          </div>
          {(() => {
            if (report.is_false_report) {
              return (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                  <ShieldAlert size={12} />
                  False Report
                </span>
              );
            }

            let isOverdue = false;
            if (report.status !== "SELESAI" && report.scheduled_date) {
              const sched = new Date(report.scheduled_date);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              sched.setHours(0, 0, 0, 0);
              isOverdue = sched.getTime() < today.getTime();
            }

            let badgeClass = "bg-slate-50 text-slate-500 border border-slate-200"; // neutral
            let statusLabel = report.status === "MENUNGGU_VERIFIKASI" ? "Menunggu Verifikasi" : "Dijadwalkan";

            if (isCompleted) {
              badgeClass = "bg-emerald-50 text-success border border-emerald-200";
              statusLabel = "Selesai";
            } else if (isOverdue) {
              badgeClass = "bg-red-50 text-danger border border-red-200 animate-pulse";
              statusLabel = "Terlambat (Deadline)";
            }

            return (
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                {statusLabel}
              </span>
            );
          })()}
        </div>

        <div className="p-6 grid gap-6 md:grid-cols-2">
          {/* Info Column */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Deskripsi Laporan</h4>
              <p className="mt-1.5 text-sm text-ink leading-relaxed">{report.description}</p>
            </div>

            <div className="border-t border-line pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Detail Pelapor</h4>
              {report.source === "CITIZEN" ? (
                <div className="mt-2 space-y-1.5">
                  <p className="text-sm font-medium text-ink flex items-center gap-2">
                    <User size={15} className="text-muted" />
                    {report.reporter_name}
                  </p>
                  <p className="text-xs text-muted flex items-center gap-2">
                    <Clock size={15} />
                    {report.reporter_email}
                  </p>
                </div>
              ) : (
                <p className="mt-1.5 text-sm font-semibold text-purple-700">Deteksi Sistem (Dashcam AI)</p>
              )}
            </div>

            {report.assigned_me && report.assigned_me.length > 0 && (
              <div className="border-t border-line pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Penugasan ME</h4>
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {report.assigned_me.map(me => (
                      <span key={me.id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-100">
                        <HardHat size={12} className="text-brand-600" />
                        {me.email}
                      </span>
                    ))}
                  </div>
                  {report.scheduled_date && (
                    <p className="text-xs text-muted flex items-center gap-2 mt-1">
                      <Calendar size={15} />
                      Jadwal: {new Date(report.scheduled_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Photo Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Foto Bukti Kerusakan</h4>
            <div className="rounded-lg overflow-hidden border border-line bg-slate-50 flex items-center justify-center aspect-video sm:aspect-square">
              {report.photo ? (
                <img 
                  src={`data:image/jpeg;base64,${report.photo}`} 
                  alt="Bukti Laporan" 
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setActivePhoto({
                    src: `data:image/jpeg;base64,${report.photo}`,
                    alt: `Foto Bukti Kerusakan - ID: ${report.uid}`
                  })}
                />
              ) : (
                <span className="text-xs text-muted">Tidak ada foto</span>
              )}
            </div>
          </div>
        </div>

        {/* Map Section */}
        {mapCoords && (
          <div className="border-t border-line p-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
              <MapPin size={14} className="text-brand-600" />
              Lokasi Peta Kerusakan
            </h4>
            <div className="rounded-lg overflow-hidden border border-line h-60 bg-slate-50 relative">
              <div id="detail-map" className="h-full w-full z-10" />
            </div>
          </div>
        )}
      </div>

      {/* Chat / Timeline Card */}
      <div className="rounded-xl border border-line bg-white shadow-sm flex flex-col h-[500px]">
        <div className="border-b border-line px-6 py-4 flex items-center gap-2">
          <MessageSquare size={18} className="text-brand-600" />
          <h3 className="font-semibold text-ink">Catatan Aktivitas & Chat Bukti</h3>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          {comments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted gap-2">
              <MessageSquare size={24} className="text-slate-300" />
              <p className="text-xs">Belum ada aktivitas obrolan.</p>
            </div>
          ) : (
            comments.map((comment) => {
              const isSenderMe = comment.sender.email === user?.email;
              return (
                <div key={comment.id} className={`flex flex-col ${isSenderMe ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted mb-1 px-1">
                    <strong className="text-ink">{comment.sender.email}</strong>
                    <span className="rounded bg-brand-50 px-1 text-brand-600 font-bold uppercase scale-90">
                      {comment.sender.role}
                    </span>
                    <span>•</span>
                    <span>{new Date(comment.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  
                  <div 
                    onContextMenu={(e) => {
                      if (user?.role === "SUPPORT" || user?.role === "ME" || user?.role === "ADMIN") {
                        e.preventDefault();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          commentId: comment.id,
                          isFinalProof: !!comment.is_final_proof
                        });
                      }
                    }}
                    className={`rounded-xl px-4 py-2 text-sm max-w-[85%] transition-all ${
                      comment.is_final_proof
                        ? isSenderMe 
                          ? "bg-blue-600 text-white border-2 border-blue-400 ring-4 ring-blue-200/50 rounded-tr-none"
                          : "bg-blue-50 border-2 border-blue-300 text-blue-900 ring-4 ring-blue-100/50 rounded-tl-none"
                        : isSenderMe 
                        ? "bg-brand-600 text-white rounded-tr-none" 
                        : "bg-white border border-line text-ink rounded-tl-none"
                    }`}
                  >
                    {comment.is_final_proof && (
                      <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 w-fit ${
                        isSenderMe ? "bg-blue-700/80 text-blue-100" : "bg-blue-100 text-blue-700"
                      }`}>
                        <CheckCircle2 size={11} className={isSenderMe ? "text-blue-200" : "text-blue-600"} />
                        Bukti Final Perbaikan
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{comment.message}</p>
                    
                    {comment.photo && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-line max-w-xs bg-slate-100">
                        <img 
                          src={`data:image/jpeg;base64,${comment.photo}`} 
                          alt="Lampiran Bukti" 
                          className="max-h-40 w-full object-cover cursor-zoom-in"
                          onClick={() => setActivePhoto({
                            src: `data:image/jpeg;base64,${comment.photo}`,
                            alt: `Foto Lampiran Bukti - ID: ${report.uid}`
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

        {/* Image Preview inside Chat */}
        {chatPhotoPreview && (
          <div className="px-6 py-2 border-t border-line bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={chatPhotoPreview} alt="Preview" className="h-12 w-12 object-cover rounded-lg border border-line" />
              <span className="text-xs text-muted font-medium">Foto bukti siap kirim</span>
            </div>
            <button onClick={handleRemoveChatPhoto} className="p-1 rounded-full bg-slate-200 text-muted hover:text-ink transition">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Chat Input Bar */}
        <div className="border-t border-line p-4 bg-white flex flex-col gap-2">
          {/* Checkbox removed since proof is set via right click on existing comments/photos */}
          <form onSubmit={handleSendChat} className="flex gap-2 items-center w-full">
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
              className="p-2.5 rounded-lg border border-line text-muted hover:text-ink hover:bg-slate-50 transition shrink-0"
              title="Unggah Foto Bukti"
            >
              <Camera size={18} />
            </button>

            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Tulis tanggapan atau instruksi kerja..."
              className="h-10 flex-1 px-4 rounded-lg border border-line bg-white text-sm text-ink outline-none transition focus:border-brand-600"
            />

            <button
              type="submit"
              disabled={sendingChat || (!chatMessage.trim() && !chatPhoto)}
              className="h-10 w-10 flex items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-50 shrink-0"
            >
              {sendingChat ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link to={user?.role === "ME" ? "/me" : "/support"} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
        <ArrowLeft size={16} />
        Kembali ke Dashboard
      </Link>

      {/* False Report Banner */}
      {report.is_false_report && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-100">
          <ShieldAlert size={20} className="shrink-0 mt-0.5 text-red-600" />
          <div>
            <p className="font-semibold">Laporan Ditandai Sebagai Laporan Palsu</p>
            <p className="text-xs text-red-600 mt-0.5">Laporan ini disembunyikan dari tampilan transparansi publik.</p>
          </div>
        </div>
      )}



      {hasSidebar ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left 2 Columns: Details and Chat */}
          <div className="lg:col-span-2">
            {contentBlock}
          </div>

          {/* Right 1 Column: Actions/Scheduler */}
          <div className="space-y-6">
            {/* Support Scheduler */}
            {showScheduler && (
              <>
                {(!isPending && !isEditing) ? (
                  /* History Card */
                  <div className="rounded-xl border border-line bg-white p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <h3 className="font-semibold text-ink flex items-center gap-1.5">
                        <Calendar size={18} className="text-brand-600" />
                        Detail Penugasan ME
                      </h3>
                      {isScheduled && (
                        <button
                          type="button"
                          onClick={() => {
                            if (report.assigned_me) {
                              setSelectedMeIds(report.assigned_me.map(me => me.id.toString()));
                            }
                            if (report.scheduled_date) {
                              setScheduledDate(formatDate(new Date(report.scheduled_date)));
                              setSchedMonth(new Date(report.scheduled_date));
                            }
                            setIsEditing(true);
                          }}
                          className="p-1.5 text-muted hover:text-brand-600 hover:bg-slate-50 rounded-lg transition"
                          title="Ubah Penugasan"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3.5 text-xs text-ink">
                      <div>
                        <h4 className="font-bold text-muted uppercase tracking-wider text-[10px]">Petugas ME Ditugaskan</h4>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {report.assigned_me && report.assigned_me.length > 0 ? (
                            report.assigned_me.map(me => (
                              <span key={me.id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-100">
                                <HardHat size={12} className="text-brand-600" />
                                {me.email}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted">Tidak ada petugas ditugaskan</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-line pt-3">
                        <div>
                          <h4 className="font-bold text-muted uppercase tracking-wider text-[10px]">Tanggal Kerja</h4>
                          <p className="mt-1 font-semibold text-ink">
                            {report.scheduled_date 
                              ? new Date(report.scheduled_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-bold text-muted uppercase tracking-wider text-[10px]">Status Tugas</h4>
                          <p className="mt-1">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                              isCompleted ? "bg-emerald-50 text-success border border-emerald-200" : "bg-blue-50 text-brand-700 border border-blue-200"
                            }`}>
                              {isCompleted ? "Selesai" : "Dijadwalkan"}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-line pt-3 text-[10px] text-muted flex items-center gap-1">
                        <Clock size={12} />
                        <span>Dijadwalkan pada: {new Date(report.updated_at).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>

                      {report.is_false_report && report.assigned_me && report.assigned_me.length > 0 && (
                        <div className="border-t border-line pt-3">
                          <button
                            type="button"
                            onClick={() => setShowCancelScheduleConfirm(true)}
                            className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                          >
                            <XCircle size={14} />
                            Batal Penugasan ME
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Form */
                  <div className="rounded-xl border border-line bg-white p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <h3 className="font-semibold text-ink flex items-center gap-1.5">
                        <Calendar size={18} className="text-brand-600" />
                        {isPending ? "Jadwalkan & Tugaskan ME" : "Ubah Penugasan ME"}
                      </h3>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="p-1 text-muted hover:text-ink hover:bg-slate-50 rounded-lg transition"
                          title="Batal"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    {!isEditing && (
                      <p className="text-xs text-muted mt-1">Lakukan penugasan ke tim Maintenance Engineering (ME) serta tetapkan tanggal pengerjaan.</p>
                    )}

                    <form onSubmit={handleAssign} className="space-y-4 pt-2">
                      <div className="relative" ref={dropdownRef}>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted">Pilih Petugas ME</label>
                        {meStaffList.length === 0 ? (
                          <p className="text-xs text-danger mt-1">Tidak ada staf ME aktif untuk ditugaskan. Silakan buat akun ME terlebih dahulu.</p>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                              className="mt-2 flex h-10 w-full items-center justify-between rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                            >
                              <span className="truncate">
                                {selectedMeIds.length === 0
                                  ? "Pilih petugas ME..."
                                  : `${selectedMeIds.length} petugas terpilih`}
                              </span>
                              <ChevronDown size={16} className={`text-muted transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                            </button>

                            {isDropdownOpen && (
                              <div className="absolute z-20 mt-1.5 w-full rounded-lg border border-line bg-white p-2 shadow-lg space-y-2">
                                <input
                                  type="text"
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  placeholder="Cari email petugas..."
                                  className="h-8 w-full rounded-md border border-line bg-slate-50 px-2.5 text-xs text-ink outline-none transition focus:border-brand-600 focus:bg-white"
                                />
                                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                                  {filteredMeStaff.length === 0 ? (
                                    <p className="text-xs text-muted text-center py-2">Petugas tidak ditemukan.</p>
                                  ) : (
                                    filteredMeStaff.map(staff => {
                                      const isChecked = selectedMeIds.includes(staff.id.toString());
                                      return (
                                        <label
                                          key={staff.id}
                                          className={`flex items-center gap-2.5 rounded px-2 py-1.5 text-xs font-medium text-ink cursor-pointer select-none transition ${
                                            isChecked ? "bg-brand-50/50 text-brand-700 font-semibold" : "hover:bg-slate-50"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            value={staff.id.toString()}
                                            checked={isChecked}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedMeIds(prev => [...prev, staff.id.toString()]);
                                              } else {
                                                setSelectedMeIds(prev => prev.filter(id => id !== staff.id.toString()));
                                              }
                                            }}
                                            className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-100"
                                          />
                                          <span className="truncate">{staff.email}</span>
                                        </label>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            )}

                            {selectedMeIds.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {selectedMeIds.map(id => {
                                  const staff = meStaffList.find(s => s.id.toString() === id);
                                  if (!staff) return null;
                                  return (
                                    <span key={id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-ink border border-line">
                                      {staff.email}
                                      <button
                                        type="button"
                                        onClick={() => setSelectedMeIds(prev => prev.filter(item => item !== id))}
                                        className="text-muted hover:text-ink transition ml-0.5 text-xs"
                                      >
                                        &times;
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Tanggal Pengerjaan</label>
                        <div className="border border-line rounded-lg bg-white p-3 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink">
                              {monthNames[schedMonthIdx]} {schedYear}
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setSchedMonth(new Date(schedYear, schedMonthIdx - 1, 1))}
                                className="p-1 rounded border border-line hover:bg-slate-50 text-muted transition"
                              >
                                <ChevronLeft size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSchedMonth(new Date(schedYear, schedMonthIdx + 1, 1))}
                                className="p-1 rounded border border-line hover:bg-slate-50 text-muted transition"
                              >
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Weekday labels */}
                          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-muted">
                            <div>S</div>
                            <div>M</div>
                            <div>T</div>
                            <div>W</div>
                            <div>T</div>
                            <div>F</div>
                            <div>S</div>
                          </div>

                          {/* Day cells */}
                          <div className="grid grid-cols-7 gap-y-1.5 text-center text-xs font-medium">
                            {schedCells.map((cell, idx) => {
                              const formattedCell = formatDate(cell.date);
                              const isSelected = scheduledDate === formattedCell;
                              
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const cellDate = new Date(cell.date);
                              cellDate.setHours(0, 0, 0, 0);
                              const isPast = cellDate.getTime() < today.getTime();
                              
                              const isToday = isSameDay(cell.date, new Date());
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  disabled={isPast}
                                  onClick={() => setScheduledDate(formattedCell)}
                                  className={`h-7 w-7 mx-auto flex items-center justify-center rounded-full transition-all ${
                                    isSelected
                                      ? "bg-brand-600 text-white font-semibold"
                                      : isToday
                                      ? "border border-brand-600 text-brand-600 font-semibold"
                                      : isPast
                                      ? "text-slate-200 cursor-not-allowed bg-slate-50/50"
                                      : cell.isCurrentMonth
                                      ? "text-ink hover:bg-slate-100"
                                      : "text-slate-300 hover:bg-slate-50"
                                  }`}
                                >
                                  {cell.date.getDate()}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {scheduledDate && (
                          <p className="text-[11px] text-brand-600 font-semibold mt-2">
                            Tanggal Terpilih: {new Date(scheduledDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={assignLoading || meStaffList.length === 0}
                        className="h-10 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 transition disabled:opacity-50"
                      >
                        {assignLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckSquare size={16} />}
                        Jadwalkan Tugas
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}

            {/* ME Complete Action */}
            {showCompleteBtn && (
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="font-semibold text-brand-900 flex items-center gap-1.5">
                    <CheckCircle2 size={18} className="text-success" />
                    Konfirmasi Penyelesaian Tugas
                  </h3>
                  <p className="text-xs text-muted mt-1">Pastikan Anda telah mengunggah foto bukti pelaksanaan pekerjaan di kolom chat sebelum menyelesaikan tugas.</p>
                </div>

                <button
                  onClick={() => setShowCompleteConfirm(true)}
                  disabled={completeLoading || !comments.some(c => c.is_final_proof)}
                  className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-success text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {completeLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Tandai Sebagai Selesai
                </button>

                {!comments.some(c => c.is_final_proof) && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/50 rounded-lg p-3 leading-relaxed">
                    <strong>Peringatan:</strong> Tombol ini dinonaktifkan karena belum ada bukti penyelesaian. Silakan unggah foto di chat, lalu klik kanan foto tersebut dan pilih <strong>"Jadikan Bukti Final"</strong> terlebih dahulu.
                  </p>
                )}
              </div>
            )}

            {/* False Report Toggle — Support/Admin only */}
            {(user?.role === "SUPPORT" || user?.role === "ADMIN") && (
              <div className={`rounded-xl border p-5 shadow-sm space-y-3 ${
                report.is_false_report
                  ? "border-red-200 bg-red-50/60"
                  : "border-orange-200 bg-orange-50/60"
              }`}>
                <div className="flex items-center gap-2">
                  {report.is_false_report
                    ? <ShieldCheck size={17} className="text-red-500 shrink-0" />
                    : <ShieldAlert size={17} className="text-orange-500 shrink-0" />
                  }
                  <h3 className={`font-semibold text-sm ${
                    report.is_false_report ? "text-red-800" : "text-orange-800"
                  }`}>
                    {report.is_false_report ? "Status: Laporan Palsu" : "Moderasi Laporan"}
                  </h3>
                </div>
                <p className={`text-xs leading-relaxed ${
                  report.is_false_report ? "text-red-600" : "text-orange-700"
                }`}>
                  {report.is_false_report
                    ? "Laporan ini saat ini disembunyikan dari publik. Klik tombol di bawah untuk memulihkannya."
                    : "Jika laporan ini terbukti tidak valid, tandai sebagai laporan palsu untuk menyembunyikannya dari transparansi publik."
                  }
                </p>
                <button
                  onClick={() => setShowFalseReportConfirm(true)}
                  disabled={falseReportLoading}
                  className={`h-10 w-full inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 ${
                    report.is_false_report
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {falseReportLoading
                    ? <Loader2 size={15} className="animate-spin" />
                    : report.is_false_report
                      ? <ShieldCheck size={15} />
                      : <ShieldAlert size={15} />
                  }
                  {report.is_false_report ? "Pulihkan Laporan" : "Tandai False Report"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full">
          {contentBlock}
        </div>
      )}
      {contextMenu && (
        <div 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-white border border-line rounded-lg shadow-xl p-1.5 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            onClick={async () => {
              const actionName = contextMenu.isFinalProof ? "Menghapus bukti final..." : "Menetapkan bukti final...";
              const loadingId = toast.showLoading(actionName);
              try {
                await client.put(`/reports/${id}/comments/${contextMenu.commentId}/final-proof`);
                toast.dismiss(loadingId);
                toast.showSuccess(contextMenu.isFinalProof ? "Bukti final berhasil dihapus." : "Bukti final berhasil ditetapkan.");
                fetchDetails(true); // reload silently
              } catch (err: any) {
                toast.dismiss(loadingId);
                toast.showError(err.response?.data?.error || "Gagal memperbarui status bukti final.");
              }
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 rounded text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 transition text-blue-900"
          >
            <CheckCircle2 size={14} className="text-blue-600" />
            <span>
              {contextMenu.isFinalProof ? "Hapus Bukti Final" : "Jadikan Bukti Final"}
            </span>
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={showCompleteConfirm}
        title="Konfirmasi Penyelesaian Tugas"
        message="Pastikan Anda telah mengunggah foto bukti pelaksanaan pekerjaan di kolom chat sebelum menyelesaikan tugas."
        confirmText="Ya, Selesai"
        cancelText="Batal"
        type="success"
        onConfirm={handleCompleteTask}
        onCancel={() => setShowCompleteConfirm(false)}
      />

      <ConfirmModal
        isOpen={showFalseReportConfirm}
        title={report?.is_false_report ? "Pulihkan Laporan" : "Moderasi Laporan Palsu"}
        message={
          report?.is_false_report
            ? "Apakah Anda yakin ingin memulihkan laporan ini agar tampil kembali di transparansi publik?"
            : "Apakah Anda yakin ingin menandai laporan ini sebagai laporan palsu? Laporan akan disembunyikan dari publik."
        }
        confirmText="Ya, Lanjutkan"
        cancelText="Batal"
        type={report?.is_false_report ? "info" : "danger"}
        onConfirm={handleToggleFalseReport}
        onCancel={() => setShowFalseReportConfirm(false)}
      />

      <ConfirmModal
        isOpen={showCancelScheduleConfirm}
        title="Batal Penugasan ME"
        message="Apakah Anda yakin ingin membatalkan penugasan ME untuk laporan ini? Status laporan akan kembali menjadi Menunggu Verifikasi."
        confirmText="Ya, Batal"
        cancelText="Kembali"
        type="danger"
        onConfirm={handleCancelSchedule}
        onCancel={() => setShowCancelScheduleConfirm(false)}
      />

      <ImageModal
        isOpen={activePhoto !== null}
        onClose={() => setActivePhoto(null)}
        src={activePhoto?.src || ""}
        alt={activePhoto?.alt || ""}
      />
    </div>
  );
};

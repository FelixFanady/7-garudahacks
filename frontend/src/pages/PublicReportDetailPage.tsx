import React, { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle, Calendar, CheckCircle2, User as UserIcon, MapPin } from "lucide-react";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { ImageModal } from "../components/ImageModal";
import client from "../api/client";

interface Report {
  id: number;
  uid: string;
  location: string;
  description: string;
  source: "CITIZEN" | "SYSTEM";
  status: "MENUNGGU_VERIFIKASI" | "DIJADWALKAN" | "SELESAI";
  photo: string;
  scheduled_date: string | null;
  created_at: string;
}

interface Comment {
  id: number;
  message: string;
  photo: string | null;
  is_proof: boolean;
  created_at: string;
  sender: {
    email: string;
    role: string;
  };
}

export const PublicReportDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState<{ src: string; alt: string } | null>(null);

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
      const container = document.getElementById("public-detail-map");
      if (!container) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([lat, lng], 16);
        if ((window as any).publicDetailMarker) {
          (window as any).publicDetailMarker.setLatLng([lat, lng]);
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
      (window as any).publicDetailMarker = marker;
      mapInstanceRef.current = map;
    }, 100);

    return () => {
      clearTimeout(mapTimeout);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        (window as any).publicDetailMarker = null;
      }
    };
  }, [mapCoords]);

  const fetchDetails = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await client.get(`/public/reports/${id}`);
      setReport(response.data.report);
      setComments(response.data.comments || []);
    } catch (err: any) {
      if (!silent) {
        setError(err.response?.data?.error || "Gagal memuat detail laporan perbaikan.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchDetails();

    // Poll for changes silently every 5 seconds for real-time sync
    const interval = setInterval(() => {
      fetchDetails(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={36} className="animate-spin text-brand-600" />
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <SiteHeader />
        <div className="flex-1 max-w-2xl mx-auto px-5 py-16 text-center">
          <AlertCircle size={40} className="mx-auto text-danger mb-3" />
          <h2 className="text-xl font-bold text-ink">Laporan Tidak Ditemukan</h2>
          <p className="text-sm text-muted mt-2">{error || "Detail laporan tidak dapat diakses."}</p>
          <Link to="/laporan/transparansi" className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 transition">
            <ArrowLeft size={16} /> Kembali ke Transparansi
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const isCompleted = report.status === "SELESAI";
  let isOverdue = false;
  if (report.status !== "SELESAI" && report.scheduled_date) {
    const sched = new Date(report.scheduled_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    sched.setHours(0, 0, 0, 0);
    isOverdue = sched.getTime() < today.getTime();
  }

  let badgeClass = "bg-slate-50 text-slate-500 ring-slate-200 border-slate-300"; // neutral
  let statusText = "Menunggu Verifikasi";

  if (isCompleted) {
    badgeClass = "bg-emerald-50 text-success ring-emerald-200 border-emerald-300";
    statusText = "Selesai Diperbaiki";
  } else if (isOverdue) {
    badgeClass = "bg-red-50 text-danger ring-red-200 border-red-300 animate-pulse";
    statusText = "Terlambat (Deadline)";
  } else if (report.status === "DIJADWALKAN") {
    statusText = "Dijadwalkan untuk Perbaikan";
  }

  // Find execution proof comment (prioritize final proof)
  const proofComment = comments.find(c => c.is_final_proof) || comments.find(c => c.is_proof);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      <SiteHeader />

      <main className="flex-1 mx-auto max-w-7xl w-full px-5 sm:px-8 py-12">
        <Link to="/laporan/transparansi" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 mb-6">
          <ArrowLeft size={16} />
          Kembali ke Transparansi Laporan
        </Link>

        {/* Top Header Summary */}
        <div className="rounded-2xl border border-line bg-white p-6 md:p-8 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                ID: {report.uid}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeClass}`}>
                {statusText}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-ink leading-tight">{report.location}</h1>
          </div>
        </div>

        {/* Main Details Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Details Card */}
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-ink pb-4 border-b border-line mb-4">Detail Kerusakan</h2>
              
              {report.photo && (
                <div className="rounded-xl overflow-hidden bg-slate-100 mb-6 border border-line max-h-[420px] flex items-center justify-center">
                  <img
                    src={`data:image/jpeg;base64,${report.photo}`}
                    alt="Bukti Kerusakan"
                    className="max-h-full object-contain cursor-zoom-in"
                    onClick={() => setActivePhoto({
                      src: `data:image/jpeg;base64,${report.photo}`,
                      alt: `Bukti Kerusakan - ID: ${report.uid}`
                    })}
                  />
                </div>
              )}

              <p className="text-sm leading-relaxed text-ink mb-6 whitespace-pre-wrap">{report.description}</p>

              <div className="grid gap-4 sm:grid-cols-2 border-t border-line pt-6 text-sm text-muted">
                <div className="flex items-center gap-2.5">
                  <Calendar size={18} />
                  <div>
                    <p className="text-xs font-semibold text-ink">Tanggal Dilaporkan</p>
                    <p>{new Date(report.created_at).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
                {report.scheduled_date && (
                  <div className="flex items-center gap-2.5">
                    <Calendar size={18} className="text-brand-600" />
                    <div>
                      <p className="text-xs font-semibold text-brand-600">Target Perbaikan</p>
                      <p className="font-medium text-ink">{new Date(report.scheduled_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Map Card */}
            {mapCoords && (
              <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
                  <MapPin size={16} className="text-brand-600" />
                  Lokasi Kerusakan Jalan
                </h4>
                <div className="rounded-xl overflow-hidden border border-line h-60 bg-slate-50 relative">
                  <div id="public-detail-map" className="h-full w-full z-10" />
                </div>
              </div>
            )}

            {/* Highlighted Proof spotlight card if completed */}
            {proofComment && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 shadow-sm ring-1 ring-emerald-100">
                <div className="flex items-center gap-2 text-success font-bold mb-4">
                  <CheckCircle2 size={20} />
                  <span>Bukti Hasil Pengerjaan (ME)</span>
                </div>
                <p className="text-sm leading-relaxed text-ink mb-4">{proofComment.message}</p>
                {proofComment.photo && (
                  <div className="rounded-lg overflow-hidden border border-emerald-100 max-h-80 bg-white flex items-center justify-center shadow-sm">
                    <img
                      src={`data:image/jpeg;base64,${proofComment.photo}`}
                      alt="Foto Hasil Perbaikan"
                      className="max-h-full object-contain cursor-zoom-in"
                      onClick={() => setActivePhoto({
                        src: `data:image/jpeg;base64,${proofComment.photo}`,
                        alt: `Foto Hasil Perbaikan - ID: ${report.uid}`
                      })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Chat Progress Timeline */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-line bg-white p-6 shadow-sm flex flex-col h-[500px]">
              <h2 className="text-base font-semibold text-ink pb-4 border-b border-line mb-4 shrink-0">Log Progres Perbaikan</h2>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {comments.length === 0 ? (
                  <p className="text-xs text-center text-muted py-10">Belum ada pembaruan log perbaikan.</p>
                ) : (
                    comments.map((comment) => {
                      const senderLabel = comment.sender.role === "SUPPORT" ? "Support" : comment.sender.role === "ME" ? "Maintenance Engineer" : "Admin";

                      let bgClass = "bg-slate-50 border border-line";
                      if (comment.is_final_proof) {
                        bgClass = "bg-blue-50 border-2 border-blue-300 text-blue-900 ring-4 ring-blue-50";
                      } else if (comment.is_proof) {
                        bgClass = "bg-emerald-50 border border-emerald-200";
                      }

                      return (
                        <div
                          key={comment.id}
                          className={`p-3.5 rounded-xl text-xs flex flex-col gap-2 relative ${bgClass}`}
                        >
                        <div className="flex justify-between items-center gap-2">
                          <span className="font-semibold text-ink inline-flex items-center gap-1">
                            <UserIcon size={12} className="text-muted" />
                            {senderLabel}
                          </span>
                          <span className="text-[10px] text-muted">
                            {new Date(comment.created_at).toLocaleDateString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {comment.is_final_proof ? (
                          <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.5 rounded w-fit inline-block flex items-center gap-1">
                            <CheckCircle2 size={10} className="text-blue-600 animate-pulse" />
                            Bukti Final Perbaikan
                          </span>
                        ) : comment.is_proof ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded w-fit inline-block">
                            Bukti Penyelesaian
                          </span>
                        ) : null}

                        <p className="text-ink whitespace-pre-wrap leading-relaxed">{comment.message}</p>

                        {comment.photo && (
                          <div className="mt-1 rounded overflow-hidden max-h-40 bg-white border border-line flex items-center justify-center">
                            <img
                              src={`data:image/jpeg;base64,${comment.photo}`}
                              alt="Attachment"
                              className="max-h-full object-contain cursor-zoom-in"
                              onClick={() => setActivePhoto({
                                src: `data:image/jpeg;base64,${comment.photo}`,
                                alt: `Foto Lampiran Log Perbaikan - ID: ${report.uid}`
                              })}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <ImageModal
        isOpen={activePhoto !== null}
        onClose={() => setActivePhoto(null)}
        src={activePhoto?.src || ""}
        alt={activePhoto?.alt || ""}
      />

      <SiteFooter />
    </div>
  );
};

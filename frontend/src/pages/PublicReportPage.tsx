import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Loader2,
  MapPin,
  AlertCircle,
  CheckCircle2,
  User,
  UserCheck,
  ShieldAlert,
  Edit,
  FileText,
  Send,
} from "lucide-react";
import client from "../api/client";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { useToast } from "../context/ToastContext";

export const PublicReportPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [stats, setStats] = useState<{
    total_reports: number;
    work_areas: number;
    field_staff: number;
    armada_teams: number;
    completed_roads: number;
  } | null>(null);

  // Autocomplete and Maps states
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const navigate = useNavigate();
  const toast = useToast();
  const searchTimeoutRef = React.useRef<any>(null);

  // Leaflet Map Refs
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<any>(null);
  const markerInstanceRef = React.useRef<any>(null);

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.showError("Hanya file gambar (JPG, PNG, WEBP) yang diizinkan. GIF dan video tidak diperbolehkan.");
        e.target.value = "";
        return;
      }
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const formatPhotonFeature = (feature: any) => {
    const p = feature.properties || {};
    const parts: string[] = [];

    if (p.name) parts.push(p.name);

    if (p.street && p.street !== p.name) {
      if (p.housenumber) {
        parts.push(`${p.street} No. ${p.housenumber}`);
      } else {
        parts.push(p.street);
      }
    }

    const city = p.city || p.town || p.village || p.suburb;
    if (city) parts.push(city);
    if (p.state) parts.push(p.state);
    if (p.country) parts.push(p.country);

    return parts.length > 0 ? parts.join(", ") : "Lokasi tidak bernama";
  };

  const handleMapClickOrDrag = async (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`,
      );
      if (!res.ok) throw new Error("Gagal mengambil alamat dari koordinat");
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        const address = formatPhotonFeature(data.features[0]);
        setLocation(address);
      } else {
        setLocation(
          `Jalan Rusak di koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        );
      }
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
      setLocation(
        `Jalan Rusak di koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      );
    } finally {
      setIsSearching(false);
    }
  };

  const updateMapPosition = (lat: number, lng: number) => {
    const L = (window as any).L;
    if (!mapInstanceRef.current || !L) return;

    // Pan map to the coordinates
    mapInstanceRef.current.setView([lat, lng], 16);

    // Update or create marker
    if (markerInstanceRef.current) {
      markerInstanceRef.current.setLatLng([lat, lng]);
    } else {
      markerInstanceRef.current = L.marker([lat, lng], {
        draggable: true,
      }).addTo(mapInstanceRef.current);

      // Listen to dragend event
      markerInstanceRef.current.on("dragend", async (event: any) => {
        const marker = event.target;
        const position = marker.getLatLng();
        await handleMapClickOrDrag(position.lat, position.lng);
      });
    }
  };

  const handleLocationChange = (val: string) => {
    setLocation(val);
    setSearchError(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    setShowSuggestions(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api?q=${encodeURIComponent(val)}&limit=5&countrycode=id`,
        );
        if (!res.ok) throw new Error("Gagal mengambil data lokasi");
        const data = await res.json();

        const items = (data.features || []).map((feature: any) => {
          const coords = feature.geometry.coordinates; // [lon, lat]
          return {
            display_name: formatPhotonFeature(feature),
            lat: coords[1],
            lon: coords[0],
          };
        });

        setSuggestions(items || []);
      } catch (err) {
        console.error("Autocompletion failed:", err);
        setSearchError(
          "Gagal menghubungi server peta. Silakan ketik manual atau klik langsung pada peta.",
        );
      } finally {
        setIsSearching(false);
      }
    }, 600);
  };

  // Initialize Map
  React.useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (mapInstanceRef.current) return;

    const defaultLat = -6.2088;
    const defaultLng = 106.8456;

    // Fix Leaflet marker icon asset issue
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: true,
    }).setView([defaultLat, defaultLng], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    map.on("click", async (e: any) => {
      const { lat, lng } = e.latlng;
      updateMapPosition(lat, lng);
      await handleMapClickOrDrag(lat, lng);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
  }, []);

  // Close autocomplete on click outside
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const dropdown = document.getElementById("suggestions-dropdown");
      const input = document.getElementById("location-input");
      if (
        dropdown &&
        !dropdown.contains(e.target as Node) &&
        input &&
        !input.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  // Remove marker if input is cleared
  React.useEffect(() => {
    if (!location && markerInstanceRef.current) {
      markerInstanceRef.current.remove();
      markerInstanceRef.current = null;
    }
  }, [location]);

  // Fetch statistics from backend
  React.useEffect(() => {
    client
      .get("/public/stats")
      .then((res) => {
        setStats(res.data);
      })
      .catch((err) => {
        console.error("Gagal mengambil data statistik:", err);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!photo) {
      toast.showError("Silakan unggah foto bukti jalan berlubang/rusak.");
      return;
    }

    if (latitude === null || longitude === null) {
      toast.showError(
        "Silakan tentukan titik koordinat lokasi jalan rusak dengan mengklik peta atau memilih dari kotak pencarian.",
      );
      return;
    }

    setIsLoading(true);
    const loadingId = toast.showLoading("Mengirim laporan Anda...");

    const finalName = isAnonymous ? "Anonim" : name;
    const finalEmail = isAnonymous ? "anonim@gmail.com" : email;

    const formData = new FormData();
    formData.append("reporter_name", finalName);
    formData.append("reporter_email", finalEmail);
    formData.append("location", location);
    if (latitude !== null) formData.append("latitude", latitude.toString());
    if (longitude !== null) formData.append("longitude", longitude.toString());
    formData.append("description", description);
    formData.append("photo", photo);

    try {
      const response = await client.post("/lapor", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.dismiss(loadingId);
      const serverMessage =
        response.data?.message || "Laporan berhasil dikirim!";
      toast.showSuccess(serverMessage);
      setName("");
      setEmail("");
      setIsAnonymous(false);
      setLocation("");
      setDescription("");
      setPhoto(null);
      setPhotoPreview(null);
      setLatitude(null);
      setLongitude(null);
      setSuggestions([]);
      setShowSuggestions(false);

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([-6.2088, 106.8456], 12);
      }
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.showError(
        err.response?.data?.error ||
          "Gagal mengirim laporan. Pastikan koneksi server aktif.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <SiteHeader />

      {/* Hero Banner Section */}
      <div className="relative bg-gradient-to-r from-brand-900 via-brand-700 to-brand-600 text-white py-16 px-5 sm:px-8 overflow-hidden">
        {/* Background decorative patterns */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_20%,#ffffff_0%,transparent_50%)] pointer-events-none" />
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-4xl text-center relative z-10">
          <h1 className="text-3xl sm:text-4.5xl font-extrabold tracking-tight mb-3">
            Layanan Pengaduan Jalan Rusak Online
          </h1>
          <p className="max-w-xl mx-auto text-xs sm:text-sm text-brand-100 font-medium leading-relaxed">
            Laporkan jalan berlubang atau rusak di wilayah Anda secara cepat dan
            transparan demi keselamatan dan kenyamanan berkendara bersama.
          </p>
        </div>
      </div>

      <main className="flex-1 px-5 pb-16 pt-0 text-ink -mt-10 relative z-20">
        <div className="mx-auto max-w-2xl">
          {/* Back Link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-white/90 hover:text-white mb-4 transition drop-shadow-sm"
          >
            <ArrowLeft size={16} />
            Kembali ke Beranda
          </Link>

          {/* Form Block */}
          <div className="rounded-2xl border border-line bg-white p-6 sm:p-10 shadow-soft">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-ink">
                Sampaikan Laporan Anda
              </h2>
              <div className="mt-2 h-1 w-12 bg-brand-600 mx-auto rounded-full" />
            </div>

            {/* Anonymous Switcher */}
            <div className="mb-8">
              <label className="block text-center text-[10px] font-bold uppercase tracking-wider text-muted mb-3">
                Metode Pelaporan
              </label>
              <div className="flex p-1 bg-slate-100 rounded-xl max-w-xs mx-auto border border-line/50">
                <button
                  type="button"
                  onClick={() => setIsAnonymous(false)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition duration-200 ${
                    !isAnonymous
                      ? "bg-white text-brand-600 shadow-sm border border-line/20"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  <User size={14} />
                  Dengan Identitas
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnonymous(true)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition duration-200 ${
                    isAnonymous
                      ? "bg-white text-brand-600 shadow-sm border border-line/20"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  <UserCheck size={14} />
                  Anonim
                </button>
              </div>

              {isAnonymous ? (
                <div className="mt-3 text-center text-xs text-brand-700 bg-brand-50 py-2 px-3 rounded-lg border border-brand-100/50 max-w-sm mx-auto flex items-center gap-1.5 justify-center">
                  <ShieldAlert size={14} className="shrink-0 text-brand-600" />
                  <span>
                    Identitas Anda disembunyikan. Laporan dikirim sebagai{" "}
                    <strong>Anonim</strong>.
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-center text-xs text-muted max-w-sm mx-auto">
                  Laporan akan dikirim menggunakan nama dan email Anda.
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Conditionally render Reporter Name and Email */}
              {!isAnonymous && (
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-ink">
                      Nama Pelapor{" "}
                      <span className="text-brand-600 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama Lengkap"
                      required={!isAnonymous}
                      className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-ink">
                      Email Pelapor{" "}
                      <span className="text-brand-600 font-bold">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alamat@email.com"
                      required={!isAnonymous}
                      className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-ink">
                  Lokasi Jalan Rusak{" "}
                  <span className="text-brand-600 font-bold">*</span>
                </label>
                <div className="relative mt-2" id="search-container">
                  <MapPin
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted animate-bounce"
                  />
                  <input
                    id="location-input"
                    type="text"
                    value={location}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    onFocus={() => {
                      if (location.length >= 3) {
                        setShowSuggestions(true);
                      }
                    }}
                    placeholder="Ketik lokasi untuk mencari..."
                    required
                    className="h-11 w-full pl-10 pr-10 rounded-lg border border-line bg-white text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 size={16} className="animate-spin text-muted" />
                    </div>
                  )}

                  {/* Autocomplete Dropdown overlay */}
                  {showSuggestions && location.length >= 3 && (
                    <div
                      id="suggestions-dropdown"
                      className="absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-lg border border-line bg-white shadow-lg text-sm text-ink divide-y divide-line"
                    >
                      {isSearching && suggestions.length === 0 && (
                        <div className="flex items-center gap-2 px-4 py-3 text-muted">
                          <Loader2
                            size={16}
                            className="animate-spin text-brand-600"
                          />
                          <span>Mencari lokasi di Indonesia...</span>
                        </div>
                      )}

                      {searchError && (
                        <div className="px-4 py-3 text-xs text-danger bg-red-50/50">
                          {searchError}
                        </div>
                      )}

                      {!isSearching &&
                        suggestions.length === 0 &&
                        !searchError && (
                          <div className="px-4 py-3 text-muted">
                            Lokasi tidak ditemukan di Indonesia. Coba kata kunci
                            lain atau klik langsung pada peta.
                          </div>
                        )}

                      {suggestions.map((item, index) => (
                        <div
                          key={index}
                          onClick={() => {
                            setLocation(item.display_name);
                            setShowSuggestions(false);
                            if (item.lat && item.lon) {
                              const lat = parseFloat(item.lat);
                              const lng = parseFloat(item.lon);
                              setLatitude(lat);
                              setLongitude(lng);
                              updateMapPosition(lat, lng);
                            }
                          }}
                          className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition text-left flex items-start gap-2"
                          title={item.display_name}
                        >
                          <MapPin
                            size={16}
                            className="text-muted shrink-0 mt-0.5"
                          />
                          <span className="truncate">{item.display_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Interactive Leaflet Map */}
                <div className="mt-4 rounded-xl overflow-hidden border border-line h-80 w-full shadow-sm bg-slate-50 relative">
                  <div ref={mapContainerRef} className="h-full w-full z-10" />

                  {/* Floating badge for instructions */}
                  <div className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur border border-line rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm pointer-events-none flex items-center gap-1.5 animate-pulse">
                    <MapPin size={12} className="text-brand-600" />
                    <span>Scroll untuk zoom | Klik peta untuk set lokasi</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink">
                  Deskripsi Detail Laporan{" "}
                  <span className="text-brand-600 font-bold">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan kondisi jalan berlubang, ukuran estimasi, atau info tambahan yang membantu..."
                  required
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink">
                  Foto Bukti Jalan Rusak{" "}
                  <span className="text-brand-600 font-bold">*</span>
                </label>
                <div className="mt-2 flex flex-col items-center justify-center border-2 border-dashed border-line rounded-lg p-6 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer relative min-h-[160px]">
                  {photoPreview ? (
                    <div className="relative w-full flex justify-center">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="max-h-48 object-contain rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setPhoto(null);
                          setPhotoPreview(null);
                        }}
                        className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition"
                      >
                        <ArrowLeft size={14} className="rotate-90" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer py-4">
                      <Camera
                        className="text-muted mb-2 animate-bounce"
                        size={28}
                      />
                      <span className="text-sm font-medium text-ink">
                        Pilih File Foto
                      </span>
                      <span className="text-xs text-muted mt-1">
                        PNG, JPG, atau WEBP (maks. gambar statis)
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:opacity-75 shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  {isLoading ? "Mengirim Laporan..." : "Kirim Laporan"}
                </button>
              </div>
            </form>
          </div>

          {/* Timeline Section */}
          <div className="mt-12 rounded-2xl border border-line bg-white p-8 shadow-sm">
            <h3 className="text-base sm:text-lg font-bold text-center text-ink mb-8">
              Prosedur Penanganan Laporan Anda
            </h3>
            <div className="grid gap-6 sm:grid-cols-4 relative">
              {/* Progress line connector (desktop only) */}
              <div className="hidden sm:block absolute top-7 left-[12.5%] right-[12.5%] h-0.5 bg-slate-100 z-0" />

              {/* Step 1 */}
              <div className="flex flex-col items-center text-center relative z-10 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 border border-brand-100 shadow-sm transition group-hover:scale-105 group-hover:bg-brand-600 group-hover:text-white duration-300">
                  <Edit size={20} />
                </div>
                <span className="mt-3 text-xs sm:text-sm font-bold text-ink">
                  Tulis Laporan
                </span>
                <span className="mt-1 text-[11px] text-muted leading-relaxed">
                  Kirim detail kerusakan jalan dengan foto bukti yang jelas.
                </span>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center relative z-10 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-warning border border-amber-100 shadow-sm transition group-hover:scale-105 group-hover:bg-warning group-hover:text-white duration-300">
                  <FileText size={20} />
                </div>
                <span className="mt-3 text-xs sm:text-sm font-bold text-ink">
                  Proses Verifikasi
                </span>
                <span className="mt-1 text-[11px] text-muted leading-relaxed">
                  Sistem AI menganalisis lubang jalan secara otomatis.
                </span>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center relative z-10 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-success border border-emerald-100 shadow-sm transition group-hover:scale-105 group-hover:bg-success group-hover:text-white duration-300">
                  <Send size={20} />
                </div>
                <span className="mt-3 text-xs sm:text-sm font-bold text-ink">
                  Tindak Lanjut
                </span>
                <span className="mt-1 text-[11px] text-muted leading-relaxed">
                  Staf ME dijadwalkan langsung ke lapangan.
                </span>
              </div>

              {/* Step 4 */}
              <div className="flex flex-col items-center text-center relative z-10 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-brand-700 border border-indigo-100 shadow-sm transition group-hover:scale-105 group-hover:bg-brand-700 group-hover:text-white duration-300">
                  <CheckCircle2 size={20} />
                </div>
                <span className="mt-3 text-xs sm:text-sm font-bold text-ink">
                  Selesai
                </span>
                <span className="mt-1 text-[11px] text-muted leading-relaxed">
                  Jalan selesai diperbaiki demi keamanan berkendara.
                </span>
              </div>
            </div>
          </div>

          {/* Statistics Block */}
          <div className="mt-12 rounded-2xl bg-gradient-to-br from-brand-900 to-brand-700 text-white p-8 text-center shadow-soft relative overflow-hidden">
            <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_bottom_right,#ffffff_0%,transparent_50%)] pointer-events-none" />
            <div className="relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-200">
                Jumlah Laporan Saat Ini
              </p>
              <h4 className="mt-2 text-4xl sm:text-5xl font-black tracking-tight text-white animate-pulse">
                {stats ? stats.total_reports.toLocaleString("id-ID") : "..."}
              </h4>
              <p className="mt-2 text-xs text-brand-200">
                Laporan diproses dan ditangani secara transparan.
              </p>

              <div className="mt-8 pt-8 border-t border-brand-600/30 grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <span className="block text-2xl font-bold text-white">
                    {stats ? stats.work_areas : "..."}
                  </span>
                  <span className="block text-[10px] font-semibold text-brand-200 mt-1 uppercase tracking-wider">
                    Wilayah Kerja
                  </span>
                </div>
                <div>
                  <span className="block text-2xl font-bold text-white">
                    {stats ? stats.field_staff : "..."}
                  </span>
                  <span className="block text-[10px] font-semibold text-brand-200 mt-1 uppercase tracking-wider">
                    Staf Lapangan
                  </span>
                </div>
                <div>
                  <span className="block text-2xl font-bold text-white">
                    {stats ? stats.armada_teams : "..."}
                  </span>
                  <span className="block text-[10px] font-semibold text-brand-200 mt-1 uppercase tracking-wider">
                    Tim Armada
                  </span>
                </div>
                <div>
                  <span className="block text-2xl font-bold text-white">
                    {stats
                      ? stats.completed_roads.toLocaleString("id-ID")
                      : "..."}
                  </span>
                  <span className="block text-[10px] font-semibold text-brand-200 mt-1 uppercase tracking-wider">
                    Jalan Selesai
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

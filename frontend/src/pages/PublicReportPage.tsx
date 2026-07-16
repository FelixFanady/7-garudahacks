import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Loader2, AlertCircle, CheckCircle2, MapPin } from "lucide-react";
import client from "../api/client";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";

export const PublicReportPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Autocomplete and Maps states
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const navigate = useNavigate();
  const searchTimeoutRef = React.useRef<any>(null);

  // Leaflet Map Refs
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<any>(null);
  const markerInstanceRef = React.useRef<any>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
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
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
      if (!res.ok) throw new Error("Gagal mengambil alamat dari koordinat");
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        const address = formatPhotonFeature(data.features[0]);
        setLocation(address);
      } else {
        setLocation(`Jalan Rusak di koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
      setLocation(`Jalan Rusak di koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
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
      markerInstanceRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapInstanceRef.current);
      
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
        const res = await fetch(`https://photon.komoot.io/api?q=${encodeURIComponent(val)}&limit=5&countrycode=id`);
        if (!res.ok) throw new Error("Gagal mengambil data lokasi");
        const data = await res.json();
        
        const items = (data.features || []).map((feature: any) => {
          const coords = feature.geometry.coordinates; // [lon, lat]
          return {
            display_name: formatPhotonFeature(feature),
            lat: coords[1],
            lon: coords[0]
          };
        });
        
        setSuggestions(items || []);
      } catch (err) {
        console.error("Autocompletion failed:", err);
        setSearchError("Gagal menghubungi server peta. Silakan ketik manual atau klik langsung pada peta.");
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
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: true
    }).setView([defaultLat, defaultLng], 12);
    
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
      if (dropdown && !dropdown.contains(e.target as Node) && input && !input.contains(e.target as Node)) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!photo) {
      setError("Silakan unggah foto bukti jalan berlubang/rusak.");
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append("reporter_name", name);
    formData.append("reporter_email", email);
    formData.append("location", location);
    formData.append("description", description);
    formData.append("photo", photo);

    try {
      await client.post("/lapor", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccess("Laporan Anda berhasil dikirim! Silakan periksa email Anda untuk tanda terima laporan.");
      setName("");
      setEmail("");
      setLocation("");
      setDescription("");
      setPhoto(null);
      setPhotoPreview(null);
      
      // Auto redirect back to home page after 4 seconds
      setTimeout(() => {
        navigate("/");
      }, 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Gagal mengirim laporan. Pastikan koneksi server aktif.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <SiteHeader />

      <main className="flex-1 px-5 py-12 text-ink">
        <div className="mx-auto max-w-2xl">
          {/* Back Link */}
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 mb-6">
            <ArrowLeft size={16} />
            Kembali ke Beranda
          </Link>

          {/* Title Block */}
          <div className="rounded-2xl border border-line bg-white p-8 shadow-sm mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-danger mb-4">
              <AlertCircle size={24} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">
              Laporkan Jalan Berlubang
            </h1>
            <p className="mt-2 text-sm text-muted">
              Bantu kami memetakan jalan rusak untuk segera diperbaiki demi keselamatan bersama. Isi formulir laporan publik di bawah ini secara lengkap.
            </p>
          </div>

          {/* Form Block */}
          <div className="rounded-2xl border border-line bg-white p-8 shadow-sm">
            {success && (
              <div className="mb-6 flex items-start gap-2 rounded-lg bg-emerald-50 p-4 text-sm text-success ring-1 ring-emerald-100">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <p>{success}</p>
              </div>
            )}

            {error && (
              <div className="mb-6 flex items-start gap-2 rounded-lg bg-red-50 p-4 text-sm text-danger ring-1 ring-red-100">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-ink">
                    Nama Pelapor <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama Lengkap"
                    required
                    className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink">
                    Email Pelapor <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alamat@email.com"
                    required
                    className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink">
                  Lokasi Jalan Rusak <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative mt-2" id="search-container">
                  <MapPin size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted animate-bounce" />
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
                          <Loader2 size={16} className="animate-spin text-brand-600" />
                          <span>Mencari lokasi di Indonesia...</span>
                        </div>
                      )}
                      
                      {searchError && (
                        <div className="px-4 py-3 text-xs text-danger bg-red-50/50">
                          {searchError}
                        </div>
                      )}

                      {!isSearching && suggestions.length === 0 && !searchError && (
                        <div className="px-4 py-3 text-muted">
                          Lokasi tidak ditemukan di Indonesia. Coba kata kunci lain atau klik langsung pada peta.
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
                              updateMapPosition(lat, lng);
                            }
                          }}
                          className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition text-left flex items-start gap-2"
                          title={item.display_name}
                        >
                          <MapPin size={16} className="text-muted shrink-0 mt-0.5" />
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
                  <div className="absolute top-3 right-3 z-20 bg-white/90 backdrop-blur border border-line rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm pointer-events-none flex items-center gap-1.5">
                    <MapPin size={12} className="text-brand-600" />
                    <span>Scroll untuk zoom | Klik peta untuk set lokasi</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink">
                  Deskripsi Detail Laporan <span className="text-red-500 font-bold">*</span>
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
                <label className="block text-sm font-medium text-ink">
                  Foto Bukti Jalan Rusak <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="mt-2 flex flex-col items-center justify-center border-2 border-dashed border-line rounded-lg p-6 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer relative min-h-[160px]">
                  {photoPreview ? (
                    <div className="relative w-full flex justify-center">
                      <img src={photoPreview} alt="Preview" className="max-h-48 object-contain rounded-lg" />
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
                      <Camera className="text-muted mb-2" size={28} />
                      <span className="text-sm font-medium text-ink">Pilih File Foto</span>
                      <span className="text-xs text-muted mt-1">PNG, JPG atau JPEG</span>
                      <input
                        type="file"
                        accept="image/*"
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
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:opacity-75"
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
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

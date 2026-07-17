import React, { useState, useEffect, useRef } from "react";
import { 
  MapPin, 
  Navigation, 
  Route, 
  Loader2, 
  Search, 
  AlertTriangle, 
  Flag, 
  TrendingUp, 
  Check, 
  X,
  Sparkles,
  Info
} from "lucide-react";
import client from "../api/client";

interface Coordinate {
  lat: number;
  lon: number;
  name: string;
}

interface Pothole {
  id: number;
  uid: string;
  location: string;
  latitude: number;
  longitude: number;
  description: string;
  source: "CITIZEN" | "SYSTEM";
  status: "MENUNGGU_VERIFIKASI" | "DIJADWALKAN" | "SELESAI";
  photo?: string;
  created_at: string;
}

interface RouteOption {
  index: number;
  distance: number; // in meters
  duration: number; // in seconds
  geometry: any;
  potholes: Pothole[];
  avoidedCount: number;
}

export const MapRoutingPreview = () => {
  // Inputs
  const [startQuery, setStartQuery] = useState("");
  const [startCoords, setStartCoords] = useState<Coordinate | null>(null);
  const [startSuggestions, setStartSuggestions] = useState<Coordinate[]>([]);
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  
  const [endQuery, setEndQuery] = useState("");
  const [endCoords, setEndCoords] = useState<Coordinate | null>(null);
  const [endSuggestions, setEndSuggestions] = useState<Coordinate[]>([]);
  const [showEndSuggestions, setShowEndSuggestions] = useState(false);

  // States
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isSearchingStart, setIsSearchingStart] = useState(false);
  const [isSearchingEnd, setIsSearchingEnd] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Timeouts
  const startTimeoutRef = useRef<any>(null);
  const endTimeoutRef = useRef<any>(null);

  // Leaflet Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const endMarkerRef = useRef<any>(null);
  const potholeMarkersRef = useRef<any[]>([]);
  const routeLayersRef = useRef<any[]>([]);

  // Helper: format Photon result
  const formatPhotonFeature = (feature: any) => {
    const p = feature.properties || {};
    const parts: string[] = [];
    if (p.name) parts.push(p.name);
    if (p.street && p.street !== p.name) parts.push(p.street);
    const city = p.city || p.town || p.village || p.suburb;
    if (city) parts.push(city);
    return parts.length > 0 ? parts.join(", ") : "Lokasi tidak bernama";
  };

  // Helper: calculate distance to line segment (flat earth approx)
  const getDistanceToSegment = (lat: number, lon: number, lat1: number, lon1: number, lat2: number, lon2: number) => {
    const x = lon;
    const y = lat;
    const x1 = lon1;
    const y1 = lat1;
    const x2 = lon2;
    const y2 = lat2;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    let nx = x1;
    let ny = y1;

    if (lenSq > 0) {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
      nx = x1 + t * dx;
      ny = y1 + t * dy;
    }

    const latMid = (y + ny) / 2;
    const dLat = (y - ny) * 111139;
    const dLon = (x - nx) * 111139 * Math.cos(latMid * Math.PI / 180);
    
    return Math.sqrt(dLat * dLat + dLon * dLon);
  };

  // Fetch potholes from DB
  const fetchPotholes = async () => {
    try {
      const res = await client.get("/public/reports");
      const list: Pothole[] = res.data || [];
      const validPotholes = list.filter(p => p.latitude && p.longitude && p.status !== "SELESAI");
      setPotholes(validPotholes);
    } catch (err) {
      console.error("Gagal memuat titik kerusakan jalan:", err);
      setPotholes([]);
    }
  };

  // Autocomplete handlers
  const handleStartSearch = (val: string) => {
    setStartQuery(val);
    if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
    if (val.length < 3) {
      setStartSuggestions([]);
      return;
    }
    setIsSearchingStart(true);
    setShowStartSuggestions(true);
    startTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api?q=${encodeURIComponent(val)}&limit=5&countrycode=id`);
        if (res.ok) {
          const data = await res.json();
          const items = (data.features || []).map((f: any) => {
            const coords = f.geometry.coordinates;
            return {
              lat: coords[1],
              lon: coords[0],
              name: formatPhotonFeature(f)
            };
          });
          setStartSuggestions(items);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingStart(false);
      }
    }, 600);
  };

  const handleEndSearch = (val: string) => {
    setEndQuery(val);
    if (endTimeoutRef.current) clearTimeout(endTimeoutRef.current);
    if (val.length < 3) {
      setEndSuggestions([]);
      return;
    }
    setIsSearchingEnd(true);
    setShowEndSuggestions(true);
    endTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api?q=${encodeURIComponent(val)}&limit=5&countrycode=id`);
        if (res.ok) {
          const data = await res.json();
          const items = (data.features || []).map((f: any) => {
            const coords = f.geometry.coordinates;
            return {
              lat: coords[1],
              lon: coords[0],
              name: formatPhotonFeature(f)
            };
          });
          setEndSuggestions(items);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingEnd(false);
      }
    }, 600);
  };

  // Route calculation
  const calculateRoute = async () => {
    if (!startCoords || !endCoords) return;
    setIsLoadingRoute(true);
    setRouteError(null);

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startCoords.lon},${startCoords.lat};${endCoords.lon},${endCoords.lat}?overview=full&geometries=geojson&alternatives=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Gagal menghitung rute navigasi dari OSRM.");
      const data = await res.json();

      if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
        throw new Error("Rute jalan tidak ditemukan.");
      }

      const calculatedOptions: RouteOption[] = data.routes.map((route: any, index: number) => {
        const coords = route.geometry.coordinates; // [[lon, lat], ...]
        
        // Find potholes on/near this route option
        const routePotholes = potholes.filter(p => {
          for (let i = 0; i < coords.length - 1; i++) {
            const p1 = coords[i];
            const p2 = coords[i + 1];
            const dist = getDistanceToSegment(p.latitude, p.longitude, p1[1], p1[0], p2[1], p2[0]);
            if (dist <= 50) return true; // 50m threshold
          }
          return false;
        });

        // Avoided count is total potholes minus the ones on this route
        const avoidedCount = Math.max(0, potholes.length - routePotholes.length);

        return {
          index,
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry,
          potholes: routePotholes,
          avoidedCount
        };
      });

      // Sort: place safest route (least potholes) first
      calculatedOptions.sort((a, b) => a.potholes.length - b.potholes.length);

      setRoutes(calculatedOptions);
      setSelectedRouteIndex(0);
    } catch (err: any) {
      console.error(err);
      setRouteError(err.message || "Gagal menghubungkan ke layanan peta OSRM.");
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Initialize Map
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center map on BSD
    const defaultLat = -6.295;
    const defaultLng = 106.648;

    // Reset default markers icons
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: true
    }).setView([defaultLat, defaultLng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    mapInstanceRef.current = map;
    fetchPotholes();

    // Clean up
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update pothole markers on map
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;

    // Clear old pothole markers
    potholeMarkersRef.current.forEach(m => m.remove());
    potholeMarkersRef.current = [];

    // Add new pothole markers
    potholes.forEach(p => {
      const potholeIcon = L.divIcon({
        className: "custom-pothole-icon",
        html: `<div class="w-8 h-8 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center shadow-lg hover:scale-115 transition duration-200">
                 <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                   <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                   <line x1="12" y1="9" x2="12" y2="13"/>
                   <line x1="12" y1="17" x2="12.01" y2="17"/>
                 </svg>
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const photoHtml = p.photo 
        ? `<div class="mt-2 rounded overflow-hidden h-20 bg-slate-100 flex items-center justify-center">
             <img src="data:image/jpeg;base64,${p.photo}" class="w-full h-full object-cover" />
           </div>`
        : "";

      const popupContent = `
        <div class="p-3 max-w-[210px] text-ink font-sans">
          <div class="flex items-center justify-between gap-2 border-b border-line pb-1.5 mb-2">
            <span class="text-[9px] font-mono font-bold bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded">${p.uid}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-amber-50 text-warning">${p.status.replace('_', ' ')}</span>
          </div>
          <h4 class="text-xs font-semibold text-ink leading-tight mb-1">${p.location}</h4>
          <p class="text-[10px] text-muted leading-relaxed">${p.description}</p>
          ${photoHtml}
          <a href="/laporan/transparansi/${p.uid}" class="mt-2.5 block text-center text-[10px] font-semibold text-white bg-brand-600 hover:bg-brand-700 py-1.5 rounded transition" style="color: white !important;">
            Lihat Detail Laporan
          </a>
        </div>
      `;

      const marker = L.marker([p.latitude, p.longitude], { icon: potholeIcon })
        .bindPopup(popupContent)
        .addTo(mapInstanceRef.current);

      potholeMarkersRef.current.push(marker);
    });
  }, [potholes]);

  // Update Route Polylines and A/B Markers
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;

    // Clear old route polylines
    routeLayersRef.current.forEach(layer => layer.remove());
    routeLayersRef.current = [];

    // Clear old A/B markers
    if (startMarkerRef.current) startMarkerRef.current.remove();
    if (endMarkerRef.current) endMarkerRef.current.remove();

    // Create Start Marker
    if (startCoords) {
      const startIcon = L.divIcon({
        className: "custom-start-icon",
        html: `<div class="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center shadow-lg font-bold text-white text-xs">A</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      startMarkerRef.current = L.marker([startCoords.lat, startCoords.lon], { icon: startIcon })
        .bindPopup(`<p class="text-xs font-semibold font-sans p-1">${startCoords.name}</p>`)
        .addTo(mapInstanceRef.current);
    }

    // Create End Marker
    if (endCoords) {
      const endIcon = L.divIcon({
        className: "custom-end-icon",
        html: `<div class="w-8 h-8 rounded-full bg-rose-600 border-2 border-white flex items-center justify-center shadow-lg font-bold text-white text-xs">B</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      endMarkerRef.current = L.marker([endCoords.lat, endCoords.lon], { icon: endIcon })
        .bindPopup(`<p class="text-xs font-semibold font-sans p-1">${endCoords.name}</p>`)
        .addTo(mapInstanceRef.current);
    }

    // Draw Route Polylines
    if (routes.length > 0) {
      const allLatLngs: any[] = [];

      routes.forEach((route, idx) => {
        const isSelected = idx === selectedRouteIndex;
        
        // Convert GeoJSON coords [lon, lat] to Leaflet [lat, lon]
        const latLngs = route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
        allLatLngs.push(...latLngs);

        // Styling
        // Main route is thick Indigo/Blue, alternatives are Slate/Purple
        const polyline = L.polyline(latLngs, {
          color: isSelected ? "#3b82f6" : "#94a3b8",
          weight: isSelected ? 6 : 4,
          opacity: isSelected ? 0.95 : 0.6,
          dashArray: isSelected ? undefined : "5, 5"
        }).addTo(mapInstanceRef.current);

        // Interaction: click on polyline to select
        polyline.on("click", () => {
          setSelectedRouteIndex(idx);
        });

        // Add tooltip info
        polyline.bindTooltip(
          `Rute ${idx + 1}: ${(route.distance / 1000).toFixed(1)} km | ${Math.ceil(route.duration / 60)} mnt | ${route.potholes.length} lubang`,
          { sticky: true }
        );

        routeLayersRef.current.push(polyline);
      });

      // Fit map bounds to show the entire route
      if (allLatLngs.length > 0) {
        const bounds = L.latLngBounds(allLatLngs);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [routes, selectedRouteIndex, startCoords, endCoords]);

  // Click outside to close suggestion dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const startBox = document.getElementById("start-search-box");
      const endBox = document.getElementById("end-search-box");
      if (startBox && !startBox.contains(e.target as Node)) setShowStartSuggestions(false);
      if (endBox && !endBox.contains(e.target as Node)) setShowEndSuggestions(false);
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  // Run route calculation on mount if defaults are loaded
  useEffect(() => {
    if (startCoords && endCoords && potholes.length > 0 && routes.length === 0) {
      calculateRoute();
    }
  }, [startCoords, endCoords, potholes]);

  return (
    <section id="rute" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
          Routing & Navigasi Cerdas
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Peta Navigasi Penghindar Jalan Rusak.
        </h2>
        <p className="mt-2 text-sm text-muted">
          Pilih rute teraman. Algoritma kami menganalisis titik lubang jalan (potholes) dari database dan menyarankan jalur alternatif terbaik.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr] rounded-2xl border border-line bg-white shadow-soft overflow-hidden">
        {/* Control Panel / Sidebar */}
        <div className="p-6 border-b lg:border-b-0 lg:border-r border-line flex flex-col justify-between bg-slate-50/50">
          <div className="space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
              <Sparkles size={16} className="text-brand-600" />
              Perencana Perjalanan
            </h3>

            {/* Input Start */}
            <div className="relative" id="start-search-box">
              <label className="block text-xs font-semibold text-muted mb-1.5 uppercase">Titik Awal (A)</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" />
                <input
                  type="text"
                  value={startQuery}
                  onChange={(e) => handleStartSearch(e.target.value)}
                  onFocus={() => setShowStartSuggestions(true)}
                  placeholder="Ketik asal rute..."
                  className="h-10 w-full pl-9 pr-8 rounded-lg border border-line bg-white text-xs text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                />
                {startQuery && (
                  <button 
                    onClick={() => { setStartQuery(""); setStartCoords(null); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Start Suggestions */}
              {showStartSuggestions && startSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-40 mt-1 max-h-48 overflow-y-auto rounded-lg border border-line bg-white shadow-lg text-xs divide-y divide-line">
                  {startSuggestions.map((item, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setStartCoords(item);
                        setStartQuery(item.name);
                        setShowStartSuggestions(false);
                      }}
                      className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition truncate flex items-center gap-2 text-left"
                    >
                      <MapPin size={12} className="text-muted shrink-0" />
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input Destination */}
            <div className="relative" id="end-search-box">
              <label className="block text-xs font-semibold text-muted mb-1.5 uppercase">Titik Tujuan (B)</label>
              <div className="relative">
                <Flag size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-600" />
                <input
                  type="text"
                  value={endQuery}
                  onChange={(e) => handleEndSearch(e.target.value)}
                  onFocus={() => setShowEndSuggestions(true)}
                  placeholder="Ketik tujuan rute..."
                  className="h-10 w-full pl-9 pr-8 rounded-lg border border-line bg-white text-xs text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                />
                {endQuery && (
                  <button 
                    onClick={() => { setEndQuery(""); setEndCoords(null); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* End Suggestions */}
              {showEndSuggestions && endSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-40 mt-1 max-h-48 overflow-y-auto rounded-lg border border-line bg-white shadow-lg text-xs divide-y divide-line">
                  {endSuggestions.map((item, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setEndCoords(item);
                        setEndQuery(item.name);
                        setShowEndSuggestions(false);
                      }}
                      className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition truncate flex items-center gap-2 text-left"
                    >
                      <MapPin size={12} className="text-muted shrink-0" />
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={calculateRoute}
              disabled={!startCoords || !endCoords || isLoadingRoute}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {isLoadingRoute ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Navigation size={14} />
              )}
              {isLoadingRoute ? "Menghitung Rute..." : "Hitung Rute Teraman"}
            </button>

            {routeError && (
              <div className="rounded-lg bg-red-50 p-3 text-[11px] text-danger border border-red-100 flex items-start gap-1.5">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <p>{routeError}</p>
              </div>
            )}
          </div>

          {/* Route Options Listing */}
          <div className="mt-6 pt-5 border-t border-line space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Pilihan Rute Alternatif
            </p>

            {routes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-muted flex flex-col items-center justify-center gap-1.5 bg-white">
                <Info size={16} className="text-muted/70" />
                <p>Masukkan asal & tujuan, lalu klik Hitung Rute.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {routes.map((route, i) => {
                  const isSelected = i === selectedRouteIndex;
                  const isSafest = i === 0; // Sorted: 0 is safest
                  const hasPotholes = route.potholes.length > 0;
                  
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedRouteIndex(i)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer text-left flex flex-col justify-between gap-1.5 ${
                        isSelected 
                          ? "border-brand-500 bg-brand-50/50 shadow-sm"
                          : "border-line bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-ink">
                          Rute Alternatif {i + 1}
                        </span>
                        {isSafest && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-100 flex items-center gap-0.5">
                            <Check size={8} /> Rekomendasi Teraman
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted">
                        <div>
                          <span className="font-semibold text-ink">{(route.distance / 1000).toFixed(1)} km</span>
                          <span className="mx-1.5">•</span>
                          <span className="font-semibold text-ink">{Math.ceil(route.duration / 60)} mnt</span>
                        </div>
                        
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          hasPotholes 
                            ? "bg-red-50 text-danger" 
                            : "bg-emerald-50 text-success"
                        }`}>
                          {hasPotholes ? `${route.potholes.length} Lubang` : "Aman (0 lubang)"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Map Container */}
        <div className="relative min-h-[480px] bg-slate-50 overflow-hidden">
          <div ref={mapContainerRef} className="h-full w-full z-10" />

          {/* Floating Instructions */}
          <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur border border-line rounded-lg px-3.5 py-2 text-[10px] font-semibold text-brand-700 shadow-sm pointer-events-none flex flex-col gap-1">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              A: Titik Awal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              B: Titik Tujuan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-900 flex items-center justify-center text-[6px] text-danger border border-white">!</span>
              Tanda Seru: Lubang Kerusakan Jalan
            </span>
          </div>

          {/* Selected Route Info Box Overlay */}
          {routes.length > 0 && (
            <div className="absolute bottom-5 left-5 right-5 z-20 flex flex-col gap-2 rounded-xl border border-line bg-white/92 p-4 shadow-lg backdrop-blur md:left-auto md:w-80 font-sans">
              <div className="flex items-center gap-2">
                <Route size={16} className="text-brand-600" />
                <p className="text-xs font-bold text-ink uppercase tracking-wider">
                  Rute Terpilih (Alternatif {selectedRouteIndex + 1})
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs border-t border-line/60 pt-2.5 mt-1">
                <div>
                  <p className="font-bold text-ink text-sm">
                    {(routes[selectedRouteIndex].distance / 1000).toFixed(1)} km
                  </p>
                  <p className="text-[10px] text-muted">Jarak Tempuh</p>
                </div>
                <div>
                  <p className="font-bold text-ink text-sm">
                    {Math.ceil(routes[selectedRouteIndex].duration / 60)} mnt
                  </p>
                  <p className="text-[10px] text-muted">Durasi Perjalanan</p>
                </div>
                <div>
                  <p className={`font-bold text-sm ${
                    routes[selectedRouteIndex].potholes.length > 0 ? "text-danger" : "text-emerald-600"
                  }`}>
                    {routes[selectedRouteIndex].potholes.length} Lubang
                  </p>
                  <p className="text-[10px] text-muted">Dilewati</p>
                </div>
              </div>

              {routes[selectedRouteIndex].potholes.length > 0 && (
                <div className="mt-1 bg-amber-50 text-warning text-[10px] p-2 rounded-lg border border-amber-100/50 flex items-start gap-1">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <p>Hati-hati! Terdapat {routes[selectedRouteIndex].potholes.length} lubang jalan di jalur ini. Kurangi kecepatan saat berkendara.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

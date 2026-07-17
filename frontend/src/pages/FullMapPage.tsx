import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  MapPin, 
  Navigation, 
  Route, 
  Loader2, 
  Search, 
  AlertTriangle, 
  Flag, 
  X, 
  ArrowLeft, 
  ArrowUpDown, 
  Check, 
  Car,
  Home,
  Menu,
  ChevronRight,
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
  distance: number;
  duration: number;
  geometry: any;
  potholes: Pothole[];
  avoidedCount: number;
}

export const FullMapPage = () => {
  const navigate = useNavigate();

  const [isDirectionsMode, setIsDirectionsMode] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<Coordinate[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  const [startQuery, setStartQuery] = useState("");
  const [startCoords, setStartCoords] = useState<Coordinate | null>(null);
  const [startSuggestions, setStartSuggestions] = useState<Coordinate[]>([]);
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [isSearchingStart, setIsSearchingStart] = useState(false);

  const [endQuery, setEndQuery] = useState("");
  const [endCoords, setEndCoords] = useState<Coordinate | null>(null);
  const [endSuggestions, setEndSuggestions] = useState<Coordinate[]>([]);
  const [showEndSuggestions, setShowEndSuggestions] = useState(false);
  const [isSearchingEnd, setIsSearchingEnd] = useState(false);

  const [selectedSearchPlace, setSelectedSearchPlace] = useState<Coordinate | null>(null);

  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const searchTimeoutRef = useRef<any>(null);
  const startTimeoutRef = useRef<any>(null);
  const endTimeoutRef = useRef<any>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const endMarkerRef = useRef<any>(null);
  const potholeMarkersRef = useRef<any[]>([]);
  const routeLayersRef = useRef<any[]>([]);

  const formatPhotonFeature = (feature: any) => {
    const p = feature.properties || {};
    const parts: string[] = [];
    if (p.name) parts.push(p.name);
    if (p.street && p.street !== p.name) parts.push(p.street);
    const city = p.city || p.town || p.village || p.suburb;
    if (city) parts.push(city);
    return parts.length > 0 ? parts.join(", ") : "Lokasi tidak bernama";
  };

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

  const fetchPotholes = async () => {
    try {
      const res = await client.get("/public/reports");
      const list: Pothole[] = res.data || [];
      const valid = list.filter(p => p.latitude && p.longitude && p.status !== "SELESAI");
      setPotholes(valid);
    } catch (err) {
      console.error(err);
      setPotholes([]);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (val.length < 3) {
      setSearchSuggestions([]);
      return;
    }
    setIsSearchingLocation(true);
    setShowSearchSuggestions(true);
    searchTimeoutRef.current = setTimeout(async () => {
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
          setSearchSuggestions(items);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 600);
  };

  const handleStartChange = (val: string) => {
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

  const handleEndChange = (val: string) => {
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

  const handleSwapPoints = () => {
    const tempQ = startQuery;
    const tempC = startCoords;
    setStartQuery(endQuery);
    setStartCoords(endCoords);
    setEndQuery(tempQ);
    setEndCoords(tempC);
  };

  const calculateRoute = async () => {
    if (!startCoords || !endCoords) return;
    setIsLoadingRoute(true);
    setRouteError(null);

    try {
      const primaryUrl = `https://router.project-osrm.org/route/v1/driving/${startCoords.lon},${startCoords.lat};${endCoords.lon},${endCoords.lat}?overview=full&geometries=geojson&alternatives=true`;
      const primaryRes = await fetch(primaryUrl);
      if (!primaryRes.ok)
        throw new Error("Gagal menghitung rute dari server OSRM.");
      const primaryData = await primaryRes.json();

      if (
        primaryData.code !== "Ok" ||
        !primaryData.routes ||
        primaryData.routes.length === 0
      ) {
        throw new Error("Rute navigasi tidak ditemukan.");
      }

      let calculatedOptions: RouteOption[] = primaryData.routes.map(
        (route: any, index: number) => {
          const coords = route.geometry.coordinates;

          const routePotholes = potholes.filter((p) => {
            for (let i = 0; i < coords.length - 1; i++) {
              const p1 = coords[i];
              const p2 = coords[i + 1];
              const dist = getDistanceToSegment(
                p.latitude,
                p.longitude,
                p1[1],
                p1[0],
                p2[1],
                p2[0],
              );
              if (dist <= 50) return true;
            }
            return false;
          });

          const avoidedCount = Math.max(
            0,
            potholes.length - routePotholes.length,
          );

          return {
            index,
            distance: route.distance,
            duration: route.duration,
            geometry: route.geometry,
            potholes: routePotholes,
            avoidedCount,
          };
        },
      );

      calculatedOptions.sort((a, b) => a.potholes.length - b.potholes.length);

      const bestRoute = calculatedOptions[0];
      if (bestRoute && bestRoute.potholes.length > 0) {
        const detourCandidates: { lat: number; lon: number }[] = [];

        const pothole = bestRoute.potholes[0];
        try {
          const nearestUrl = `https://router.project-osrm.org/nearest/v1/driving/${pothole.longitude},${pothole.latitude}?number=5`;
          const nearestRes = await fetch(nearestUrl);
          if (nearestRes.ok) {
            const nearestData = await nearestRes.json();
            if (nearestData.code === "Ok" && nearestData.waypoints) {
              nearestData.waypoints.forEach((wp: any) => {
                if (wp.distance >= 40 && wp.distance <= 500) {
                  detourCandidates.push({
                    lat: wp.location[1],
                    lon: wp.location[0]
                  });
                }
              });
            }
          }
        } catch (err) {
          console.error(err);
        }

        const coords = bestRoute.geometry.coordinates;
        let minSegIndex = 0;
        let minDistance = Infinity;

        for (let i = 0; i < coords.length - 1; i++) {
          const p1 = coords[i];
          const p2 = coords[i + 1];
          const dist = getDistanceToSegment(
            pothole.latitude,
            pothole.longitude,
            p1[1],
            p1[0],
            p2[1],
            p2[0],
          );
          if (dist < minDistance) {
            minDistance = dist;
            minSegIndex = i;
          }
        }

        const p1 = coords[minSegIndex];
        const p2 = coords[minSegIndex + 1];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length > 0) {
          const scale = 0.0027;
          const perpX = (-dy / length) * scale;
          const perpY = (dx / length) * scale;
          detourCandidates.push({ lat: pothole.latitude + perpY, lon: pothole.longitude - perpX });
          detourCandidates.push({ lat: pothole.latitude - perpY, lon: pothole.longitude + perpX });
        }

        const latMid = (startCoords.lat + endCoords.lat) / 2;
        const lonMid = (startCoords.lon + endCoords.lon) / 2;
        const lineDx = endCoords.lon - startCoords.lon;
        const lineDy = endCoords.lat - startCoords.lat;
        const lineLength = Math.sqrt(lineDx * lineDx + lineDy * lineDy);

        if (lineLength > 0) {
          const perpLineX = -lineDy / lineLength;
          const perpLineY = lineDx / lineLength;

          detourCandidates.push({ lat: latMid + perpLineY * 0.005, lon: lonMid - perpLineX * 0.005 });
          detourCandidates.push({ lat: latMid - perpLineY * 0.005, lon: lonMid + perpLineX * 0.005 });
          detourCandidates.push({ lat: latMid + perpLineY * 0.009, lon: lonMid - perpLineX * 0.009 });
          detourCandidates.push({ lat: latMid - perpLineY * 0.009, lon: lonMid + perpLineX * 0.009 });
        }

        const uniqueCandidates: { lat: number; lon: number }[] = [];
        detourCandidates.forEach(cand => {
          const duplicate = uniqueCandidates.some(u => 
            Math.abs(u.lat - cand.lat) < 0.0009 && Math.abs(u.lon - cand.lon) < 0.0009
          );
          if (!duplicate) {
            uniqueCandidates.push(cand);
          }
        });

        for (let c = 0; c < uniqueCandidates.length; c++) {
          const candidate = uniqueCandidates[c];
          try {
            const detourUrl = `https://router.project-osrm.org/route/v1/driving/${startCoords.lon},${startCoords.lat};${candidate.lon},${candidate.lat};${endCoords.lon},${endCoords.lat}?overview=full&geometries=geojson`;
            const detourRes = await fetch(detourUrl);
            if (detourRes.ok) {
              const detourData = await detourRes.json();
              if (
                detourData.code === "Ok" &&
                detourData.routes &&
                detourData.routes.length > 0
              ) {
                const detourRoute = detourData.routes[0];
                const detourCoords = detourRoute.geometry.coordinates;

                const detourPotholes = potholes.filter((p) => {
                  for (let i = 0; i < detourCoords.length - 1; i++) {
                    const dp1 = detourCoords[i];
                    const dp2 = detourCoords[i + 1];
                    const dist = getDistanceToSegment(
                      p.latitude,
                      p.longitude,
                      dp1[1],
                      dp1[0],
                      dp2[1],
                      dp2[0],
                    );
                    if (dist <= 50) return true;
                  }
                  return false;
                });

                if (detourPotholes.length < bestRoute.potholes.length) {
                  const isDuplicate = calculatedOptions.some(opt => 
                    Math.abs(opt.distance - detourRoute.distance) < 150 && 
                    opt.potholes.length === detourPotholes.length
                  );

                  if (!isDuplicate) {
                    calculatedOptions.push({
                      index: calculatedOptions.length,
                      distance: detourRoute.distance,
                      duration: detourRoute.duration,
                      geometry: detourRoute.geometry,
                      potholes: detourPotholes,
                      avoidedCount: Math.max(
                        0,
                        potholes.length - detourPotholes.length,
                      ),
                    });
                  }
                }
              }
            }
          } catch (err) {
            console.error(err);
          }
        }
      }

      calculatedOptions.sort((a, b) => a.potholes.length - b.potholes.length);
      calculatedOptions = calculatedOptions.map((opt, idx) => ({ ...opt, index: idx }));

      setRoutes(calculatedOptions);
      setSelectedRouteIndex(0);
    } catch (err: any) {
      console.error(err);
      setRouteError(err.message || "Gagal menghubungkan ke OSRM routing server.");
    } finally {
      setIsLoadingRoute(false);
    }
  };

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false 
    }).setView([-6.295, 106.648], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapInstanceRef.current = map;
    fetchPotholes();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;

    potholeMarkersRef.current.forEach(m => m.remove());
    potholeMarkersRef.current = [];

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
          <a href="/laporan/transparansi/${p.uid}" class="mt-2.5 block text-center text-[10px] font-semibold text-white bg-brand-600 hover:bg-brand-700 py-1.5 rounded transition">
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

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;

    routeLayersRef.current.forEach(layer => layer.remove());
    routeLayersRef.current = [];

    if (startMarkerRef.current) startMarkerRef.current.remove();
    if (endMarkerRef.current) endMarkerRef.current.remove();

    if (!isDirectionsMode) return;

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

    if (routes.length > 0) {
      const allLatLngs: any[] = [];

      routes.forEach((route, idx) => {
        const isSelected = idx === selectedRouteIndex;
        const latLngs = route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
        allLatLngs.push(...latLngs);

        const polyline = L.polyline(latLngs, {
          color: isSelected ? "#1a73e8" : "#9ca3af", 
          weight: isSelected ? 6 : 4,
          opacity: isSelected ? 0.95 : 0.6,
          dashArray: isSelected ? undefined : "5, 5"
        }).addTo(mapInstanceRef.current);

        polyline.on("click", () => {
          setSelectedRouteIndex(idx);
        });

        polyline.bindTooltip(
          `Rute ${idx + 1}: ${(route.distance / 1000).toFixed(1)} km | ${Math.ceil(route.duration / 60)} mnt | ${route.potholes.length} lubang`,
          { sticky: true }
        );

        routeLayersRef.current.push(polyline);
      });

      if (allLatLngs.length > 0) {
        const bounds = L.latLngBounds(allLatLngs);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 100] });
      }
    }
  }, [routes, selectedRouteIndex, startCoords, endCoords, isDirectionsMode]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;
    if (searchMarkerRef.current) searchMarkerRef.current.remove();
  }, [searchQuery, showSearchSuggestions, isDirectionsMode]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const searchBox = document.getElementById("main-search-container");
      const startBox = document.getElementById("start-input-container");
      const endBox = document.getElementById("end-input-container");
      if (searchBox && !searchBox.contains(e.target as Node)) setShowSearchSuggestions(false);
      if (startBox && !startBox.contains(e.target as Node)) setShowStartSuggestions(false);
      if (endBox && !endBox.contains(e.target as Node)) setShowEndSuggestions(false);
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isDirectionsMode && startCoords && endCoords) {
      calculateRoute();
    }
  }, [isDirectionsMode, startCoords, endCoords]);

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-slate-100 flex flex-col font-sans">
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full z-10" />

      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        <Link 
          to="/"
          className="h-10 px-4 rounded-xl bg-white border border-line shadow-md hover:bg-slate-50 transition text-xs font-semibold text-ink flex items-center gap-2"
        >
          <Home size={14} className="text-brand-600" />
          Beranda
        </Link>
        <Link 
          to="/lapor"
          className="h-10 px-4 rounded-xl bg-brand-600 shadow-md hover:bg-brand-700 transition text-xs font-semibold text-white flex items-center gap-2"
        >
          <MapPin size={14} />
          Laporkan Jalan
        </Link>
      </div>

      <div className="absolute top-4 left-4 z-20 w-full max-w-[390px] flex flex-col gap-3 pointer-events-none">
        
        {!isDirectionsMode && (
          <div 
            id="main-search-container"
            className="w-full bg-white rounded-2xl shadow-lg border border-line p-1 flex flex-col pointer-events-auto"
          >
            <div className="h-12 flex items-center px-3 gap-2">
              <Menu size={18} className="text-muted shrink-0 cursor-pointer hover:text-ink transition" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => setShowSearchSuggestions(true)}
                placeholder="Cari lokasi di Peta Jalan..."
                className="flex-1 h-full outline-none text-sm text-ink bg-transparent"
              />
              {searchQuery && (
                <button 
                  onClick={() => { setSearchQuery(""); setSearchSuggestions([]); }}
                  className="p-1.5 text-muted hover:text-ink"
                >
                  <X size={15} />
                </button>
              )}
              
              <div className="h-6 w-[1px] bg-line mx-1" />
              
              <button
                onClick={() => {
                  if (selectedSearchPlace) {
                    setEndQuery(selectedSearchPlace.name);
                    setEndCoords(selectedSearchPlace);
                    setStartQuery("");
                    setStartCoords(null);
                  } else {
                    setStartQuery("");
                    setStartCoords(null);
                    setEndQuery("");
                    setEndCoords(null);
                  }
                  setIsDirectionsMode(true);
                }}
                title="Petunjuk Arah"
                className="h-9 w-9 rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100 flex items-center justify-center transition shrink-0"
              >
                <Navigation size={18} className="fill-brand-600 rotate-45" />
              </button>
            </div>

            {showSearchSuggestions && searchSuggestions.length > 0 && (
              <div className="border-t border-line divide-y divide-line max-h-60 overflow-y-auto">
                {searchSuggestions.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSearchQuery(item.name);
                      setSelectedSearchPlace(item);
                      setShowSearchSuggestions(false);
                      setSearchSuggestions([]);
                      const L = (window as any).L;
                      if (mapInstanceRef.current && L) {
                        mapInstanceRef.current.setView([item.lat, item.lon], 16);
                        
                        if (searchMarkerRef.current) searchMarkerRef.current.remove();
                        
                        const searchIcon = L.divIcon({
                          className: "custom-search-icon",
                          html: `<div class="w-8 h-8 rounded-full bg-brand-600 border-2 border-white flex items-center justify-center shadow-lg transform scale-110">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 4 4 8-8"/></svg>
                                 </div>`,
                          iconSize: [32, 32],
                          iconAnchor: [16, 16]
                        });
                        
                        searchMarkerRef.current = L.marker([item.lat, item.lon], { icon: searchIcon })
                          .bindPopup(`<p class="text-xs font-semibold font-sans p-1">${item.name}</p>`)
                          .addTo(mapInstanceRef.current)
                          .openPopup();
                      }
                    }}
                    className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition truncate flex items-center gap-2.5 text-xs text-ink"
                  >
                    <MapPin size={14} className="text-muted shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            )}
            
            {showSearchSuggestions && isSearchingLocation && searchSuggestions.length === 0 && (
              <div className="border-t border-line px-4 py-3 text-xs text-muted flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-brand-600" />
                Mencari alamat...
              </div>
            )}
          </div>
        )}

        {isDirectionsMode && (
          <div className="w-full flex flex-col gap-3">
            <div className="w-full bg-white rounded-2xl shadow-lg border border-line p-4 flex flex-col gap-3 pointer-events-auto relative">
              
              <div className="flex items-center justify-between pb-1 border-b border-line/60">
                <div className="flex items-center gap-2 text-xs font-bold text-ink uppercase tracking-wider">
                  <Car size={16} className="text-brand-600" />
                  Petunjuk Arah Berkendara
                </div>
                <button
                  onClick={() => {
                    setIsDirectionsMode(false);
                    setRoutes([]);
                    if (searchMarkerRef.current) searchMarkerRef.current.remove();
                  }}
                  className="p-1 rounded-full hover:bg-slate-100 text-muted hover:text-ink transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex gap-2 items-center">
                <div className="flex flex-col items-center gap-1 shrink-0 py-1">
                  <span className="h-3.5 w-3.5 rounded-full bg-emerald-600 border border-white shadow-sm flex items-center justify-center text-[7px] text-white font-bold">A</span>
                  <div className="w-[1.5px] h-6 bg-slate-300 border-dashed" />
                  <span className="h-3.5 w-3.5 rounded-full bg-rose-600 border border-white shadow-sm flex items-center justify-center text-[7px] text-white font-bold">B</span>
                </div>

                <div className="flex-1 flex flex-col gap-2">
                  <div className="relative" id="start-input-container">
                    <input
                      type="text"
                      value={startQuery}
                      onChange={(e) => handleStartChange(e.target.value)}
                      onFocus={() => setShowStartSuggestions(true)}
                      placeholder="Pilih lokasi awal..."
                      className="h-9 w-full pl-3 pr-8 rounded-lg border border-line bg-slate-50 text-xs text-ink outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100"
                    />
                    {startQuery && (
                      <button 
                        onClick={() => { setStartQuery(""); setStartCoords(null); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1"
                      >
                        <X size={12} />
                      </button>
                    )}
                    
                    {showStartSuggestions && startSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border border-line bg-white shadow-lg text-xs divide-y divide-line">
                        {startSuggestions.map((item, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              setStartCoords(item);
                              setStartQuery(item.name);
                              setShowStartSuggestions(false);
                            }}
                            className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer transition truncate flex items-center gap-2"
                          >
                            <MapPin size={12} className="text-muted shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative" id="end-input-container">
                    <input
                      type="text"
                      value={endQuery}
                      onChange={(e) => handleEndChange(e.target.value)}
                      onFocus={() => setShowEndSuggestions(true)}
                      placeholder="Pilih tujuan..."
                      className="h-9 w-full pl-3 pr-8 rounded-lg border border-line bg-slate-50 text-xs text-ink outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100"
                    />
                    {endQuery && (
                      <button 
                        onClick={() => { setEndQuery(""); setEndCoords(null); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1"
                      >
                        <X size={12} />
                      </button>
                    )}

                    {showEndSuggestions && endSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border border-line bg-white shadow-lg text-xs divide-y divide-line">
                        {endSuggestions.map((item, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              setEndCoords(item);
                              setEndQuery(item.name);
                              setShowEndSuggestions(false);
                            }}
                            className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer transition truncate flex items-center gap-2"
                          >
                            <MapPin size={12} className="text-muted shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleSwapPoints}
                  title="Tukar Awal dan Tujuan"
                  className="h-9 w-9 rounded-lg border border-line hover:bg-slate-50 flex items-center justify-center transition text-muted hover:text-ink shrink-0"
                >
                  <ArrowUpDown size={16} />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={calculateRoute}
                  disabled={!startCoords || !endCoords || isLoadingRoute}
                  className="flex-1 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-600 text-xs font-semibold text-white hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {isLoadingRoute ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Navigation size={12} className="rotate-45" />
                  )}
                  {isLoadingRoute ? "Menghitung Rute..." : "Hitung Rute Teraman"}
                </button>
              </div>

              {routeError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-[10px] text-danger border border-red-100 flex items-start gap-1">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <p>{routeError}</p>
                </div>
              )}
            </div>

            {routes.length > 0 && (
              <div className="w-full bg-white rounded-2xl shadow-lg border border-line p-4 flex flex-col gap-2.5 pointer-events-auto">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted flex justify-between items-center">
                  <span>Alternatif Rute Terdeteksi</span>
                  <span className="text-[9px] lowercase bg-slate-100 text-muted px-1.5 py-0.5 rounded">
                    urut teraman
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {routes.map((route, i) => {
                    const isSelected = i === selectedRouteIndex;
                    const isSafest = i === 0;
                    const hasPotholes = route.potholes.length > 0;

                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedRouteIndex(i)}
                        className={`p-3 rounded-xl border cursor-pointer transition text-left flex flex-col gap-1 ${
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
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-100 flex items-center gap-0.5 shrink-0">
                              <Check size={8} /> Teraman
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-muted">
                          <div>
                            <span className="font-semibold text-ink">{(route.distance / 1000).toFixed(1)} km</span>
                            <span className="mx-1">•</span>
                            <span className="font-semibold text-ink">{Math.ceil(route.duration / 60)} mnt</span>
                          </div>

                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
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
              </div>
            )}
          </div>
        )}
      </div>

      {isDirectionsMode && routes.length > 0 && (
        <div className="absolute bottom-5 left-4 z-20 w-full max-w-[390px] flex flex-col gap-2 rounded-2xl border border-line bg-white/95 p-4 shadow-xl backdrop-blur pointer-events-auto font-sans">
          <div className="flex items-center gap-2">
            <Route size={16} className="text-brand-600" />
            <p className="text-xs font-bold text-ink uppercase tracking-wider">
              Detail Rute Terpilih (Alternatif {selectedRouteIndex + 1})
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
              <p className="text-[10px] text-muted">Estimasi Waktu</p>
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

          {routes[selectedRouteIndex].potholes.length > 0 ? (
            <div className="mt-1 bg-amber-50 text-warning text-[10px] p-2.5 rounded-lg border border-amber-100/50 flex items-start gap-1.5 leading-relaxed">
              <AlertTriangle size={13} className="shrink-0 mt-0.5 text-warning" />
              <p>Perhatian! Rute ini melewati {routes[selectedRouteIndex].potholes.length} lubang jalan aktif. Mohon kurangi kecepatan dan berhati-hati.</p>
            </div>
          ) : (
            <div className="mt-1 bg-emerald-50 text-emerald-700 text-[10px] p-2.5 rounded-lg border border-emerald-100/50 flex items-start gap-1.5 leading-relaxed">
              <Check size={13} className="shrink-0 mt-0.5 text-emerald-600" />
              <p>Hebat! Ini adalah rute aman bebas dari titik lubang jalan rusak yang dilaporkan di database kami.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

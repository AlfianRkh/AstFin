import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { api } from "../api/client";

// Fix default leaflet marker icon issue in Vite/Webpack bundlers
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function OSMMapPicker({
  lat = null,
  lng = null,
  addressText = "",
  initialLat = -7.4478,
  initialLng = 112.7183,
  initialAddress = "",
  onLocationChange = () => {},
  autoDetectGPSIfEmpty = true,
  height = "260px",
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const activeLat = lat !== null && lat !== undefined ? lat : initialLat;
  const activeLng = lng !== null && lng !== undefined ? lng : initialLng;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentAddress, setCurrentAddress] = useState(addressText || initialAddress);
  const [coords, setCoords] = useState({ lat: activeLat, lng: activeLng });
  const [isDetectingGPS, setIsDetectingGPS] = useState(false);
  const [geoError, setGeoError] = useState("");

  const hasData = Boolean(addressText || initialAddress || (lat !== null && lng !== null));

  // Auto detect GPS function
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setGeoError("Browser Anda tidak mendukung deteksi lokasi GPS.");
      return;
    }

    setIsDetectingGPS(true);
    setGeoError("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 16);
          markerRef.current.setLatLng([latitude, longitude]);
        }

        await fetchReverseAddress(latitude, longitude);
        setIsDetectingGPS(false);
      },
      (err) => {
        setIsDetectingGPS(false);
        console.warn("GPS position could not be acquired:", err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const startLat = lat !== null && lat !== undefined ? lat : initialLat;
      const startLng = lng !== null && lng !== undefined ? lng : initialLng;

      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([startLat, startLng], {
        draggable: true,
        icon: defaultIcon,
      }).addTo(map);

      // Handle marker drag
      marker.on("dragend", async () => {
        const pos = marker.getLatLng();
        setCoords({ lat: pos.lat, lng: pos.lng });
        await fetchReverseAddress(pos.lat, pos.lng);
      });

      // Handle click on map to reposition marker
      map.on("click", async (e) => {
        marker.setLatLng(e.latlng);
        setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        await fetchReverseAddress(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Invalidate size after container renders
      setTimeout(() => {
        map.invalidateSize();
      }, 200);

      // Auto detect GPS if no location data provided (masih baru / kosong)
      if (autoDetectGPSIfEmpty && !hasData) {
        handleDetectGPS();
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // React to prop changes (e.g. user selects a store with coordinates from database)
  useEffect(() => {
    if (addressText !== undefined && addressText !== currentAddress) {
      setCurrentAddress(addressText);
    }

    if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
      setCoords({ lat, lng });

      if (mapInstanceRef.current && markerRef.current) {
        const curMarkerPos = markerRef.current.getLatLng();
        const diff = Math.abs(curMarkerPos.lat - lat) + Math.abs(curMarkerPos.lng - lng);
        // Only reposition if moved significantly
        if (diff > 0.0001) {
          markerRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.setView([lat, lng], 16);
        }
      }
    }
  }, [lat, lng, addressText]);

  const fetchReverseAddress = async (targetLat, targetLng) => {
    try {
      setGeoError("");
      const res = await api.reverseGeo(targetLat, targetLng);
      const display = res.display_name || `Lat: ${targetLat.toFixed(5)}, Lng: ${targetLng.toFixed(5)}`;
      setCurrentAddress(display);
      onLocationChange({ lat: targetLat, lng: targetLng, addressText: display });
    } catch (err) {
      const fallback = `Lokasi (${targetLat.toFixed(5)}, ${targetLng.toFixed(5)})`;
      setCurrentAddress(fallback);
      onLocationChange({ lat: targetLat, lng: targetLng, addressText: fallback });
    }
  };

  // Search Address via backend OSM proxy
  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setGeoError("");

    try {
      const results = await api.searchGeo(searchQuery);
      if (Array.isArray(results) && results.length > 0) {
        setSearchResults(results);
      } else {
        setGeoError("Alamat tidak ditemukan. Coba kata kunci yang lebih spesifik.");
      }
    } catch (err) {
      setGeoError("Gagal mencari alamat via OpenStreetMap. Silakan geser pin pada peta.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = async (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const display = item.display_name;

    setCoords({ lat, lng });
    setCurrentAddress(display);
    setSearchResults([]);
    setSearchQuery("");

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16);
      markerRef.current.setLatLng([lat, lng]);
    }

    onLocationChange({ lat, lng, addressText: display });
  };

  return (
    <div className="space-y-2.5">
      {/* Search Bar & GPS Button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(e)}
            placeholder="Cari jalan / toko / alamat di Sidoarjo..."
            className="w-full bg-surface-container-highest/60 border border-outline-variant/30 rounded-xl px-3.5 py-2 pl-9 text-xs text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary/80 transition-colors"
          />
          <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[18px] text-outline-variant">
            search
          </span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="absolute right-2.5 top-2 text-outline-variant hover:text-on-surface text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching}
          className="px-3 py-2 bg-surface-container-high border border-outline-variant/30 hover:border-primary/50 text-xs font-semibold rounded-xl text-on-surface flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {isSearching ? (
            <span className="animate-spin material-symbols-outlined text-[16px]">progress_activity</span>
          ) : (
            <span>Cari</span>
          )}
        </button>

        <button
          type="button"
          onClick={handleDetectGPS}
          disabled={isDetectingGPS}
          title="Gunakan lokasi saya saat ini"
          className="px-3 py-2 bg-primary/10 border border-primary/30 hover:bg-primary/20 text-xs font-semibold rounded-xl text-primary flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[16px] ${isDetectingGPS ? "animate-spin" : ""}`}>
            {isDetectingGPS ? "progress_activity" : "my_location"}
          </span>
          <span className="hidden sm:inline">GPS</span>
        </button>
      </div>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <div className="bg-surface-container-highest border border-outline-variant/40 rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto z-20">
          {searchResults.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSearchResult(item)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-surface-container border-b border-outline-variant/10 last:border-b-0 flex items-start gap-2 text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-primary text-[16px] mt-0.5 shrink-0">
                location_on
              </span>
              <span className="line-clamp-2 leading-relaxed">{item.display_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Geolocation Notice / Error */}
      {geoError && (
        <p className="text-[11px] text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
          {geoError}
        </p>
      )}

      {/* Map Container */}
      <div className="relative rounded-2xl overflow-hidden border border-outline-variant/25 shadow-inner">
        <div ref={mapContainerRef} style={{ height, width: "100%" }} className="z-10" />
        <div className="absolute top-2 right-2 z-20 bg-surface-container-lowest/80 backdrop-blur-md px-2 py-1 rounded-md text-[10px] text-outline-variant border border-outline-variant/20 pointer-events-none flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px] text-primary">touch_app</span>
          <span>Geser pin atau klik peta</span>
        </div>
      </div>

      {/* Selected Address Preview */}
      <div className="bg-surface-container-lowest/80 border border-outline-variant/20 rounded-xl p-2.5 flex items-start gap-2">
        <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
          place
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-outline-variant uppercase tracking-wider">
            Alamat / Titik Terpilih
          </p>
          <p className="text-xs text-on-surface font-medium truncate mt-0.5">
            {currentAddress || addressText || (isDetectingGPS ? "🛰️ Mendeteksi lokasi GPS terkini Anda..." : "Belum ada lokasi dipilih (geser pin pada peta atau klik GPS)")}
          </p>
          <p className="text-[10px] text-outline-variant font-mono mt-0.5">
            Lat: {coords.lat ? coords.lat.toFixed(5) : "-"} | Lng: {coords.lng ? coords.lng.toFixed(5) : "-"}
          </p>
        </div>
      </div>
    </div>
  );
}

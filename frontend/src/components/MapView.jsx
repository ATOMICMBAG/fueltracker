// ============================================================
// components/MapView.jsx — Leaflet Karte mit Markern
// ============================================================
import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { useStore } from "../store/useStore.js";
import { priceColor, formatPrice } from "../utils/api.js";

// Custom SVG marker factory
function createMarker(price, fuelType, isEV = false, isCheapest = false) {
  const color = isEV ? "#a78bfa" : priceColor(price, fuelType);
  const label =
    isEV ? "⚡"
    : price ? `${price.toFixed(2)}`
    : "?";
  const size = isCheapest ? 46 : 36;
  const border = isCheapest ? 'stroke="#fff" stroke-width="2.5"' : "";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" ${border} opacity="0.95"/>
      ${isCheapest ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 + 1}" fill="none" stroke="${color}" stroke-width="2" opacity="0.4"/>` : ""}
      <text x="${size / 2}" y="${size / 2 + 1}" text-anchor="middle" dominant-baseline="central"
            font-family="system-ui,sans-serif" font-weight="700"
            font-size="${isEV ? size * 0.45 : size * 0.3}" fill="white">${label}</text>
      <polygon points="${size / 2 - 5},${size - 1} ${size / 2 + 5},${size - 1} ${size / 2},${size + 7}"
               fill="${color}" opacity="0.95"/>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
  });
}

function userMarkerIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="7" fill="#3b82f6" opacity="0.3"/>
      <circle cx="10" cy="10" r="4" fill="#3b82f6"/>
      <circle cx="10" cy="10" r="1.5" fill="white"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export default function MapView() {
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const userMarker = useRef(null);

  const {
    userLocation,
    stations,
    evStations,
    filters,
    mapCenter,
    mapZoom,
    setSelectedStation,
    setUserLocation,
  } = useStore((s) => ({
    userLocation: s.userLocation,
    stations: s.stations,
    evStations: s.evStations,
    filters: s.filters,
    mapCenter: s.mapCenter,
    mapZoom: s.mapZoom,
    setSelectedStation: s.setSelectedStation,
    setUserLocation: s.setUserLocation,
  }));

  // Init map
  useEffect(() => {
    if (leafletRef.current) return;
    const map = L.map(mapRef.current, {
      center: mapCenter,
      zoom: mapZoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    // Klick auf Karte setzt Position
    map.on("click", (e) => {
      setUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    leafletRef.current = map;
  }, []);

  // Update user location marker
  useEffect(() => {
    if (!leafletRef.current || !userLocation) return;
    const map = leafletRef.current;

    if (userMarker.current) userMarker.current.remove();
    userMarker.current = L.marker([userLocation.lat, userLocation.lng], {
      icon: userMarkerIcon(),
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindPopup("<b>Dein Standort</b>");

    map.flyTo(
      [userLocation.lat, userLocation.lng],
      Math.max(map.getZoom(), 12),
      { duration: 1.2 },
    );
  }, [userLocation]);

  // Update station markers
  useEffect(() => {
    if (!leafletRef.current) return;
    const map = leafletRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const fuelKey = filters.fuel === "all" ? "diesel" : filters.fuel;
    const allStations = [...stations, ...evStations];
    if (!allStations.length) return;

    // Find cheapest
    const prices = stations.map((s) => s.prices?.[fuelKey]).filter(Boolean);
    const cheapest = prices.length ? Math.min(...prices) : null;

    allStations.forEach((station) => {
      const isEV = station.type === "ev";
      const price = station.prices?.[fuelKey] || null;
      const isCheapest = !isEV && price && price === cheapest;

      const marker = L.marker([station.lat, station.lng], {
        icon: createMarker(price, fuelKey, isEV, isCheapest),
        zIndexOffset: isCheapest ? 500 : 0,
      }).addTo(map);

      const name = station.name || station.brand || "Tankstelle";
      const pLabel =
        isEV ?
          `⚡ ${station.maxKw ? station.maxKw + " kW" : ""} · ${station.numPoints || 1} Säule(n)`
        : Object.entries(station.prices || {})
            .map(([k, v]) => `${k.toUpperCase()}: ${v?.toFixed(3)} €`)
            .join(" · ");

      marker.bindPopup(`
        <div style="min-width:200px;font-family:system-ui,sans-serif">
          ${isCheapest ? '<div style="color:#22c55e;font-size:11px;font-weight:700;margin-bottom:4px">⭐ GÜNSTIGSTE IN DER NÄHE</div>' : ""}
          <div style="font-weight:700;font-size:15px;margin-bottom:2px">${name}</div>
          <div style="color:#888;font-size:12px;margin-bottom:8px">${station.street || ""} ${station.city || ""}</div>
          <div style="font-size:13px;line-height:1.8">${pLabel || "Preis nicht verfügbar"}</div>
          ${station.dist ? `<div style="color:#888;font-size:11px;margin-top:6px">${station.dist.toFixed(1)} km entfernt</div>` : ""}
        </div>
      `);

      marker.on("click", () => setSelectedStation(station));
      markersRef.current.push(marker);
    });
  }, [stations, evStations, filters.fuel]);

  return <div ref={mapRef} style={{ flex: 1, height: "100%", zIndex: 1 }} />;
}

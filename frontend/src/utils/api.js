// ============================================================
// utils/api.js — Backend API client
// ============================================================
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({ baseURL: BASE, timeout: 12000 });

export async function fetchNearbyStations({ lat, lng, radius, fuel, maxPrice, onlyOpen, limit = 30 }) {
  const { data } = await api.get('/stations/nearby', {
    params: { lat, lng, radius, fuel, maxPrice, onlyOpen: onlyOpen ? 1 : 0, limit },
  });
  return data;
}

export async function fetchEVStations({ lat, lng, radius, minKw }) {
  const { data } = await api.get('/ev/nearby', {
    params: { lat, lng, radius, minKw, limit: 30 },
  });
  return data;
}

export async function fetchCountryPrices(countryCode) {
  const { data } = await api.get(`/stations/country/${countryCode}`);
  return data;
}

export async function fetchEuropePrices() {
  const { data } = await api.get('/prices/europe');
  return data;
}

export async function fetchStats() {
  const { data } = await api.get('/prices/stats');
  return data;
}

// ── Price color helper ────────────────────────────────────────
export function priceColor(price, fuelType = 'diesel') {
  // Referenzwerte (DE Durchschnitt ca. Anfang 2025)
  const refs = { diesel: 1.70, e5: 1.85, e10: 1.75, lpg: 0.90 };
  const ref = refs[fuelType] || 1.70;
  if (!price) return '#7c82a0';
  if (price < ref * 0.97) return '#22c55e';  // günstig
  if (price < ref * 1.03) return '#f59e0b';  // mittel
  return '#ef4444';                           // teuer
}

export function formatPrice(price, currency = '€') {
  if (!price) return '–';
  return `${price.toFixed(3)} ${currency}`;
}

export function formatDist(km) {
  if (!km) return '';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

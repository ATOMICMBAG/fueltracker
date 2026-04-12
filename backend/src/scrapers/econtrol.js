// ============================================================
// scrapers/econtrol.js — Stufe 2: Österreich
// API: https://api.e-control.at/sprit/1.0/
// Kostenlos, offiziell, gesetzlich vorgeschrieben
// ============================================================
import axios from 'axios';
import { cacheGet, cacheSet } from '../cache/redis.js';
import { upsertStation, insertPrice } from '../cache/database.js';
import { logger } from '../utils/logger.js';

const BASE_URL = 'https://api.e-control.at/sprit/1.0';
const TTL = parseInt(process.env.CACHE_TTL_LIVE || '3600');

/**
 * Suche nach AT-Tankstellen im Umkreis
 */
export async function searchNearby(lat, lng, radiusKm = 10, fuelType = 'DIE') {
  // E-Control Fuel Types: 'DIE' = Diesel, 'SUP' = Super (E10), 'GAS' = LPG
  const typeMap = { diesel: 'DIE', e10: 'SUP', e5: 'SUP', lpg: 'GAS' };
  const apiType = typeMap[fuelType] || 'DIE';

  const cacheKey = `ec:nearby:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusKm}:${apiType}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get(`${BASE_URL}/search/gas-stations/by-address`, {
      params: {
        latitude: lat,
        longitude: lng,
        fuelType: apiType,
        includeClosed: false,
      },
      headers: { 'Accept': 'application/json' },
      timeout: 8000,
    });

    if (!Array.isArray(data)) return [];

    // Filter by radius manually (API returns all in region)
    const filtered = data
      .map(s => ({ ...normalizeStation(s), dist: haversine(lat, lng, s.location.latitude, s.location.longitude) }))
      .filter(s => s.dist <= radiusKm)
      .sort((a, b) => a.dist - b.dist);

    persistStations(filtered, apiType);
    await cacheSet(cacheKey, filtered, TTL);
    logger.info(`E-Control AT: ${filtered.length} stations near ${lat},${lng}`);
    return filtered;
  } catch (err) {
    logger.error('E-Control request failed:', err.message);
    return [];
  }
}

/**
 * Alle AT-Stationen (für täglichen DB-Sync)
 */
export async function fetchAllStations() {
  const cacheKey = 'ec:all_stations';
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get(`${BASE_URL}/search/gas-stations/by-region`, {
      params: { code: 'AT', type: 'COUNTRY' },
      timeout: 30000,
    });

    await cacheSet(cacheKey, data, 86400);
    return data;
  } catch (err) {
    logger.error('E-Control all stations fetch failed:', err.message);
    return [];
  }
}

// ── Normalisierung ───────────────────────────────────────────
function normalizeStation(s) {
  const prices = {};
  if (s.prices) {
    for (const p of s.prices) {
      const type = { DIE: 'diesel', SUP: 'e10', GAS: 'lpg' }[p.fuelType] || p.fuelType.toLowerCase();
      prices[type] = p.amount;
    }
  }

  return {
    id: `at_ec_${s.id}`,
    sourceId: s.id,
    source: 'econtrol',
    country: 'AT',
    name: s.name,
    brand: s.name,
    street: `${s.location.address} ${s.location.postalCode || ''}`.trim(),
    city: s.location.city,
    postcode: s.location.postalCode,
    lat: s.location.latitude,
    lng: s.location.longitude,
    isOpen: s.open,
    prices,
    updatedAt: new Date().toISOString(),
  };
}

function persistStations(stations, fuelType) {
  for (const s of stations) {
    try {
      upsertStation({
        id: s.id, source: s.source, country: s.country,
        name: s.name, brand: s.brand, street: s.street,
        city: s.city, postcode: s.postcode,
        lat: s.lat, lng: s.lng, is_open: s.isOpen ? 1 : 0,
      });
      for (const [type, price] of Object.entries(s.prices)) {
        if (price) insertPrice(s.id, type, price, 'EUR', 'econtrol');
      }
    } catch (err) {
      logger.warn(`Persist failed for AT station ${s.id}:`, err.message);
    }
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

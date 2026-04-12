// ============================================================
// scrapers/ev-ocm.js — EV Ladesäulen via Open Charge Map
// API: https://openchargemap.org/site/develop/api
// Kostenlos, europaweite Abdeckung
// ============================================================
import axios from 'axios';
import { cacheGet, cacheSet } from '../cache/redis.js';
import { logger } from '../utils/logger.js';

const BASE_URL = 'https://api.openchargemap.io/v3';
const TTL = 7200; // 2h

export async function searchEVNearby(lat, lng, radiusKm = 15, maxResults = 50) {
  const cacheKey = `ev:nearby:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusKm}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.OCM_API_KEY;

  try {
    const { data } = await axios.get(`${BASE_URL}/poi`, {
      params: {
        output: 'json',
        latitude: lat,
        longitude: lng,
        distance: radiusKm,
        distanceunit: 'km',
        maxresults: maxResults,
        compact: true,
        verbose: false,
        statustype: 50,    // Operational only
        levelid: '2,3',    // Level 2 + DC Fast Charge
        ...(apiKey && apiKey !== 'your_ocm_key_here' ? { key: apiKey } : {}),
      },
      timeout: 10000,
    });

    const stations = (Array.isArray(data) ? data : []).map(normalizeEV);
    await cacheSet(cacheKey, stations, TTL);
    logger.info(`OCM: ${stations.length} EV stations near ${lat},${lng}`);
    return stations;
  } catch (err) {
    logger.error('Open Charge Map request failed:', err.message);
    return [];
  }
}

function normalizeEV(s) {
  const connections = (s.Connections || []).map(c => ({
    type: c.ConnectionType?.Title || 'Unknown',
    kw: c.PowerKW || null,
    amps: c.Amps || null,
    voltage: c.Voltage || null,
    level: c.Level?.Title || null,
  }));

  const maxKw = Math.max(...connections.map(c => c.kw || 0), 0) || null;

  return {
    id: `ev_ocm_${s.ID}`,
    sourceId: s.ID,
    source: 'ocm',
    type: 'ev',
    country: s.AddressInfo?.Country?.ISOCode || null,
    name: s.AddressInfo?.Title || 'EV Ladesäule',
    operator: s.OperatorInfo?.Title || null,
    street: s.AddressInfo?.AddressLine1 || null,
    city: s.AddressInfo?.Town || null,
    postcode: s.AddressInfo?.Postcode || null,
    lat: s.AddressInfo?.Latitude,
    lng: s.AddressInfo?.Longitude,
    isOperational: s.StatusType?.ID === 50,
    numPoints: s.NumberOfPoints || 1,
    connections,
    maxKw,
    dist: s.AddressInfo?.Distance || null,
    // EV Preise sind oft kostenlos oder via App — wir zeigen nur verfügbarkeit
    pricing: s.UsageCost || 'Unbekannt',
  };
}

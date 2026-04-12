// ============================================================
// scrapers/tankerkoening.js — Stufe 1: Deutschland
// API: https://creativecommons.tankerkoenig.de
// Kostenlos, offizielle Lizenz via MTS-K Bundesnetzagentur
// ============================================================
import axios from "axios";
import { cacheGet, cacheSet } from "../cache/redis.js";
import { upsertStation, insertPrice } from "../cache/database.js";
import { logger } from "../utils/logger.js";

const BASE_URL = "https://creativecommons.tankerkoenig.de/json";
const TTL = parseInt(process.env.CACHE_TTL_LIVE || "3600");

/**
 * Sucht Tankstellen im Umkreis via Tankerkönig
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm  max 25km laut API
 * @param {string} fuelType  'e5'|'e10'|'diesel'|'all'
 * @returns {Array} Tankstellen mit Preisen
 */
export async function searchNearby(lat, lng, radiusKm = 10, fuelType = "all") {
  const cacheKey = `tk:nearby:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusKm}:${fuelType}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.TANKERKOENING_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    logger.warn("Tankerkönig API key not configured");
    return [];
  }

  // Tankerkönig unterstützt nur: e5, e10, diesel, all (kein lpg!)
  const tkFuel = fuelType === "lpg" ? "all" : fuelType;

  try {
    const { data } = await axios.get(`${BASE_URL}/list.php`, {
      params: {
        lat,
        lng,
        rad: Math.min(radiusKm, 25),
        type: tkFuel,
        apikey: apiKey,
        sort: tkFuel === "all" ? "dist" : "price",
      },
      timeout: 8000,
    });

    if (data.status !== "ok" || !data.stations) {
      logger.error(
        `Tankerkönig error: status=${data.status}, message=${data.message}`,
      );
      return [];
    }

    const stations = data.stations.map(normalizeStation);

    // Persist to SQLite for offline use
    persistStations(stations);

    await cacheSet(cacheKey, stations, TTL);
    logger.info(`Tankerkönig: ${stations.length} stations near ${lat},${lng}`);
    return stations;
  } catch (err) {
    logger.error("Tankerkönig request failed:", err.message);
    return [];
  }
}

/**
 * Prüft Einzelstation live (Preis-Refresh)
 */
export async function getStationDetail(stationId) {
  const cacheKey = `tk:detail:${stationId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.TANKERKOENING_API_KEY;
  const { data } = await axios.get(`${BASE_URL}/detail.php`, {
    params: { id: stationId, apikey: apiKey },
    timeout: 5000,
  });

  if (data.status !== "ok") return null;
  const station = normalizeStation(data.station);
  await cacheSet(cacheKey, station, 300); // 5 min für Einzelabfrage
  return station;
}

/**
 * Batch-Preisabfrage für mehrere Stationen (bis 10 gleichzeitig)
 */
export async function getPricesBatch(stationIds) {
  const apiKey = process.env.TANKERKOENING_API_KEY;
  const ids = stationIds.slice(0, 10).join(",");
  const cacheKey = `tk:batch:${ids}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const { data } = await axios.get(`${BASE_URL}/prices.php`, {
    params: { ids, apikey: apiKey },
    timeout: 5000,
  });

  if (data.status !== "ok") return {};
  await cacheSet(cacheKey, data.prices, 300);
  return data.prices;
}

// ── Normalisierung ───────────────────────────────────────────
function normalizeStation(s) {
  return {
    id: `de_tk_${s.id}`,
    sourceId: s.id,
    source: "tankerkoening",
    country: "DE",
    name: s.name || s.brand,
    brand: s.brand,
    street: `${s.street} ${s.houseNumber || ""}`.trim(),
    city: s.place,
    postcode: s.postCode,
    lat: s.lat,
    lng: s.lng,
    isOpen: s.isOpen,
    dist: s.dist || null,
    prices: {
      e5: s.e5 || null,
      e10: s.e10 || null,
      diesel: s.diesel || null,
    },
    updatedAt: new Date().toISOString(),
  };
}

async function persistStations(stations) {
  for (const s of stations) {
    try {
      await upsertStation({
        id: s.id,
        source: s.source,
        country: s.country,
        name: s.name,
        brand: s.brand,
        street: s.street,
        city: s.city,
        postcode: s.postcode,
        lat: s.lat,
        lng: s.lng,
        is_open: s.isOpen ? 1 : 0,
      });
      for (const [fuelType, price] of Object.entries(s.prices)) {
        if (price)
          await insertPrice(s.id, fuelType, price, "EUR", "tankerkoening");
      }
    } catch (err) {
      logger.warn(`Persist failed for station ${s.id}:`, err.message);
    }
  }
}

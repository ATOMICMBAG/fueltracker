// ============================================================
// api/stations.js — Haupt-API-Endpunkte für Tankstellen
// ============================================================
import { z } from "zod";
import * as tankerkoening from "../scrapers/tankerkoening.js";
import * as econtrol from "../scrapers/econtrol.js";
import * as francePrix from "../scrapers/france-prix.js";
import * as europeFallback from "../scrapers/europe-fallback.js";
import { getStationsNear } from "../cache/database.js";
import { logger } from "../utils/logger.js";

// Koordinaten-Bounding-Boxes für Auto-Routing an richtige API
const COUNTRY_BOUNDS = {
  DE: { latMin: 47.3, latMax: 55.1, lngMin: 5.9, lngMax: 15.1 },
  AT: { latMin: 46.4, latMax: 49.0, lngMin: 9.5, lngMax: 17.2 },
  CH: { latMin: 45.8, latMax: 47.8, lngMin: 5.9, lngMax: 10.5 },
  FR: { latMin: 41.3, latMax: 51.1, lngMin: -5.1, lngMax: 9.6 },
};

function detectCountry(lat, lng) {
  for (const [code, b] of Object.entries(COUNTRY_BOUNDS)) {
    if (
      lat >= b.latMin &&
      lat <= b.latMax &&
      lng >= b.lngMin &&
      lng <= b.lngMax
    ) {
      return code;
    }
  }
  return null; // Unbekannt → Fallback
}

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50).default(10),
  fuel: z.enum(["all", "e5", "e10", "diesel", "lpg"]).default("all"),
  country: z.string().length(2).optional(),
  maxPrice: z.coerce.number().optional(),
  onlyOpen: z.coerce.boolean().default(true),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export default async function stationsRouter(app) {
  // GET /api/v1/stations/nearby?lat=...&lng=...&radius=10&fuel=diesel
  app.get("/nearby", async (req, reply) => {
    const parse = nearbySchema.safeParse(req.query);
    if (!parse.success) {
      return reply
        .code(400)
        .send({ error: "Invalid parameters", details: parse.error.flatten() });
    }

    const { lat, lng, radius, fuel, country, maxPrice, onlyOpen, limit } =
      parse.data;
    const detectedCountry = country || detectCountry(lat, lng);

    logger.info(
      `/nearby: lat=${lat} lng=${lng} r=${radius}km fuel=${fuel} country=${detectedCountry}`,
    );

    let stations = [];

    try {
      // Parallel alle verfügbaren Quellen abfragen
      const tasks = [];

      if (!detectedCountry || detectedCountry === "DE") {
        tasks.push(
          tankerkoening.searchNearby(
            lat,
            lng,
            radius,
            fuel === "all" ? "all" : fuel,
          ),
        );
      }
      if (!detectedCountry || detectedCountry === "AT") {
        tasks.push(econtrol.searchNearby(lat, lng, radius, fuel));
      }
      if (!detectedCountry || detectedCountry === "FR") {
        tasks.push(francePrix.searchNearbyFrance(lat, lng, radius, fuel));
      }
      // Für andere Länder: lokale DB zuerst, dann Fallback
      if (detectedCountry && !["DE", "AT", "FR"].includes(detectedCountry)) {
        const localStations = await getStationsNear(
          lat,
          lng,
          radius,
          detectedCountry,
          limit,
        );
        if (localStations.length > 0) {
          stations.push(...localStations.map(formatDbStation));
        }
      }

      const results = await Promise.allSettled(tasks);
      for (const r of results) {
        if (r.status === "fulfilled" && Array.isArray(r.value)) {
          stations.push(...r.value);
        }
      }

      // Fallback auf SQLite wenn Live-APIs nichts zurückgeben
      if (!stations.length) {
        const dbStations = await getStationsNear(
          lat,
          lng,
          radius,
          detectedCountry,
          limit,
        );
        stations = dbStations.map(formatDbStation);
      }
    } catch (err) {
      logger.error("Stations fetch error:", err);
    }

    // ── Filter ────────────────────────────────────────────────
    if (onlyOpen) stations = stations.filter((s) => s.isOpen !== false);
    if (fuel !== "all")
      stations = stations.filter((s) => s.prices?.[fuel] != null);
    if (maxPrice)
      stations = stations.filter(
        (s) => !s.prices?.[fuel] || s.prices[fuel] <= maxPrice,
      );

    // ── Sort by price, then distance ──────────────────────────
    if (fuel !== "all") {
      stations.sort((a, b) => {
        const pa = a.prices?.[fuel] ?? Infinity;
        const pb = b.prices?.[fuel] ?? Infinity;
        return pa !== pb ? pa - pb : (a.dist || 0) - (b.dist || 0);
      });
    } else {
      stations.sort((a, b) => (a.dist || 0) - (b.dist || 0));
    }

    return {
      count: Math.min(stations.length, limit),
      country: detectedCountry,
      query: { lat, lng, radius, fuel },
      stations: stations.slice(0, limit),
    };
  });

  // GET /api/v1/stations/:id
  app.get("/:id", async (req, reply) => {
    const { id } = req.params;
    if (id.startsWith("de_tk_")) {
      const sourceId = id.replace("de_tk_", "");
      const station = await tankerkoening.getStationDetail(sourceId);
      if (!station) return reply.code(404).send({ error: "Station not found" });
      return station;
    }
    return reply.code(404).send({ error: "Station not found" });
  });

  // GET /api/v1/stations/country/:code — Übersicht für ein Land (Stufe 3)
  app.get("/country/:code", async (req, reply) => {
    const country = req.params.code.toUpperCase();
    const data = await europeFallback.getCountryPrices(country);
    if (!data)
      return reply
        .code(404)
        .send({ error: `No data available for ${country}` });
    return data;
  });
}

function formatDbStation(row) {
  let prices = {};
  try {
    prices = JSON.parse(row.prices_json || "{}");
  } catch {}
  return {
    id: row.id,
    source: row.source,
    country: row.country,
    name: row.name,
    brand: row.brand,
    street: row.street,
    city: row.city,
    postcode: row.postcode,
    lat: row.lat,
    lng: row.lng,
    isOpen: row.is_open === 1,
    dist: row.distance_km || null,
    prices,
    _fromCache: true,
  };
}

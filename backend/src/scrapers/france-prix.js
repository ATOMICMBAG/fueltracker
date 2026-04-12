// ============================================================
// scrapers/france-prix.js — Frankreich Tankstellen-Preise
// API: https://donnees.roulez-eco.fr/opendata/instantane
// Kostenlos, offizielle französische Regierungs-API (CSV-Format)
// ============================================================
import axios from "axios";
import AdmZip from "adm-zip";
import { parseStringPromise } from "xml2js";
import { cacheGet, cacheSet } from "../cache/redis.js";
import { logger } from "../utils/logger.js";

const FRANCE_URL = "https://donnees.roulez-eco.fr/opendata/instantane";
const TTL = parseInt(process.env.CACHE_TTL_LIVE || "3600");

// Haversine-Distanz
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Sucht Tankstellen in Frankreich im Umkreis
 */
export async function searchNearbyFrance(
  lat,
  lng,
  radiusKm = 10,
  fuelType = "all",
) {
  const cacheKey = `fr:nearby:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusKm}:${fuelType}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get(FRANCE_URL, {
      timeout: 60000,
      responseType: "arraybuffer",
    });

    const zip = new AdmZip(data);
    const zipEntries = zip.getEntries();
    const xmlEntry = zipEntries.find((e) =>
      e.entryName.includes("PrixCarburants_instantane.xml"),
    );
    if (!xmlEntry) {
      logger.warn("No XML entry in France ZIP");
      return [];
    }

    const xml = xmlEntry.getData().toString("utf8");
    const result = await parseStringPromise(xml, { explicitArray: false });
    const pdvs =
      result.pdv_liste.pdv ?
        Array.isArray(result.pdv_liste.pdv) ?
          result.pdv_liste.pdv
        : [result.pdv_liste.pdv]
      : [];

    logger.info(`France API: ${pdvs.length} pdv parsed`);

    const stations = [];

    for (const pdv of pdvs) {
      const stationLat = parseFloat(pdv.$.latitude) / 100000;
      const stationLng = parseFloat(pdv.$.longitude) / 100000;
      if (isNaN(stationLat) || isNaN(stationLng)) continue;

      const dist = haversine(lat, lng, stationLat, stationLng);
      if (dist > radiusKm) continue;

      const prices = {};
      if (pdv.prix) {
        const prixList = Array.isArray(pdv.prix) ? pdv.prix : [pdv.prix];
        for (const prix of prixList) {
          const nom = prix.$.nom.toLowerCase();
          const valeur = parseFloat(prix.$.valeur);
          if (!isNaN(valeur) && valeur > 0) {
            if (nom === "gazole") prices.diesel = valeur;
            else if (nom === "sp95") prices.e5 = valeur;
            else if (nom === "e10") prices.e10 = valeur;
            else if (nom === "sp98")
              prices.e5 = Math.min(prices.e5 || Infinity, valeur);
            else if (nom === "gplc" || nom === "gpl") prices.lpg = valeur;
            else if (nom === "e85") prices.e85 = valeur;
          }
        }
      }

      if (fuelType !== "all" && !prices[fuelType]) continue;

      stations.push({
        id: `fr_${pdv.$.id}`,
        source: "france-prix",
        country: "FR",
        name: pdv.ville || "Station FR",
        brand: null,
        street: pdv.adresse || "",
        city: pdv.ville || "",
        postcode: pdv.$.cp || "",
        lat: stationLat,
        lng: stationLng,
        isOpen: true,
        dist: Math.round(dist * 10) / 10,
        prices,
        updatedAt: new Date().toISOString(),
      });
    }

    stations.sort((a, b) => a.dist - b.dist);

    await cacheSet(cacheKey, stations, TTL);
    logger.info(`France-Prix: ${stations.length} stations near ${lat},${lng}`);
    return stations;
  } catch (err) {
    logger.error("France-Prix request failed:", err.message);
    return [];
  }
}

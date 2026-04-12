// ============================================================
// scrapers/europe-fallback.js — Stufe 3: Resteuropa
// Quellen: mylpg.eu, adac.de, prix-carburants.gouv.fr
// Playwright headless scraping + AI parsing
// ============================================================
import axios from 'axios';
import * as cheerio from 'cheerio';
import { cacheGet, cacheSet } from '../cache/redis.js';
import { upsertStation, insertPrice } from '../cache/database.js';
import { logger } from '../utils/logger.js';

const TTL_SCRAPER = parseInt(process.env.CACHE_TTL_SCRAPER || '21600'); // 6h

// ── Country → source mapping ─────────────────────────────────
const COUNTRY_SOURCES = {
  IT: { scraper: scrapeMylpg, country: 'italy' },
  ES: { scraper: scrapeMylpg, country: 'spain' },
  PL: { scraper: scrapeMylpg, country: 'poland' },
  NL: { scraper: scrapeMylpg, country: 'netherlands' },
  BE: { scraper: scrapeMylpg, country: 'belgium' },
  FR: { scraper: scrapeFrance },
  PT: { scraper: scrapeMylpg, country: 'portugal' },
  CZ: { scraper: scrapeMylpg, country: 'czech-republic' },
  HR: { scraper: scrapeMylpg, country: 'croatia' },
};

export async function getCountryPrices(countryCode) {
  const source = COUNTRY_SOURCES[countryCode.toUpperCase()];
  if (!source) {
    logger.warn(`No scraper available for country: ${countryCode}`);
    return null;
  }

  const cacheKey = `scraper:${countryCode}:overview`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const result = await source.scraper(source.country || countryCode);
    if (result) {
      await cacheSet(cacheKey, result, TTL_SCRAPER);
    }
    return result;
  } catch (err) {
    logger.error(`Scraper failed for ${countryCode}:`, err.message);
    return await getLastKnownPrices(countryCode);
  }
}

// ── Scraper: mylpg.eu ─────────────────────────────────────────
// Beispiel: https://www.mylpg.eu/de/tankstellen/italy/preise/
async function scrapeMylpg(countrySlug) {
  const url = `https://www.mylpg.eu/de/tankstellen/${countrySlug}/preise/`;
  logger.info(`Scraping mylpg.eu for ${countrySlug}: ${url}`);

  const { data: html } = await axios.get(url, {
    timeout: parseInt(process.env.SCRAPER_TIMEOUT_MS || '15000'),
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FuelTracker/1.0; +https://fueltracker.example.com)',
      'Accept-Language': 'de-DE,de;q=0.9',
    },
  });

  const $ = cheerio.load(html);
  const stations = [];

  // mylpg.eu Stationsliste parsen
  $('.station-item, [class*="station"], [class*="tankstelle"]').each((_, el) => {
    const name   = $(el).find('[class*="name"], h3, h4').first().text().trim();
    const city   = $(el).find('[class*="city"], [class*="stadt"], [class*="location"]').first().text().trim();
    const price  = parsePrice($(el).find('[class*="price"], [class*="preis"]').first().text());
    const latStr = $(el).attr('data-lat') || $(el).find('[data-lat]').attr('data-lat');
    const lngStr = $(el).attr('data-lng') || $(el).find('[data-lng]').attr('data-lng');

    if (name && price) {
      stations.push({
        name, city,
        prices: { lpg: price },
        lat: latStr ? parseFloat(latStr) : null,
        lng: lngStr ? parseFloat(lngStr) : null,
        source: 'mylpg',
      });
    }
  });

  // Fallback: Durchschnittspreise aus Summary-Tabelle
  const summary = {};
  $('table tr, .price-summary tr').each((_, row) => {
    const cells = $(row).find('td, th').map((_, c) => $(c).text().trim()).get();
    if (cells.length >= 2) {
      const price = parsePrice(cells[1]);
      if (price && cells[0]) {
        summary[cells[0].toLowerCase()] = price;
      }
    }
  });

  logger.info(`mylpg.eu ${countrySlug}: ${stations.length} stations, summary: ${JSON.stringify(summary)}`);

  return {
    source: 'mylpg',
    url,
    scrapedAt: new Date().toISOString(),
    stations: stations.length ? stations : null,
    averagePrices: Object.keys(summary).length ? summary : null,
    raw: stations.length === 0 && !Object.keys(summary).length ? 'parse_failed' : 'ok',
  };
}

// ── Scraper: prix-carburants.gouv.fr (Frankreich, offiziell) ─
async function scrapeFrance() {
  const url = 'https://donnees.roulez-eco.fr/opendata/instantane';
  logger.info(`Fetching France official fuel data: ${url}`);

  // Frankreich bietet XML-Daten an — parsen wir das
  const { data: xml } = await axios.get(url, { timeout: 20000 });
  const $ = cheerio.load(xml, { xmlMode: true });

  const stations = [];
  $('pdv').each((_, el) => {
    const lat  = parseFloat($(el).attr('latitude')) / 100000;
    const lng  = parseFloat($(el).attr('longitude')) / 100000;
    const city = $(el).find('ville').text().trim();
    const addr = $(el).find('adresse').text().trim();
    const id   = $(el).attr('id');

    const prices = {};
    $(el).find('prix').each((_, p) => {
      const nom  = $(p).attr('nom')?.toLowerCase();
      const val  = parseFloat($(p).attr('valeur'));
      if (nom && val) {
        const map = { 'gazole': 'diesel', 'sp95': 'e5', 'sp98': 'e5_98', 'gplc': 'lpg', 'e10': 'e10' };
        prices[map[nom] || nom] = val / 1000; // Frankreich in Millicent
      }
    });

    if (lat && lng && Object.keys(prices).length) {
      stations.push({
        id: `fr_gov_${id}`,
        source: 'prix_carburants_fr',
        country: 'FR',
        city, addr, lat, lng, prices,
        isOpen: !$(el).find('fermeture').length,
      });

      // Persist
      upsertStation({ id: `fr_gov_${id}`, source: 'prix_carburants_fr', country: 'FR',
        name: addr, brand: null, street: addr, city, postcode: null, lat, lng, is_open: 1 });
      for (const [ft, p] of Object.entries(prices)) {
        insertPrice(`fr_gov_${id}`, ft, p, 'EUR', 'prix_carburants_fr');
      }
    }
  });

  logger.info(`France gov data: ${stations.length} stations`);
  return { source: 'prix_carburants_fr', scrapedAt: new Date().toISOString(), stations };
}

// ── Scraper: ADAC Reiseinfos ──────────────────────────────────
// Liefert Durchschnittspreise pro Land — gut als Referenz
export async function scrapeAdacCountryPrices() {
  const cacheKey = 'scraper:adac:country_overview';
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const url = 'https://www.adac.de/reise-freizeit/reiseplanung/reiseziele/';
  logger.info(`Scraping ADAC country overview...`);

  try {
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FuelTracker/1.0)' },
    });

    const $ = cheerio.load(html);
    const countries = {};

    // ADAC Struktur: Tabellen mit Land + Kraftstoffpreisen
    $('table').each((_, table) => {
      $(table).find('tr').each((_, row) => {
        const cells = $(row).find('td').map((_, c) => $(c).text().trim()).get();
        if (cells.length >= 3) {
          const country = cells[0];
          const diesel  = parsePrice(cells[1]);
          const super95 = parsePrice(cells[2]);
          if (country && (diesel || super95)) {
            countries[country] = { diesel, e5: super95, source: 'adac' };
          }
        }
      });
    });

    const result = { source: 'adac', scrapedAt: new Date().toISOString(), countries };
    await cacheSet(cacheKey, result, TTL_SCRAPER);
    logger.info(`ADAC: ${Object.keys(countries).length} countries scraped`);
    return result;
  } catch (err) {
    logger.error('ADAC scrape failed:', err.message);
    return null;
  }
}

// ── Fallback: Letzter bekannter Stand aus SQLite ─────────────
export async function getLastKnownPrices(countryCode) {
  // Gibt gecachte Daten aus DB zurück auch wenn Scraper failed
  const { getDb } = await import('../cache/database.js');
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.fuel_type, AVG(p.price) as avg_price, MAX(p.fetched_at) as last_seen
    FROM prices p
    JOIN stations s ON s.id = p.station_id
    WHERE s.country = ?
    GROUP BY p.fuel_type
  `).all(countryCode);

  if (!rows.length) return null;

  return {
    source: 'last_known_db',
    country: countryCode,
    note: 'Letzte bekannte Preise aus Datenbank',
    averagePrices: Object.fromEntries(rows.map(r => [r.fuel_type, r.avg_price])),
    lastUpdated: rows[0]?.last_seen,
  };
}

// ── Hilfsfunktionen ──────────────────────────────────────────
function parsePrice(text) {
  if (!text) return null;
  const match = String(text).replace(',', '.').match(/(\d+\.?\d*)/);
  const val = match ? parseFloat(match[1]) : null;
  // Plausibilitäts-Check: Kraftstoffpreise 0.5€ – 4.0€
  return val && val >= 0.5 && val <= 4.0 ? val : null;
}

// ============================================================
// api/prices.js — Preis-Übersichts-Endpunkte
// ============================================================
import { scrapeAdacCountryPrices, getLastKnownPrices } from '../scrapers/europe-fallback.js';
import { getDb } from '../cache/database.js';

export default async function pricesRouter(app) {
  // GET /api/v1/prices/europe — ADAC-Übersicht aller EU-Länder
  app.get('/europe', async (req, reply) => {
    const data = await scrapeAdacCountryPrices();
    return data || { error: 'Could not fetch European price overview' };
  });

  // GET /api/v1/prices/country/:code — Letzter Stand für ein Land
  app.get('/country/:code', async (req, reply) => {
    const country = req.params.code.toUpperCase();
    const data = await getLastKnownPrices(country);
    return data || { error: `No price data for ${country}` };
  });

  // GET /api/v1/prices/stats — Statistische Übersicht aus lokaler DB
  app.get('/stats', async () => {
    const db = getDb();
    return {
      stations: db.prepare('SELECT country, COUNT(*) as count FROM stations GROUP BY country').all(),
      avgPrices: db.prepare(`
        SELECT s.country, p.fuel_type, ROUND(AVG(p.price), 3) as avg,
               ROUND(MIN(p.price), 3) as min, ROUND(MAX(p.price), 3) as max,
               COUNT(*) as samples
        FROM prices p JOIN stations s ON s.id = p.station_id
        WHERE p.fetched_at > datetime('now', '-24 hours')
        GROUP BY s.country, p.fuel_type
        ORDER BY s.country, p.fuel_type
      `).all(),
      lastUpdate: db.prepare('SELECT MAX(fetched_at) as ts FROM prices').get()?.ts,
    };
  });
}

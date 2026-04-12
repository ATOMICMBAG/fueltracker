// ============================================================
// scheduler/index.js — Cron Jobs für automatische Updates
// ============================================================
import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { scrapeAdacCountryPrices } from '../scrapers/europe-fallback.js';
import { fetchAllStations } from '../scrapers/econtrol.js';
import { cacheDel } from '../cache/redis.js';
import { getDb } from '../cache/database.js';

export function startScheduler() {
  logger.info('⏰ Scheduler starting...');

  // ── Stündlich: Alte Live-Cache-Einträge invalidieren ──────
  // (Tankerkönig + E-Control werden automatisch on-demand neu geholt)
  cron.schedule('0 * * * *', async () => {
    logger.info('Cron: Invalidating live price caches');
    await cacheDel('tk:nearby:*');
    await cacheDel('ec:nearby:*');
    await cacheDel('ev:nearby:*');
  });

  // ── Alle 6h: Scraper-Caches invalidieren ─────────────────
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Cron: Refreshing scraper data');
    await cacheDel('scraper:*');
    // ADAC Übersicht neu laden (Hintergrundjob)
    scrapeAdacCountryPrices().catch(err =>
      logger.error('ADAC background scrape failed:', err.message)
    );
  });

  // ── Täglich 03:00: Österreich Vollsync ───────────────────
  cron.schedule('0 3 * * *', async () => {
    logger.info('Cron: Daily AT E-Control full sync');
    try {
      await fetchAllStations();
      logger.info('AT sync complete');
    } catch (err) {
      logger.error('AT sync failed:', err.message);
    }
  });

  // ── Täglich 04:00: Alte Preise aus DB bereinigen ─────────
  cron.schedule('0 4 * * *', async () => {
    logger.info('Cron: Pruning old price records');
    try {
      const db = getDb();
      const result = db.prepare(`
        DELETE FROM prices
        WHERE fetched_at < datetime('now', '-7 days')
      `).run();
      logger.info(`Pruned ${result.changes} old price records`);
    } catch (err) {
      logger.error('DB prune failed:', err.message);
    }
  });

  // ── Täglich 02:00: Scraper-Log bereinigen ────────────────
  cron.schedule('0 2 * * *', async () => {
    const db = getDb();
    db.prepare(`DELETE FROM scraper_log WHERE ran_at < datetime('now', '-30 days')`).run();
  });

  logger.info('✅ Scheduler initialized (hourly cache flush, daily syncs)');
}

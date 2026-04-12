import sqlite3 from "sqlite3";
import { logger } from "../utils/logger.js";

const sqlite = sqlite3.verbose();
let db = null;

function openDb(path) {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(path, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export async function initDatabase() {
  const dbPath = process.env.SQLITE_PATH || "./data/fueltracker.db";
  await openDb(dbPath);

  await run(`PRAGMA journal_mode = WAL`);
  await run(`PRAGMA foreign_keys = ON`);

  await run(`
    CREATE TABLE IF NOT EXISTS stations (
      id          TEXT PRIMARY KEY,
      source      TEXT NOT NULL,
      country     TEXT NOT NULL,
      name        TEXT,
      brand       TEXT,
      street      TEXT,
      city        TEXT,
      postcode    TEXT,
      lat         REAL NOT NULL,
      lng         REAL NOT NULL,
      is_open     INTEGER DEFAULT 1,
      updated_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  await run(
    `CREATE INDEX IF NOT EXISTS idx_stations_latlon ON stations(lat, lng)`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_stations_country ON stations(country)`,
  );

  await run(`
    CREATE TABLE IF NOT EXISTS prices (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id  TEXT NOT NULL REFERENCES stations(id),
      fuel_type   TEXT NOT NULL,
      price       REAL NOT NULL,
      currency    TEXT DEFAULT 'EUR',
      source      TEXT,
      fetched_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  await run(
    `CREATE INDEX IF NOT EXISTS idx_prices_station ON prices(station_id)`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_prices_fuel    ON prices(fuel_type)`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_prices_fetched ON prices(fetched_at)`,
  );

  await run(`
    CREATE TABLE IF NOT EXISTS ev_stations (
      id              TEXT PRIMARY KEY,
      source          TEXT DEFAULT 'ocm',
      name            TEXT,
      operator        TEXT,
      lat             REAL NOT NULL,
      lng             REAL NOT NULL,
      country         TEXT,
      connection_types TEXT,
      max_kw          REAL,
      num_points      INTEGER DEFAULT 1,
      is_operational  INTEGER DEFAULT 1,
      updated_at      TEXT DEFAULT (datetime('now'))
    )
  `);

  await run(
    `CREATE INDEX IF NOT EXISTS idx_ev_latlon ON ev_stations(lat, lng)`,
  );

  await run(`
    CREATE TABLE IF NOT EXISTS scraper_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      source      TEXT NOT NULL,
      country     TEXT,
      status      TEXT,
      records     INTEGER DEFAULT 0,
      error_msg   TEXT,
      ran_at      TEXT DEFAULT (datetime('now'))
    )
  `);

  logger.info("✅ SQLite database initialized");
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database not initialized");
  return { run, all, get };
}

// ── Helper: Nearby stations (Haversine in JS) ──
export async function getStationsNear(
  lat,
  lng,
  radiusKm,
  country = null,
  limit = 50,
) {
  const countryFilter = country ? "AND s.country = ?" : "";
  const params = country ? [country] : [];

  const stations = await all(
    `SELECT s.*, s.lat as _lat, s.lng as _lon FROM stations s WHERE 1=1 ${countryFilter}`,
    params,
  );

  const results = [];
  for (const s of stations) {
    const dist = haversine(lat, lng, s._lat, s._lon);
    if (dist <= radiusKm) {
      const prices = await all(
        `SELECT fuel_type, price FROM prices WHERE station_id = ? ORDER BY fetched_at DESC LIMIT 1`,
        [s.id],
      );
      const pricesObj = {};
      prices.forEach((p) => (pricesObj[p.fuel_type] = p.price));
      results.push({ ...s, distance_km: dist, prices: pricesObj });
    }
  }

  results.sort((a, b) => a.distance_km - b.distance_km);
  return results.slice(0, limit);
}

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

// ── Upsert station ──────────────────────────────────────────
export async function upsertStation(station) {
  await run(
    `INSERT INTO stations (id, source, country, name, brand, street, city, postcode, lat, lng, is_open, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, brand=excluded.brand, is_open=excluded.is_open,
       updated_at=excluded.updated_at`,
    [
      station.id,
      station.source,
      station.country,
      station.name,
      station.brand,
      station.street,
      station.city,
      station.postcode,
      station.lat,
      station.lng,
      station.is_open,
    ],
  );
}

// ── Upsert price ────────────────────────────────────────────
export async function insertPrice(
  stationId,
  fuelType,
  price,
  currency = "EUR",
  source = null,
) {
  await run(
    `INSERT INTO prices (station_id, fuel_type, price, currency, source) VALUES (?, ?, ?, ?, ?)`,
    [stationId, fuelType, price, currency, source],
  );
}

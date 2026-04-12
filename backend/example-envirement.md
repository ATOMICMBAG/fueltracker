# ============================================================
# FuelTracker Backend — Environment Variables
# Copy to .env and fill in your values
# ============================================================

# Server
PORT=

NODE_ENV=production

# Tankerkönig API (kostenlos unter https://creativecommons.tankerkoenig.de)
TANKERKOENING_API_KEY=YOUR-TANKERKOENING-API-KEY

# Redis (Docker-intern: redis://redis:6379)
REDIS_URL=redis://redis:6379

# SQLite DB path
SQLITE_PATH=/data/fueltracker.db

# Scraper — Playwright headless
SCRAPER_TIMEOUT_MS=15000

# Cache TTL (Sekunden)
CACHE_TTL_LIVE=3600        # 1h für Live-APIs
CACHE_TTL_SCRAPER=21600    # 6h für gescrapte Daten
CACHE_TTL_OSM=86400        # 24h für OSM Stationsdaten

# Open Charge Map (EV) — kostenlos unter https://openchargemap.org/site/develop/api
OCM_API_KEY=YOUR-OCM-API-KEY

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

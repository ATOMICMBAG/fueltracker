// ============================================================
// FuelTracker Backend — server.js
// ============================================================
import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import compress from "@fastify/compress";
import { logger } from "./utils/logger.js";
import { initDatabase } from "./cache/database.js";
import { initRedis } from "./cache/redis.js";
import { startScheduler } from "./scheduler/index.js";
import stationsRouter from "./api/stations.js";
import pricesRouter from "./api/prices.js";
import evRouter from "./api/ev.js";

const app = Fastify({ logger: false });

// ── Plugins ──────────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET"],
});

await app.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
  timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || "60000"),
});

await app.register(compress);

// ── Health ────────────────────────────────────────────────────
app.get("/health", async () => ({ status: "ok", ts: Date.now() }));

// ── API Routes ────────────────────────────────────────────────
app.register(stationsRouter, { prefix: "/api/v1/stations" });
app.register(pricesRouter, { prefix: "/api/v1/prices" });
app.register(evRouter, { prefix: "/api/v1/ev" });

// ── Start ─────────────────────────────────────────────────────
async function start() {
  try {
    await initDatabase();
    await initRedis();
    await app.listen({
      port: parseInt(process.env.PORT || "3101"),
      host: "0.0.0.0",
    });
    startScheduler();
    logger.info(
      `🚀 FuelTracker backend running on port ${process.env.PORT || 3101}`,
    );
  } catch (err) {
    logger.error("Startup failed:", err);
    process.exit(1);
  }
}

start();

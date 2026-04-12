// ============================================================
// cache/redis.js — Redis wrapper with graceful fallback
// ============================================================
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

let redis = null;

export async function initRedis() {
  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    await redis.connect();
    logger.info('✅ Redis connected');
  } catch (err) {
    logger.warn('⚠️  Redis unavailable, running without cache:', err.message);
    redis = null;
  }
}

export async function cacheGet(key) {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

export async function cacheSet(key, value, ttlSeconds) {
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.warn(`Cache set failed for ${key}:`, err.message);
  }
}

export async function cacheDel(pattern) {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  } catch (err) {
    logger.warn('Cache delete failed:', err.message);
  }
}

export function getRedis() { return redis; }

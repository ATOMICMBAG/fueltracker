// ============================================================
// api/ev.js — EV Ladesäulen Endpunkte
// ============================================================
import { searchEVNearby } from '../scrapers/ev-ocm.js';
import { z } from 'zod';

const schema = z.object({
  lat:    z.coerce.number().min(-90).max(90),
  lng:    z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50).default(15),
  minKw:  z.coerce.number().optional(),
  limit:  z.coerce.number().min(1).max(100).default(20),
});

export default async function evRouter(app) {
  app.get('/nearby', async (req, reply) => {
    const parse = schema.safeParse(req.query);
    if (!parse.success) return reply.code(400).send({ error: 'Invalid parameters' });

    const { lat, lng, radius, minKw, limit } = parse.data;
    let stations = await searchEVNearby(lat, lng, radius, limit * 2);

    if (minKw) stations = stations.filter(s => s.maxKw && s.maxKw >= minKw);
    stations.sort((a, b) => (a.dist || 0) - (b.dist || 0));

    return { count: Math.min(stations.length, limit), stations: stations.slice(0, limit) };
  });
}

// ============================================================
// utils/logger.js
// ============================================================
// (Inlined here for brevity — also at src/utils/logger.js)

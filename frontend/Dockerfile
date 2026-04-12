# ── Build Stage ─────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Serve Stage (Node.js-basierter statischer Server) ───────
FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3102
CMD ["serve", "-s", "dist", "-l", "3102"]
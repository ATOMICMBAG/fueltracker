FROM node:20-slim

# Playwright dependencies
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates libnss3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev
RUN npx playwright install chromium

COPY src ./src

# Data directory for SQLite + logs
RUN mkdir -p /data/logs && chmod 777 /data

ENV NODE_ENV=production

EXPOSE 3101

CMD ["node", "src/server.js"]

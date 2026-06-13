FROM node:20-slim

# OpenSSL pour Prisma + Chromium (rendu PDF de l'audit via puppeteer-core).
# Chromium est installé AVEC ses recommends pour garantir toutes ses libs runtime.
RUN apt-get update && apt-get install -y \
    openssl \
    chromium \
    fonts-liberation \
    fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# Copier les fichiers nécessaires
COPY package*.json ./
COPY prisma ./prisma/
COPY ingestion ./ingestion/
COPY scoring ./scoring/
COPY optimization ./optimization/
COPY enrichment ./enrichment/
COPY ai ./ai/
COPY email ./email/
COPY config ./config/
COPY domains ./domains/
COPY lib ./lib/
COPY rules ./rules/
COPY routes ./routes/
COPY performance ./performance/
COPY utils ./utils/
COPY scripts ./scripts/
COPY instrument.js ./
COPY server-minimal.js ./

# Installer les dépendances depuis le lockfile pour produire des images reproductibles.
RUN npm ci --no-audit --no-fund && npm cache clean --force

# Générer le client Prisma
RUN npx prisma generate --schema=./prisma/schema.prisma

# Ne PAS supprimer les dépendances de dev car Prisma en a besoin en production

# Créer un utilisateur non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "server-minimal.js"]

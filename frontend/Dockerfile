FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps && npm cache clean --force

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Requis au build pour les usages SSR/server-only de l'API backend.
ARG BACKEND_API_URL=https://feedplug-backend-marketing-771607738477.europe-west1.run.app
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=771607738477-iam4qts7ch3sn9do88djdkohvpj0f4a9.apps.googleusercontent.com
# Cloudflare Turnstile (anti-bot sur les formulaires marketing). Clé publique.
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAADTQDHlvHFctmhiJ
# Shopify App Bridge a besoin de la clé publique au build pour la baker dans le
# bundle JS (lue par <ShopifyEmbeddedBridge /> et useAppBridge()).
ARG NEXT_PUBLIC_SHOPIFY_API_KEY=
# Sentry frontend : le DSN doit être baked au build (NEXT_PUBLIC inliné dans le
# bundle), sinon sentry.client.config s'auto-désactive (enabled=!!DSN) → aucune
# remontée d'erreur JS/SSR en prod.
ARG NEXT_PUBLIC_SENTRY_DSN=
# Rehoming domaine : base canonique du marketing B2B (pro.feedplug.com). Lue
# côté serveur par seo.ts/sitemap.ts/robots ; bakée au build pour que les
# métadonnées statiques (canonicals/hreflang/sitemap) pointent vers pro.
ARG NEXT_PUBLIC_MARKETING_URL=https://pro.feedplug.com
ENV BACKEND_API_URL=$BACKEND_API_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_SHOPIFY_API_KEY=$NEXT_PUBLIC_SHOPIFY_API_KEY
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_MARKETING_URL=$NEXT_PUBLIC_MARKETING_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
COPY --from=builder /app .
EXPOSE 3000
# Utilise le start custom qui respecte PORT (start.js déjà présent dans le repo)
CMD ["node", "start.cjs"]



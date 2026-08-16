# syntax=docker/dockerfile:1
#
# Image Docker pour FindIt (Next.js 14 / App Router).
# Build multi-étapes : dépendances -> build -> exécution.
#
# Remarque : next.config.mjs n'active pas la sortie "standalone" (le
# fichier n'est pas modifié dans le cadre de ce packaging), donc l'étape
# finale embarque node_modules en entier plutôt qu'un bundle réduit.
# Piste d'optimisation possible plus tard, hors périmètre ici.

FROM node:20-bookworm-slim AS base
WORKDIR /app

# --- Étape 1 : installation des dépendances (dev incluses, nécessaires
# au build : TypeScript, Tailwind, PostCSS...) ---
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

# --- Étape 2 : build de l'application ---
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Étape 3 : image d'exécution ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# DATA_DIR pointe vers le volume monté par docker-compose.yml.
ENV DATA_DIR=/app/data

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Dossier de données : créé ici pour que le volume ait un point
# d'attache même avant tout montage, et pour poser les droits du
# compte non privilégié utilisé pour lancer l'application.
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["npm", "run", "start"]

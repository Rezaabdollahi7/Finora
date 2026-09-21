# syntax=docker/dockerfile:1

###############################################################################
# base — shared Node runtime
###############################################################################
FROM node:22-alpine AS base
# Prisma's engines are built against glibc symbols that musl provides via
# libc6-compat; OpenSSL is required for the query engine to start.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

###############################################################################
# deps — install node_modules from the lockfile only
###############################################################################
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

###############################################################################
# dev — hot-reloading development server (used by docker-compose.yml)
###############################################################################
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

###############################################################################
# builder — produce the standalone production bundle
###############################################################################
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

###############################################################################
# runner — minimal production image
###############################################################################
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# `output: "standalone"` emits a server bundle with only the modules it
# actually uses, so no node_modules layer is shipped here.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

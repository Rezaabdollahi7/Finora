# syntax=docker/dockerfile:1

###############################################################################
# base — shared Node runtime
###############################################################################
FROM node:22-alpine AS base
# Prisma 7 reaches PostgreSQL through the pg driver adapter rather than a
# native query engine, so no glibc shim or OpenSSL package is needed here.
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

###############################################################################
# deps — install node_modules from the lockfile only
###############################################################################
FROM base AS deps
COPY package.json package-lock.json ./
# The postinstall hook runs `prisma generate`, which needs a schema that has
# not been copied yet; later stages generate the client explicitly.
RUN npm ci --ignore-scripts

###############################################################################
# dev — hot-reloading development server (used by docker-compose.yml)
###############################################################################
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
EXPOSE 3000
# The entrypoint re-reconciles node_modules and regenerates the Prisma client
# against the mounted source before handing over; see docker/dev-entrypoint.sh.
# Invoked through sh rather than relying on the executable bit, which a bind
# mount from a Windows host does not preserve.
ENTRYPOINT ["sh", "/app/docker/dev-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

###############################################################################
# builder — produce the standalone production bundle
###############################################################################
FROM base AS builder
ENV NODE_ENV=production
# Opt in to the standalone server bundle; see next.config.ts.
ENV BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `npm run build` runs `prisma generate` before `next build`.
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

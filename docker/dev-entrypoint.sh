#!/bin/sh
set -e

# Development container start-up.
#
# Four things have to be reconciled on every start, because the container's
# filesystem is a mix of image layers, an anonymous volume and a bind mount
# of the host's working tree, and because the database outlives all of them.
#
#   node_modules lives in an anonymous volume so the host's copy cannot
#   shadow it. That volume survives `docker compose up --build`, so an image
#   rebuilt after a dependency was added would still run against the old
#   tree. Reconciling against the lockfile fixes that; it is a no-op when
#   nothing changed. --no-save keeps it from rewriting the lockfile into the
#   bind-mounted source tree.
#
#   The Prisma client is generated code, not source, so it is gitignored and
#   absent from the host. Generating it here keeps it correct after a schema
#   change too.
#
#   The database is a named volume and survives everything. Pulling a branch
#   that added a migration therefore leaves a schema older than the code, and
#   every page touching the new tables answers 500. `migrate deploy` applies
#   what is pending and does nothing when there is nothing; it never resets,
#   so it cannot take data with it. Failing here is deliberate: a container
#   that starts against the wrong schema is worse than one that refuses to.
#
#   Seed data is reference data — the category tree — and the seed is
#   idempotent, reporting what was already there. A failure is not fatal:
#   the application runs without the newest categories, and stopping the
#   container over them would be out of proportion.

echo "› reconciling dependencies"
npm install --no-save --no-audit --no-fund

echo "› generating the Prisma client"
npx prisma generate

echo "› applying pending migrations"
npx prisma migrate deploy

echo "› seeding reference data"
npm run db:seed || echo "  ! seeding failed; the application will still start"

exec "$@"

#!/bin/sh
set -e

# Development container start-up.
#
# Two things have to be reconciled on every start, because the container's
# filesystem is a mix of image layers, an anonymous volume and a bind mount
# of the host's working tree:
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

echo "› reconciling dependencies"
npm install --no-save --no-audit --no-fund

echo "› generating the Prisma client"
npx prisma generate

exec "$@"

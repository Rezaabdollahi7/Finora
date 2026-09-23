# Running Finora

Everything needed to run Finora for real, and everything the Sprint 8 audits
found. Written for the person who has to keep it working, which for a
self-hosted household tool is the same person who uses it.

---

## What Finora is, for security purposes

**Finora has no authentication and no authorization.** Anyone who can reach
the port has full read and write access to every household record.

This is deliberate and it is the single most important thing on this page.
The roadmap models ownership as an `owner` field (a household member or
Shared) rather than a login, and never asks for a login — Sprint 8 asks for
authentication to be *reviewed*, which is what this section is. Adding
accounts would mean a user table, sessions, password storage and a recovery
path, none of which the household asked for and all of which would be
security surface that does not exist today.

So the boundary is the network, not the application. Run it one of these ways
and not otherwise:

- **On the household's own machine**, published to `127.0.0.1` only.
- **On a home server behind a VPN** (WireGuard, Tailscale), reachable only
  from devices the household controls.
- **Behind a reverse proxy that authenticates**, such as Caddy with
  `basic_auth`, or an identity-aware proxy.

Do **not** publish it to the open internet. `docker-compose.prod.yml`
publishes on `${APP_PORT}`; bind it to `127.0.0.1:${APP_PORT}` unless one of
the above is in front of it.

What the audit did confirm, in the application itself:

| Checked | Result |
| --- | --- |
| Raw SQL | None. Every query goes through Prisma's query builder, which parameterises. |
| Input validation | Every route that reads a body parses it with a Zod schema. |
| Error leakage | `handleApiError` logs the real error and returns a fixed Persian message; no stack trace or SQL fragment reaches the browser. |
| `dangerouslySetInnerHTML`, `eval` | None. |
| Secrets in source | None. `.env*` is git-ignored; the repository carries only `.env.example`. |
| Environment variables | Two: `DATABASE_URL` and the optional `PRISMA_QUERY_COUNTER`. |
| CSV injection | Export prefixes any cell starting with `=`, `+`, `-` or `@` with a quote, so a spreadsheet cannot execute an exported ledger. |

---

## Environment variables

| Variable | Used by | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | Prisma, at build and at run time | PostgreSQL connection string. Inside Compose the host is the service name `db`; outside it, `localhost:${POSTGRES_PORT}`. |
| `PRISMA_QUERY_COUNTER` | the test suite | `1` turns on the query counter the performance tests assert against. Leave it unset in production; it costs nothing when off. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | the `db` container | Credentials the database is created with. Change the password before any deployment reachable by more than one machine. |
| `POSTGRES_PORT` | Compose | Host port the database is published on. |
| `APP_PORT` | Compose | Host port the application is published on. |

`cp .env.example .env` and edit. Nothing else is read from the environment.

---

## Running it

```bash
cp .env.example .env
docker compose up          # development: hot reload, migrations applied on start
docker compose -f docker-compose.prod.yml up -d --build   # production image
```

The development entrypoint runs `npm install`, `prisma generate`,
`prisma migrate deploy` and the category seed, in that order. The migration
step is fatal if it fails — a container that starts against an out-of-date
schema fails later and less clearly.

For a production deployment, migrations are **not** applied automatically:

```bash
docker compose -f docker-compose.prod.yml run --rm app npm run db:deploy
```

Run it before starting the new image. It is idempotent.

---

## Backups

The whole of Finora's state is one PostgreSQL database. There is no file
storage, no cache to warm and no external service holding anything.

**Taking a backup**

```bash
docker compose exec -T db pg_dump -U finora -d finora --format=custom \
  > "finora-$(date +%F).dump"
```

`--format=custom` rather than plain SQL: it compresses, and it restores
selectively if one table ever needs to come back on its own.

**Restoring**

```bash
docker compose exec -T db pg_restore -U finora -d finora --clean --if-exists \
  < finora-2026-09-22.dump
```

**How often.** A household's ledger changes a few times a week, and losing a
week of it means re-entering a week of receipts nobody kept. Daily is
generous; weekly is the floor. Automate it with a cron entry on the host:

```cron
0 3 * * * cd /srv/finora && docker compose exec -T db pg_dump -U finora -d finora --format=custom > /backups/finora-$(date +\%F).dump
```

**Test the restore.** A backup nobody has restored is a file, not a backup.
Restore into a scratch database once, and check that the transaction count on
the Settings page matches.

---

## Health

- **Application logs**: `docker compose logs -f app`. Unhandled API errors are
  logged there with their real stack, prefixed `Unhandled API error:`.
- **Database**: the `db` service has a `pg_isready` healthcheck; the app waits
  on it before starting.
- **What is in the database**: the Settings page shows counts for every table
  and the date range of the transactions, which is the fastest way to tell
  whether a restore landed.

---

## Audit findings that were accepted rather than fixed

Two, both recorded here rather than quietly left:

**Calendar day cells are 31×56 at a 320px viewport.** A seven-column month
grid cannot be wider at that width without horizontal scrolling, which is a
worse trade. 31×56 passes WCAG 2.5.8 (AA, 24×24) and falls short only of the
2.5.5 AAA guidance of 44×44. At 390px and above the cells are comfortable.

**Categories have no screen of their own.** They are seeded, served by
`/api/categories` with full CRUD, and selectable everywhere they are used —
but there is no page to rename or add one from. The roadmap's final structure
does not list a Categories section, so this is a gap by design rather than an
oversight, and the Settings page says so.

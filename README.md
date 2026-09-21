# Finora

**Smart Finances, Better Business** — a Persian-first personal and household
finance manager built for a two-person household.

Finora tracks where money is, how it moves, and where it is heading: accounts
and wallets, income and expenses, transfers, assets and liabilities, loans and
installments, recurring payments, monthly budgets, financial goals, net worth,
and cash-flow forecasting — all on the Jalali calendar, fully right-to-left,
in light and dark themes.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · shadcn/ui ·
Prisma · PostgreSQL · Recharts · Docker

## Getting started

```bash
cp .env.example .env
docker compose up
```

The application is served at <http://localhost:3000> and PostgreSQL at
`localhost:5432`.

To run against a local Node toolchain instead:

```bash
npm install
npm run dev
```

## Scripts

| Script              | Purpose                        |
| ------------------- | ------------------------------ |
| `npm run dev`       | Development server             |
| `npm run build`     | Production build               |
| `npm run start`     | Serve the production build     |
| `npm run lint`      | ESLint                         |
| `npm run typecheck` | TypeScript, no emit            |
| `npm run format`    | Prettier                       |
| `npm run test`      | Unit tests                     |
| `npm run db:seed`   | Seed the default categories    |
| `npm run acceptance`| Foundation acceptance checks   |

## Verifying the foundation

`npm run acceptance` exercises the whole stack against a running build:
compose configuration, the database migration, Prisma connectivity, all ten
routes, RTL and the Persian font, the responsive breakpoints, both themes, and
a clean browser console.

```bash
npm run build
npm run start          # in one terminal
npm run acceptance     # in another
```

It reads `BASE_URL` (default `http://localhost:3000`) and `CHROMIUM_PATH` if
the Playwright browser lives outside the default location.

## Troubleshooting

**`port is already allocated`** — something else on the machine is using 5432
or 3000, usually a locally installed PostgreSQL. Change the host port in
`.env` and bring the stack back up; only the published port moves, and the app
still reaches the database as `db:5432` over the compose network.

```bash
POSTGRES_PORT=5433
APP_PORT=3001
```

**`Can't resolve '@/generated/prisma/client'` or `tsx: not found` in Docker** —
the container start-up reconciles both of these, so the first fix is simply to
recreate the container:

```bash
docker compose up --build --force-recreate
```

If it persists, the anonymous volumes are stale; `docker compose down -v`
removes them along with the database, so re-run the migration and the seed
afterwards.

**Outside Docker**, the Prisma client is created by `npm install`'s
postinstall hook. After pulling a schema change, run `npm run db:generate`.

## Documentation

- [`SPRINTS.md`](./SPRINTS.md) — implementation roadmap
- [`CLAUDE.md`](./CLAUDE.md) — project rules
- [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) — visual language
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — technical decisions

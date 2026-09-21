# Architecture

## Why Next.js rather than a standalone React SPA

The roadmap asks for a React + TypeScript front end, Prisma against
PostgreSQL, and CRUD **APIs** for accounts and transactions. A browser-only
SPA cannot run Prisma, so a server is required either way. Next.js App Router
keeps both halves in one project, one build and one container:

- Prisma runs inside route handlers and server components, never in the browser.
- The dashboard aggregates on the server, which is what task 2.10 asks for
  ("avoid loading all transactions into the browser just to calculate totals").
- The `src/app/` layout named in task 0.7 is the App Router's own convention.
- shadcn/ui targets this stack directly.

## Money

Monetary values are integers, never floats (rule G.2).

- **Storage** — `BigInt` columns holding whole **Rial**.
- **Transport / logic** — `bigint` in TypeScript.
- **Display** — converted to **Toman** at the presentation layer only.

Rial is the smallest unit in circulation and carries no sub-unit, so integer
Rial is exact. Arithmetic on `bigint` cannot lose precision the way `number`
can, and `Prisma.Decimal` is avoided because it invites accidental `Number()`
conversions.

Because JSON cannot carry `bigint`, monetary values cross the wire as decimal
strings and are parsed back at the boundary.

## Dates

- **Storage** — `DateTime` in UTC (Gregorian).
- **Display** — Jalali, formatted through a single conversion layer.

No Jalali value is ever written to the database, and no raw timestamp is ever
shown to the user (rule G.5).

## Folder layout

```text
src/
├── app/            # routes, layouts, route handlers
├── components/
│   ├── ui/         # shadcn/ui primitives
│   ├── charts/     # Recharts wrappers
│   ├── forms/      # form building blocks
│   └── common/     # shared composites
├── features/       # one folder per domain: dashboard, accounts, ...
├── lib/            # cross-cutting infrastructure (prisma, utils)
├── hooks/
├── utils/          # pure helpers: money, dates, numbers
├── types/
└── config/         # navigation, constants, runtime env
```

A feature folder owns its own components, server logic and types. Features do
not import from one another; anything shared moves up into `components/`,
`lib/` or `utils/`.

## Authentication

The roadmap lists authentication in the Sprint 8 audits but gives it no task of
its own, and record ownership is modelled as an `owner` field
(Reza / Yeganeh / Shared) rather than a user table. Finora is therefore built
as a self-hosted household deployment, with authentication deferred to
Sprint 8.

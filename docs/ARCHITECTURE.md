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

## Quantities

A quantity is not money, but it is multiplied by money — 18.5 grams of gold
at 68,400,000 Rial a gram — so a float quantity would poison every value
derived from it. Quantities follow the same rule as money.

- **Storage / logic** — `BigInt` scaled by 10^8 (`utils/quantity`).
- **Display** — the scale is divided out, trailing zeros dropped.

Eight decimal places is set by the smallest thing a household can hold: one
satoshi. Grams of gold, whole shares and units of foreign currency all fit
inside it.

`multiplyByQuantity` is the one place the two scales meet, so it is the one
place rounding happens — half away from zero, the rule a person doing this by
hand uses.

## Values that change over time

Anything whose value moves is stored as a series of facts, never as a current
figure on the row:

- An account has **no balance column**. The balance is
  `initialBalance + sum(transactions)`.
- An asset has **no current-value column**. Its value is the latest row in
  `asset_valuations`, and re-pricing appends a row rather than updating one.

The reason is the same in both cases. A stored current value is a second
source of truth that goes wrong the moment something is back-dated, edited or
filled in late, and reconciling it is a class of bug this application cannot
afford. Deriving is safe precisely because the inputs are themselves dated: a
transaction carries the day the money moved, and a valuation is a fact about
one instant that nothing later touches.

That is what makes history honest (rule G.4). Re-running the net-worth chart
for last Farvardin gives what last Farvardin gave, because today's gold price
was written as today's row and did not overwrite Farvardin's.

Each valuation stores the quantity and the total it was taken against, so
selling half a holding tomorrow cannot re-value yesterday.

## Net worth

```text
net worth = assets + account balances − liabilities
```

Nothing is counted twice, and that is structural rather than a rule someone
has to remember: `AssetType` has no cash or bank member, so money sitting in
an account cannot also be registered as an asset. Foreign currency is an
asset precisely because the ledger is Rial-only (see `Account.currency`) and
it has nowhere else to live.

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
│   ├── layout/     # application chrome (sidebar, header, theme)
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

### Boundaries

A feature folder owns its own components, server logic, schemas and types:

```text
features/<domain>/
├── components/
├── server/
├── schemas.ts
└── types.ts
```

Three rules keep the tree from collapsing into a ball of mud as the sprints
add domains:

1. **Features do not import from one another.** Something two domains both
   need is not domain logic; it moves up into `components/`, `lib/`,
   `utils/`, `hooks/` or `types/`.
2. **Routes stay thin.** A file under `src/app/` resolves its params, calls
   into a feature, and renders. Business logic never lives in a route file —
   which is also what keeps it testable without a browser (rule G.11).
3. **The dependency direction is one-way.** `app/` may use `features/`;
   `features/` may use `components/`, `lib/`, `utils/`, `hooks/`, `types/`
   and `config/`; those shared layers never reach back up.

`src/generated/` holds the Prisma client and is not committed.

The domains match the roadmap: dashboard, accounts, transactions, assets,
loans, budgets, goals, calendar, reports. Each exists as a folder from
Sprint 0 so later sprints add files rather than invent placement.

## Pages that read the database

A Prisma call is not one of Next's dynamic APIs, so a page that only awaits a
database query is still prerendered at build time. The build output marks it
`○ (Static)` and it then serves whatever the data looked like when the image
was built, silently, while the API next to it returns the truth.

Every page that reads the database therefore declares:

```ts
export const dynamic = "force-dynamic";
```

Routes with dynamic params (`/accounts/[id]`) and route handlers are already
dynamic and need nothing. When adding a page, check the build output: a route
that reads data and shows `○` is a bug.

## Authentication

The roadmap lists authentication in the Sprint 8 audits but gives it no task of
its own, and record ownership is modelled as an `owner` field
(Reza / Yeganeh / Shared) rather than a user table. Finora is therefore built
as a self-hosted household deployment, with authentication deferred to
Sprint 8.

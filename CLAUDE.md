# Finora — Project Rules

Finora is a Persian-first personal and household finance application for a
two-person household (Reza, Yeganeh, and Shared).

Companion documents:

- `SPRINTS.md` — the implementation roadmap, sprint by sprint.
- `docs/DESIGN_SYSTEM.md` — the visual language and design tokens.
- `docs/ARCHITECTURE.md` — technical decisions and folder layout.
- `docs/OPERATIONS.md` — running it, backups, and what the Sprint 8 audits
  found (including the fact that there is no authentication).

---

## Stack

| Concern    | Choice                                  |
| ---------- | --------------------------------------- |
| Framework  | Next.js (App Router) + React + TypeScript |
| Styling    | Tailwind CSS v4 with CSS-variable tokens |
| Components | shadcn/ui (Radix primitives)             |
| Database   | PostgreSQL via Prisma                    |
| Charts     | Recharts (single charting library)       |
| Icons      | Lucide (single icon library)             |
| Runtime    | Docker Compose (app + postgres)          |

---

## Commands

```bash
npm run dev         # development server
npm run build       # production build
npm run start       # serve the production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run format      # Prettier write
npm run test        # unit tests
```

Every task must leave `lint`, `typecheck`, `test` and `build` passing.

---

## Global rules

These apply to every task in every sprint.

### G.1 — Do not break existing functionality

Understand the current implementation and its dependencies first, make the
smallest safe change, then re-run the relevant tests plus typecheck, lint and
build.

### G.2 — Financial precision

Never use JavaScript floating-point numbers for monetary values.

Money is stored as an **integer number of Rial** (`BigInt` in Prisma,
`bigint` in TypeScript) and rendered in Toman at the presentation layer. No
monetary value ever passes through a `number`.

### G.3 — Transfers are not expenses

A transfer between two household accounts must never increase income, increase
expenses, or change net worth.

### G.4 — Historical data must remain historical

Changing today's asset price must not rewrite past portfolio values. Renaming a
category must not destroy transaction history. Editing a loan must not silently
rewrite already-paid installments.

### G.5 — Persian calendar

Dates are stored as Gregorian UTC timestamps and displayed as Jalali. Jalali
values never reach the database, and database timestamps never reach the user
unconverted.

### G.6 — RTL-first

The UI is designed for RTL, not retrofitted with `direction: rtl`. Use logical
CSS properties (`margin-inline-start`, `padding-inline-end`, `start-0`, `ms-*`,
`pe-*`) rather than hard-coded left/right.

### G.7 — Design system

Follow the tokens in `docs/DESIGN_SYSTEM.md`. Reuse shadcn/ui components. No
arbitrary colors, border radii, shadows or spacing values. Do not duplicate a
component that already exists.

### G.8 — Charts

Recharts everywhere. Charts must be minimal, responsive, interactive,
RTL-aware, and consistent with the design system.

### G.9 — Empty / loading / error states

Every major feature implements all four of loading, empty, error and success. A
page that only works with populated data is not finished.

### G.10 — Mobile-first behaviour

Every feature must be usable on a phone. Desktop tables become scrollable
tables or card lists. Never force the user to zoom.

### G.11 — Tests before completion

A working UI is not a completed task. The business logic behind it must be
tested.

### G.12 — Do not implement future sprints

Implement only the requested task plus the minimum supporting code it needs.

---

## Sprint completion

A task moves to `[x]` in `SPRINTS.md` only after implementation, tests,
typecheck, lint, build and manual verification all pass — never on the strength
of written code alone.

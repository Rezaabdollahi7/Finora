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

## Schedules

A loan's instalments are **Jalali monthly**. A household that owes on the
fifth owes on the fifth of Mehr and the fifth of Aban — not every thirty
days, and not on a Gregorian date that drifts through the Persian month.

Two rules follow, both in `features/loans/schedule.ts`:

- A payment day the month is too short for takes that month's **last day**
  rather than spilling into the next one, which would put two instalments in
  one month and none in another.
- Each month clamps from the loan's own payment day, never from the previous
  month's result, so one short Esfand cannot drag every later date earlier.

Instalments are generated once, when the loan is created, and are **records
rather than a projection**: each can be paid, and a paid one has a date and
an amount of its own. Editing a loan regenerates only what is still owed
(rule G.4).

## Rules that produce records

A loan's instalments and a recurring payment's occurrences are the same idea
seen from opposite ends, and they are stored differently for one reason: a
loan is **finite** and a recurring payment is **open-ended**.

A loan has sixty instalments and then it is finished, so all sixty are
written when the loan is created. A recurring payment has no last month, so
its future dates are **derived from the rule on read** and only become rows
when they are paid — `features/recurring/recurrence.ts` generates dates for a
window, and the generator seeks to the window rather than counting up to it,
so asking about a month ten years out costs the same as asking about this
one.

Once a date has a row, the row wins. A paid occurrence keeps the date and the
amount it actually had, and an edited rule cannot rewrite it (rule G.4): a
rent that went up in Mehr did not retroactively cost more in Mordad. A paid
occurrence also stays visible even when the edited rule no longer produces
its date, because a payment that really happened must not disappear from the
history.

## Budgets are windows

A budget is stored as a **window** — `fromMonth`, an optional `toMonth`, and
the amount that applied between them — not as an amount on a category.
Raising the food budget in Mehr closes the old window at Shahrivar and opens
a new one, so asking what the budget was in Mordad still answers with
Mordad's figure. A single mutable amount would rewrite every past month the
moment the household changed its mind, which is rule G.4 again.

Months are stored as the single integer `absoluteJalaliMonth` produces
(`year * 12 + month - 1`), so "which budget was in force in Mehr" is one
indexed range query and nothing more.

A parent's budget covers what its children spend — "food: 25M" has to mean
the restaurants inside it, or the limit is met by filing every dinner one
level down — and the month's total then counts a child once rather than once
per budgeted ancestor.

Rollover carries a **surplus and never a deficit**. Carrying a deficit would
quietly shrink next month's budget for a reason invisible inside next month.

Spending is bucketed into Jalali months in TypeScript rather than in SQL.
Postgres has no Persian calendar, and pushing one into a query puts the month
boundary a few hours out twice a year.

## Saving is not spending

A goal contribution is **not a transaction**, and that is the point. It
records that some of what the household already has is spoken for; it does
not move money. Filing it as an expense would make saving look like spending
and would cut net worth every time the household put something aside — the
same mistake rule G.3 forbids for transfers.

A household that also moves the money between accounts records that as a
TRANSFER, separately. The two are independent on purpose: money can be
earmarked without moving, and moved without being earmarked.

Taking money back out is its own row with `isWithdrawal` set, so the history
reads as what happened rather than as a contribution that quietly shrank. The
sign lives in that flag, never in the number (rule G.2). A goal has no
`currentAmount` column, for the reason Account has no balance.

A goal completes itself when its contributions reach the target, but never
reopens itself. The household can mark a goal finished below its target —
deciding the holiday fund is enough at 80% is a real decision — and a sync
that also demoted would undo that silently on the next contribution.
Reopening is deliberate, by hand.

## What a forecast can honestly claim

The cash-flow forecast carries each month's closing balance into the next
month's opening. A month that only just holds up matters because of what it
leaves the month after it, and computing every month from today's balance
would miss a run of small losses entirely.

Three things it does that are decisions rather than sums:

**Income is an estimate**, because nothing in the ledger says what next month
will bring. It is the **median** of what the household actually earned, not
the mean: one bonus month would otherwise inflate every future month by a
twelfth of that bonus, and a forecast that quietly overstates income is worse
than no forecast.

**The month in progress is counted as what is left of it.** Its income and
its spending so far are already in the opening balance, so the projection
subtracts them — otherwise a salary paid on the first is counted again on the
thirty-first, and the forecast climbs through a month that is nearly over.

**Budgets and recurring payments overlap.** The rent is a recurring payment
*and* sits inside a budgeted housing category, so each budget is reduced by
the recurring payments filed under it, floored at zero. An under-set budget
cannot become a credit against the rent.

Only balances that could actually be spent open the forecast — bank, cash and
wallet. An investment account would have to be liquidated first and a business
account is not the household's to spend; counting either would turn a real
shortfall into a comfortable balance, which is what the feature exists to
prevent.

The week-ahead warning is measured against real dated obligations rather than
a slice of the monthly forecast, because they answer different questions: a
month can close comfortably and still have a week where the rent, an
instalment and a bill all land before payday.

## Household members

The people in the household are rows in `members`, added, renamed and removed
by the household itself in Settings. Nobody is built in: a fresh install has
no members, every record is filed under `"SHARED"`, and owner pickers,
owner filters and per-person views stay hidden until someone is added.

`owner` on every model is a text column holding `"SHARED"` or a member id,
not a foreign key: "shared" is not a person, and a nullable key would make
every ownership question a null check. Integrity is kept in
`features/members/server/member-service.ts` from both ends — every write that
sets an owner calls `assertOwner`, and a member who still owns records cannot
be deleted (rename instead). The layout reads the member list once per
request and hands it to client components through `MembersProvider`.

The migration that introduced this (`20260923090000_household_members`)
converts the old enum values to text and creates a member for each former
enum value that still owns something, so existing data keeps its owners.

## Two owners, and they mean different things

A transaction carries **two** owners, and confusing them is the easiest
mistake in this codebase to make.

`transaction.owner` says whose record it is: a household cost or one person's.
The owner of the **account** says whose pocket the money came out of. A
shared rent paid from one person's account is `owner: SHARED` on that
person's account, and it takes both facts to say that the household spent it
and they provided it.

Every model carries an owner, Budget included since Sprint 7. A budget
measures one owner's spending: the household's food budget counts household
food and a person's own budget counts theirs, which is what keeps a gadget
someone bought for themselves out of the household's limit. The "one open window per
category" rule is therefore per category **and** owner, so the household and
a person can budget the same category at once.

### What a contribution means

Money that left that person's own pocket for the household's benefit, by two
routes:

- **direct** — a household expense paid straight from their own account.
- **pooled** — a transfer from their own account into a shared one.

A household expense paid *from a shared account* credits nobody: that money
was already pooled, and counting it again would credit whoever pressed the
button for money both people had put in. Income is not a contribution either
— a household where one person earns more but the other pays the rent would
otherwise read backwards.

None of it is a score. Nothing ranks, sorts by size, or computes a share, and
the panel says so on screen.

### What a person kept

`totals.savings` is income minus that person's *own* spending, and it is not
what they kept: a shared cost paid from their account is filed under the
household, correctly, so it never appears in their expense column. `retained`
subtracts their contribution as well, and it is what the personal view shows.
The difference is not small — 41M against 13M in a month with one rent
payment.

## Reports read once, not once per report

Every breakdown on the reports screen — by month, owner, category and account,
for income and spending alike — folds out of a **single scan** of the window.
Six reports each running their own query would be six scans of the same rows,
and the bucketing has to happen in TypeScript anyway because the months are
Jalali and PostgreSQL has no Persian calendar.

The same applies to the series that back the charts: the cash balance for
twelve months is one query carried forward, not twelve. There are tests that
assert the query count does not move when the range grows from one month to
twenty-four — a report that ran one query per month would pass every
correctness test and still be unusable at two years.

Three figures the roadmap words loosely and the code had to decide:

- **A savings rate with no income is `null`, not zero.** A household that
  earned nothing did not save 0% of anything.
- **A change against nothing has no ratio.** Zero to something is not an
  infinite improvement, and JSON cannot carry `Infinity` anyway. A debt
  shrinking from −100M to −50M reads as a 50% improvement, because the ratio
  is taken against the magnitude it started at.
- **A trend has a dead band.** Under a twentieth either way is flat;
  otherwise a household whose grocery bill moved by a thousand Toman sees an
  arrow every month and learns to ignore all of them.

Category analysis carries a figure, a share, a previous and a direction, and
nothing else. No grade, no rating, no adjective — the roadmap asks for factual
observations rather than subjective scores, and whether spending more on food
than last month is *good* is not something a ledger can know.

## Notifications are derived, not stored

The notification centre recomputes on every read. Most of what it reports
changes with nothing but the passage of time — an upcoming instalment becomes
due and then overdue while the application sits idle — so a notifications
table would be wrong by morning and would need a scheduled job to keep it
honest. That is the same reasoning that keeps an instalment's status out of
the database.

Nothing is sent anywhere. "Notification" here means a list the household reads
when it opens the application, which is what a self-hosted tool with no
accounts and no addresses can honestly offer.

## RTL scroll containers overflow where nothing can reach

Twice in Sprint 8 the same browser behaviour produced a bug, and it is worth
stating once. In an RTL scroll container the overflow runs **left**, and left
overflow is unreachable: the container scrolls, but the overflowing width also
propagates to the viewport and the whole page gains a horizontal scrollbar.

- A 567px table in a 308px box dragged the document 202px wide on a 390px
  phone. Clipping the card, clipping the wrapper and `overflow-clip` all left
  it at exactly 202. The fix is `dir="ltr"` on the scroll container with the
  table itself back in `rtl`, which sends the overflow right where it is
  contained — and a sticky first column, because the labels would otherwise
  be at whichever end the container does not open on.
- A strip of eight tabs put its last tab at x=−233, reachable by nothing.
  There the fix is not to scroll at all: `TabsList` wraps, which it only does
  when there is no room.

## States that depend on the clock

An instalment's `UPCOMING` / `DUE` / `OVERDUE` state is **derived on read,
never stored**. Three of the four change with nothing but the passage of
time: an upcoming instalment becomes due and then overdue while the
application sits idle, and no write happens to record it. A stored status
would be wrong by morning and would need a scheduled job to keep honest.
Only the fact that decides `PAID` is a column — when it was paid, and which
transaction paid it.

Anything derived from the clock is computed from a `now` passed in by the
caller, and pages hand the **server's** clock to the client. A phone with the
wrong date must not disagree with the figures rendered beside it.

## Net worth

```text
net worth = assets + account balances − liabilities
```

Nothing is counted twice, and that is structural rather than a rule someone
has to remember: `AssetType` has no cash or bank member, so money sitting in
an account cannot also be registered as an asset. Foreign currency is an
asset precisely because the ledger is Rial-only (see `Account.currency`) and
it has nowhere else to live.

**Liabilities are the unpaid instalments, not the outstanding principal.**
The household's liability is the money that will actually leave its
accounts, interest included — the same figure the loans page calls
مانده بدهی, so net worth and the loan list cannot disagree.

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
│   ├── charts/     # Recharts wrappers and chart tokens
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

## Motion, 3D and the client boundary

The redesign (docs/DESIGN_SYSTEM.md §0) adds three client-side libraries,
each with one job, so they never fight over the same frame:

| Library | Job |
| --- | --- |
| `motion` (`motion/react`) | Layout animation: the sliding active pill, the sidebar width, dock magnification. |
| `gsap` + `@gsap/react` | The dashboard's one-time entrance choreography (`features/dashboard/components/bento.tsx`). |
| `three` | The 3D balance card, imported with `import()` from inside an effect, so it is its own chunk. |

The theme switch uses the browser's View Transitions API and the ambient
background is CSS, so neither ships any JavaScript of its own.

Every animation honours `prefers-reduced-motion`: Motion through
`MotionConfig reducedMotion="user"`, GSAP through `gsap.matchMedia`, the 3D
scene by rendering a single still frame, CSS through the global rule.

Two boundary rules came out of the redesign:

1. **A server component cannot read a value from a `"use client"` module.**
   It receives a client reference instead, which is `undefined` when read.
   Chart colours therefore live in `components/charts/chart-tokens.ts`, a
   plain module; `chart-primitives.tsx` re-exports them for client charts.
2. **Anything that animates is a client leaf.** Cards stay server
   components and mark what should move with data attributes
   (`data-bento-cell`, `data-grow`, `data-sweep`, `data-count`); the one
   client wrapper around the grid animates them.

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
(a household member or Shared) rather than a user account. Finora is therefore built
as a self-hosted household deployment, with authentication deferred to
Sprint 8.

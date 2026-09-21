# Features

One folder per business domain. A feature folder owns everything that is only
meaningful inside that domain:

```text
features/<domain>/
├── components/   UI specific to this domain
├── server/       data access and domain logic (server-only)
├── schemas.ts    zod schemas for this domain's forms and API input
└── types.ts      types that do not leave this domain
```

## Rules

1. **Features do not import from one another.** If two domains need the same
   thing, it is not domain logic — move it up into `components/`, `lib/`,
   `utils/`, `hooks/` or `types/`.
2. **Routes stay thin.** A file under `src/app/` resolves params, calls into a
   feature, and renders. Business logic never lives in a route file.
3. **Money and dates follow the global rules.** `bigint` Rial end to end
   (G.2), UTC in the database and Jalali only at the edge (G.5).

The domains match the sprint roadmap: dashboard, accounts, transactions,
assets, loans, budgets, goals, calendar, reports.

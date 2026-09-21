# Components

Shared, domain-agnostic UI. Anything that knows about accounts, loans or
budgets belongs in `src/features/<domain>/components` instead.

```text
components/
├── ui/       shadcn/ui primitives — the design system's vocabulary
├── layout/   application chrome: sidebar, header, navigation, theme
├── charts/   Recharts wrappers, themed and RTL-aware (rule G.8)
├── forms/    reusable form building blocks over react-hook-form
└── common/   composites shared across features (page header, empty state, ...)
```

`ui/` is generated-style code kept close to shadcn/ui's structure so it can
still be diffed against the registry. Prefer extending a primitive with a new
variant over adding a second component that does nearly the same thing
(rule G.7).

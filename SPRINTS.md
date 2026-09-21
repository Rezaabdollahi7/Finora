# Personal Finance — Sprint Roadmap (0 → 100)

## Purpose

This is the working implementation roadmap for building a modern Persian personal/household finance management application.

The application is designed for a couple household and must support:

- Personal and shared finances
- Bank accounts and wallets
- Income and expenses
- Transfers
- Assets and liabilities
- Loans and installments
- Recurring payments
- Monthly budgets
- Financial goals
- Net worth tracking
- Cash-flow forecasting
- Persian/Jalali calendar
- Modern charts and reports
- Responsive desktop/tablet/mobile UI
- Full RTL support
- Dark/light themes

Claude Code should implement the project **Sprint by Sprint**.

Do not implement future Sprints unless explicitly instructed.

For example:

> "Implement task 2.4 from SPRINTS.md"

Claude Code should inspect the existing implementation, follow the project rules in `CLAUDE.md`, implement only that task, test it, and report what changed.

---

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[-]` Cancelled / no longer needed

---

# Sprint 0 — Project Foundation & Tooling  `[x]`

## Goal

Create the technical foundation of the application.

No financial business logic should be implemented yet.

### [x] 0.1 — Initialize React + TypeScript project

- Create the React application with TypeScript.
- Use a clean scalable project structure.
- Configure development and production builds.
- Verify the application starts successfully.

### [x] 0.2 — Docker development environment

- Create `Dockerfile`.
- Create `docker-compose.yml`.
- Add PostgreSQL container.
- Add application container.
- Configure environment variables.
- Make sure the application can communicate with PostgreSQL through Docker networking.

### [x] 0.3 — Configure Tailwind CSS

- Install and configure Tailwind CSS.
- Prepare the application for RTL.
- Do not hardcode the final visual design.
- Design tokens and visual identity will be provided separately.

### [x] 0.4 — Install and configure shadcn/ui

- Initialize shadcn/ui.
- Configure reusable components.
- Use shadcn components instead of manually recreating common UI primitives.

Expected base components:

- Button
- Input
- Select
- Dialog
- Sheet
- Dropdown
- Tabs
- Card
- Table
- Badge
- Tooltip
- Popover
- Calendar
- Form
- Alert
- Toast

### [x] 0.5 — Configure code quality

Add:

- ESLint
- Prettier
- TypeScript strict mode

The project must have clean:

```bash
npm run lint
npm run typecheck
npm run build
```

### [x] 0.6 — Configure Prisma

- Install Prisma.
- Connect Prisma to PostgreSQL.
- Create the initial schema.
- Configure migrations.
- Add a reusable Prisma client.

### [x] 0.7 — Create application architecture

Create a scalable feature-based structure.

Example:

```text
src/
├── app/
├── components/
│   ├── ui/
│   ├── charts/
│   ├── forms/
│   └── common/
├── features/
│   ├── dashboard/
│   ├── accounts/
│   ├── transactions/
│   ├── assets/
│   ├── loans/
│   ├── budgets/
│   ├── goals/
│   ├── calendar/
│   └── reports/
├── lib/
├── hooks/
├── utils/
├── types/
└── config/
```

### [x] 0.8 — Configure routing

Create routes for the main application sections.

Initial routes:

```text
/dashboard
/accounts
/transactions
/assets
/loans
/budgets
/goals
/calendar
/reports
/settings
```

### [x] 0.9 — Create application shell

Create:

- Sidebar
- Header
- Main content area
- Mobile navigation
- User/account menu
- Theme switcher
- Responsive layout

The final visual styling should remain compatible with the external Design System.

### [x] 0.10 — RTL and localization foundation

The application must be RTL-first.

Configure:

- Persian language
- Persian digits where appropriate
- Gregorian/Jalali conversion layer
- Toman/Rial formatting
- Date formatting utilities
- Number formatting utilities

### [x] 0.11 — Foundation acceptance test

Before completing Sprint 0:

- Docker works
- PostgreSQL works
- Prisma connects
- React runs
- Routing works
- RTL works
- Dark/light mode works
- TypeScript passes
- ESLint passes
- Production build succeeds

---

# Sprint 1 — Accounts & Transactions

## Goal

Build the core financial ledger.

The application must be able to represent where money exists and how money moves.

---

## [x] 1.1 — Account database model

Create the `Account` model.

Possible account types:

```text
BANK
CASH
WALLET
INVESTMENT
BUSINESS
OTHER
```

Fields should include at minimum:

```text
id
name
type
owner
currency
initialBalance
isActive
createdAt
updatedAt
```

Do not duplicate current balance unnecessarily if it can be calculated safely from transactions.

---

## [x] 1.2 — Account CRUD API

Implement:

- Create account
- Read accounts
- Read account details
- Update account
- Archive account

Do not permanently delete accounts that already have financial transactions.

---

## [x] 1.3 — Account UI

Create:

- Account list
- Account card
- Account detail
- Create/edit account dialog
- Account balance
- Transaction count
- Owner indicator

Support:

```text
Shared
Reza
Yeganeh
```

---

## [x] 1.4 — Transaction database model

Create the transaction model.

Transaction types:

```text
INCOME
EXPENSE
TRANSFER
```

Minimum fields:

```text
id
type
amount
accountId
categoryId
owner
description
date
createdAt
updatedAt
```

Transfers require a source account and destination account.

---

## [x] 1.5 — Transaction business rules

Implement:

- Income increases balance.
- Expense decreases balance.
- Transfer decreases source account.
- Transfer increases destination account.
- Transfer must NOT count as income or expense.
- Transactions cannot create invalid negative balances where account rules prohibit it.
- Amounts must always be positive at database/API level.

---

## [x] 1.6 — Transaction CRUD

Implement:

- Create
- Edit
- Delete
- View details
- Filter
- Search
- Pagination

---

## [x] 1.7 — Categories

Create hierarchical categories.

Example:

```text
Food
├── Groceries
├── Restaurant
└── Fast Food

Transportation
├── Fuel
├── Taxi
└── Maintenance

Housing
├── Rent
├── Electricity
├── Water
└── Gas

Personal
├── Clothing
├── Entertainment
└── Other

Business
├── Server
├── Claude
├── Advertising
└── Other
```

Categories must support:

- Parent category
- Child category
- Income/expense type
- Active/inactive state

---

## [x] 1.8 — Transaction filters

Support:

- Date range
- Account
- Owner
- Category
- Transaction type
- Amount range

---

## [x] 1.9 — Transaction UI

Create a modern transaction interface with:

- Table/list
- Category icons
- Income/expense visual distinction
- Persian dates
- Toman formatting
- Quick filters
- Search
- Mobile-friendly transaction cards

---

## 1.10 — Transaction tests

Test:

- Income
- Expense
- Transfer
- Editing
- Deleting
- Category assignment
- Account balance changes
- Transfer not counted as expense

---

# Sprint 2 — Dashboard & Visualization

## Goal

Build the main financial dashboard.

The dashboard should answer:

> وضعیت مالی ما الان چطور است؟

without requiring the user to navigate through multiple pages.

---

## 2.1 — Dashboard API

Create aggregated endpoints/services for:

- Total balance
- Monthly income
- Monthly expenses
- Monthly savings
- Asset value
- Liability value
- Net worth
- Upcoming payments
- Budget status

---

## 2.2 — Financial summary cards

Create cards for:

```text
Total Balance
Monthly Income
Monthly Expenses
Monthly Savings
Net Worth
Debt
```

Cards must support:

- Current value
- Previous month comparison
- Trend indicator
- Loading state
- Empty state

---

## 2.3 — Cash-flow chart

Create an interactive chart showing:

```text
Income
Expenses
Savings
```

by month.

Use a modern chart library such as Recharts.

---

## 2.4 — Expense category chart

Create a chart showing expense distribution.

Example:

```text
Food
Housing
Transportation
Personal
Entertainment
Business
Other
```

Support interactive tooltips.

---

## 2.5 — Account distribution chart

Show how current liquid money is distributed between accounts.

---

## 2.6 — Net worth chart

Create a line chart showing net worth history over time.

The architecture must support:

```text
Current month
3 months
6 months
1 year
All time
```

---

## 2.7 — Recent transactions widget

Show the latest transactions on Dashboard.

Each item should display:

- Description
- Category
- Account
- Date
- Amount

---

## 2.8 — Upcoming payments widget

Show the next financial obligations.

Example:

```text
امروز
قسط وام رضا     4.1M

فردا
اجاره           5M

۵ روز دیگر
Claude          5.5M
```

---

## 2.9 — Dashboard responsive design

Dashboard must work properly on:

- Desktop
- Tablet
- Mobile

Do not simply shrink desktop cards.

The mobile layout should be intentionally designed.

---

## 2.10 — Dashboard performance

Dashboard aggregation should be performed efficiently.

Avoid loading all transactions into the browser just to calculate totals.

---

# Sprint 3 — Assets & Net Worth

## Goal

Track everything the household owns and calculate real net worth.

---

## 3.1 — Asset model

Create an `Asset` model.

Asset types:

```text
GOLD
USD
EUR
CAR
STOCK
CRYPTO
PROPERTY
OTHER
```

---

## 3.2 — Asset CRUD

Implement:

- Create
- Edit
- Archive
- View details

---

## 3.3 — Quantity-based assets

Support assets such as:

```text
Gold
USD
EUR
Crypto
Stocks
```

Fields:

```text
quantity
unit
purchasePrice
currentPrice
```

---

## 3.4 — Fixed-value assets

Support assets such as:

```text
Car
Property
Other
```

with:

```text
purchaseValue
currentValue
```

---

## 3.5 — Asset valuation

Calculate:

```text
Current Value =
Quantity × Current Price
```

where applicable.

---

## 3.6 — Profit & Loss

Calculate:

```text
P/L =
Current Value - Total Purchase Cost
```

Display:

- Profit amount
- Loss amount
- Percentage return

---

## 3.7 — Asset portfolio UI

Create a modern portfolio page.

Display:

```text
Gold       700M
USD        230M
Car        1.4B
Other       50M
```

with visual distribution.

---

## 3.8 — Asset history

Support historical valuations.

The system must not overwrite historical values when the current price changes.

---

## 3.9 — Net worth engine

Calculate:

```text
Net Worth =
Assets + Account Balances - Liabilities
```

Do not double-count money.

For example, money in a bank account must not also be registered as a separate asset.

---

## 3.10 — Net worth history

Store or derive historical snapshots safely so the dashboard can show net worth over time.

---

## 3.11 — Asset tests

Test:

- Quantity assets
- Fixed-value assets
- P/L
- Asset valuation
- Net worth calculation
- Historical valuation
- No double counting

---

# Sprint 4 — Loans, Installments & Persian Calendar

## Goal

Build the complete loan and installment management system.

This is one of the core features of the application.

---

## 4.1 — Loan model

Create the `Loan` model.

Fields:

```text
name
provider
principalAmount
interestRate
installmentAmount
installmentCount
startDate
endDate
paymentDay
owner
status
```

---

## 4.2 — Loan CRUD

Implement:

- Create
- Edit
- Archive
- View details

---

## 4.3 — Installment generation

When a loan is created, generate its installment schedule.

Each installment should contain:

```text
number
dueDate
amount
status
paidAt
```

Statuses:

```text
UPCOMING
DUE
PAID
OVERDUE
```

---

## 4.4 — Installment payment

Allow the user to mark an installment as paid.

When paid:

- Create the corresponding expense/loan payment transaction.
- Mark installment as paid.
- Store payment date.
- Prevent duplicate payment.

---

## 4.5 — Loan progress

Display:

```text
Total installments
Paid installments
Remaining installments
Total paid
Remaining debt
```

Example:

```text
42 / 120 installments paid

████████░░░░░░░░

Remaining:
78 installments
```

---

## 4.6 — Persian/Jalali calendar

Implement a full Jalali calendar.

Requirements:

- Persian year
- Persian month
- Persian weekday
- Persian digits where appropriate
- Today indicator
- Month navigation
- Event indicators
- Responsive mobile calendar

---

## 4.7 — Financial calendar

Calendar events should include:

```text
Loan installment
Rent
Recurring payment
Bill
Goal contribution
Other financial events
```

---

## 4.8 — Day detail panel

When selecting a day:

```text
۲ شهریور ۱۴۰۵

Payments
────────────
قسط وام رضا       4.1M
اجاره             5M
Claude            5.5M

Total:
14.6M
```

---

## 4.9 — Upcoming payment timeline

Create a timeline for:

```text
Today
Tomorrow
This week
Next week
This month
```

---

## 4.10 — Loan tests

Test:

- Installment generation
- Due dates
- Paid installments
- Overdue installments
- Duplicate payment prevention
- Loan balance
- Calendar events

---

# Sprint 5 — Recurring Payments & Budgets

## Goal

Automate predictable expenses and introduce monthly budgeting.

---

## 5.1 — Recurring payment model

Create recurring financial events.

Examples:

```text
Rent
Claude
Server
Internet
Subscriptions
Insurance
Other
```

Fields:

```text
name
amount
frequency
startDate
endDate
paymentDay
category
account
owner
active
```

---

## 5.2 — Recurring payment frequencies

Support:

```text
Monthly
Weekly
Yearly
Custom
```

---

## 5.3 — Automatic future events

Recurring payments should automatically generate future expected events.

Do not immediately create real expense transactions for future events.

---

## 5.4 — Convert recurring event to transaction

When the payment is actually made:

```text
Expected → Paid
```

and create the real transaction.

---

## 5.5 — Recurring payment UI

Create:

- Recurring payment list
- Create/edit dialog
- Active/inactive state
- Next payment date
- Amount
- Category
- Owner

---

## 5.6 — Budget model

Create monthly budgets.

Example:

```text
Food            25M
Transportation   2M
Entertainment    3M
Clothing         1.5M
Personal         3M
```

---

## 5.7 — Budget tracking

Calculate:

```text
Budget
Spent
Remaining
Percentage
```

---

## 5.8 — Budget progress UI

Example:

```text
Food

18.5M / 25M

████████░░ 74%
```

Use appropriate states:

```text
Normal
Warning
Over budget
```

---

## 5.9 — Budget rollover

Allow selected budget categories to carry unused money into the next month.

Rollover must be configurable per category.

---

## 5.10 — Budget alerts

Prepare the system to notify the user when:

```text
80% of budget is used
100% of budget is used
Upcoming expenses exceed available balance
```

---

## 5.11 — Budget tests

Test:

- Monthly budget
- Category spending
- Remaining budget
- Over-budget state
- Rollover
- Budget reset

---

# Sprint 6 — Goals & Cash-Flow Forecast

## Goal

Turn the application from a tracker into a planning tool.

---

## 6.1 — Goal model

Create financial goals.

Examples:

```text
Car
Emergency Fund
Travel
Laptop
Investment
Other
```

---

## 6.2 — Goal CRUD

Implement:

- Create goal
- Edit goal
- Archive goal
- Complete goal

---

## 6.3 — Goal progress

Each goal should have:

```text
Target Amount
Current Amount
Remaining Amount
Progress %
Target Date
```

Example:

```text
Emergency Fund

45M / 100M

████▌░░░░░ 45%
```

---

## 6.4 — Goal contributions

Allow money to be allocated toward goals.

A goal contribution must be distinguishable from an actual expense.

---

## 6.5 — Goal dashboard

Show:

- Active goals
- Progress
- Target date
- Required monthly contribution

---

## 6.6 — Cash-flow forecasting engine

Create a forecasting service.

The forecast should consider:

```text
Current account balances
+
Expected income
+
Recurring income
-
Loans
-
Recurring expenses
-
Budgeted expenses
```

---

## 6.7 — Forecast periods

Support:

```text
1 month
3 months
6 months
12 months
```

---

## 6.8 — Forecast chart

Create a line chart showing projected liquidity.

Example:

```text
Current
   ↓
Month 1
   ↓
Month 2
   ↓
Month 3
```

---

## 6.9 — Low-balance warning

Detect situations where expected future obligations exceed available liquid funds.

Example:

```text
⚠️ هشدار جریان نقدی

در هفته آینده:

موجودی قابل استفاده: 12M

پرداخت‌های پیش‌بینی‌شده: 17M

کسری احتمالی: 5M
```

---

## 6.10 — Forecast tests

Test:

- Expected income
- Recurring expenses
- Loan payments
- Budget expenses
- Future balance
- Low-balance detection

---

# Sprint 7 — Couple / Household Mode

## Goal

Support two people sharing one household while keeping personal and shared finances separate.

---

## 7.1 — Household model

Create:

```text
Household
├── Reza
├── Yeganeh
└── Shared
```

---

## 7.2 — Ownership rules

Financial records can belong to:

```text
Reza
Yeganeh
Shared
```

---

## 7.3 — Income ownership

Track individual income separately.

Example:

```text
Reza
Salary       30M
Project       5M

Yeganeh
Salary       30M
```

---

## 7.4 — Shared expenses

Shared household expenses should be clearly identified.

Examples:

```text
Rent
Food
Utilities
Fuel
Travel
```

---

## 7.5 — Personal expenses

Allow each person to have personal spending that does not affect the shared budget incorrectly.

---

## 7.6 — Household dashboard

Show:

```text
Household Income
Household Expenses
Household Savings
Shared Assets
Shared Liabilities
```

---

## 7.7 — Contribution overview

Show how much each person contributed to the household.

This is informational only.

Do not create competitive scoring or rankings between household members.

---

## 7.8 — Personal views

Each user should be able to see:

```text
My Income
My Expenses
My Contributions
My Personal Budget
My Goals
```

---

## 7.9 — Couple tests

Test:

- Reza transactions
- Yeganeh transactions
- Shared transactions
- Household totals
- Personal totals
- Contribution calculations

---

# Sprint 8 — Reports, Analytics & Finalization

## Goal

Complete the financial reporting system and prepare the application for real daily usage.

---

## 8.1 — Monthly financial report

Create a monthly report containing:

```text
Income
Expenses
Savings
Investments
Debt payments
Net worth change
```

---

## 8.2 — Income report

Show income by:

- Month
- Owner
- Source
- Account

---

## 8.3 — Expense report

Show expenses by:

- Month
- Category
- Owner
- Account

---

## 8.4 — Savings report

Calculate:

```text
Savings =
Income - Expenses
```

And:

```text
Savings Rate =
Savings / Income × 100
```

---

## 8.5 — Debt report

Show:

```text
Total original debt
Paid debt
Remaining debt
Monthly installment burden
Upcoming installments
```

---

## 8.6 — Asset report

Show:

```text
Total assets
Asset allocation
Asset P/L
Largest assets
Asset history
```

---

## 8.7 — Net worth report

Show:

```text
Assets
Liabilities
Net Worth
Net Worth Change
```

with historical charts.

---

## 8.8 — Category analysis

Identify:

- Highest expense categories
- Monthly category changes
- Spending trends
- Budget vs actual

The system should present factual observations rather than subjective financial scores.

---

## 8.9 — Report filters

All reports should support:

```text
Date range
Owner
Account
Category
```

---

## 8.10 — Export

Support exporting reports/data where appropriate.

Possible formats:

```text
CSV
Excel
PDF
```

Do not introduce unnecessary dependencies if browser printing/export is sufficient.

---

## 8.11 — Notification center

Create a central notification system for:

```text
Upcoming installment
Overdue installment
Upcoming recurring payment
Budget warning
Budget exceeded
Low cash-flow warning
Goal milestone
```

---

## 8.12 — Empty states

Every major page must have a meaningful empty state.

Examples:

```text
هنوز حسابی اضافه نکرده‌اید.

اولین حساب بانکی خود را اضافه کنید.
```

Do not show blank screens.

---

## 8.13 — Loading states

Every asynchronous page/component must support:

- Skeleton
- Loading indicator
- Disabled action states

Avoid layout jumping.

---

## 8.14 — Error states

Implement consistent error handling for:

- API errors
- Validation errors
- Network errors
- Database errors

Never expose raw server/database errors to users.

---

## 8.15 — Responsive audit

Review the complete application on:

```text
Desktop
Tablet
Mobile
```

Check:

- Tables
- Charts
- Dialogs
- Calendar
- Forms
- Navigation
- Dashboard cards

---

## 8.16 — Accessibility audit

Check:

- Keyboard navigation
- Focus states
- Labels
- Form accessibility
- Contrast
- Screen-reader-friendly controls
- Dialog accessibility

---

## 8.17 — Performance audit

Review:

- API calls
- Dashboard queries
- Large transaction lists
- Chart rendering
- Bundle size
- Lazy loading
- Database indexes

---

## 8.18 — Security audit

Review:

- Authentication
- Authorization
- Input validation
- SQL/Prisma safety
- Environment variables
- Sensitive data
- API permissions
- Session handling

---

## 8.19 — Database integrity audit

Verify:

- Foreign keys
- Cascading rules
- Unique constraints
- Indexes
- Decimal/money precision
- Transaction consistency

Financial calculations must never use floating-point arithmetic where monetary precision matters.

---

## 8.20 — Automated tests

Create tests for critical business logic:

```text
Transactions
Accounts
Transfers
Assets
Net Worth
Loans
Installments
Recurring Payments
Budgets
Goals
Forecast
Household calculations
```

---

## 8.21 — Final build verification

The following must succeed:

```bash
docker compose up
npm run lint
npm run typecheck
npm run test
npm run build
```

---

## 8.22 — Production readiness checklist

Before declaring the project complete:

- [ ] Database migrations work from a clean database
- [ ] Environment variables documented
- [ ] Docker production build works
- [ ] Database backup strategy documented
- [ ] Error logging exists
- [ ] Authentication works
- [ ] Authorization works
- [ ] Responsive UI verified
- [ ] RTL verified
- [ ] Persian calendar verified
- [ ] Monetary calculations verified
- [ ] Critical tests passing
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] No console errors in production build

---

# Global Rules for Every Sprint

These rules apply to every task.

## G.1 — Do not break existing functionality

Before changing existing code:

1. Understand the current implementation.
2. Identify dependencies.
3. Implement the smallest safe change.
4. Run relevant tests.
5. Run typecheck/lint/build where appropriate.

---

## G.2 — Financial precision

Never use JavaScript floating-point numbers for monetary calculations.

Money must be represented using an appropriate precise representation.

Database values should use suitable decimal/integer monetary types.

---

## G.3 — Transfers are not expenses

A transfer between two household accounts must never:

- Increase expenses
- Increase income
- Artificially change net worth

---

## G.4 — Historical data must remain historical

Changing today's asset price must not rewrite historical portfolio values.

Changing a category name must not destroy transaction history.

Changing a loan configuration must not silently rewrite already-paid installments.

---

## G.5 — Persian calendar

All user-facing financial dates should support Jalali/Persian dates.

Internal storage may use Gregorian/UTC timestamps where appropriate.

Never mix Jalali display values with database timestamps.

---

## G.6 — RTL-first

The UI must be designed for RTL.

Do not implement an LTR UI and simply apply:

```css
direction: rtl;
```

Spacing, icons, navigation, charts and tables must all be considered for RTL.

---

## G.7 — Design System

The visual Design System is provided separately by the product owner.

Claude Code must:

- Follow provided tokens.
- Reuse shadcn/ui components.
- Avoid introducing arbitrary colors.
- Avoid random border radius values.
- Avoid random shadows.
- Avoid creating duplicate components when an existing component can be reused.

---

## G.8 — Charts

Charts should be:

- Modern
- Minimal
- Responsive
- Interactive
- RTL-aware where appropriate
- Consistent with the Design System

Use a single charting strategy/library throughout the application.

---

## G.9 — Empty/loading/error states

Every major feature must implement:

```text
Loading
Empty
Error
Success
```

Do not consider a page complete if it only works with populated data.

---

## G.10 — Mobile-first behavior

Every feature must be usable on mobile.

Desktop tables should become:

- Responsive tables
- Horizontal scrolling where appropriate
- Cards/list views where necessary

Do not force users to zoom.

---

## G.11 — Tests before completion

A task is not considered complete simply because the UI works.

The relevant business logic must be tested.

---

## G.12 — Do not implement future Sprints

When asked to implement a specific task:

> Implement only the requested task and the minimum supporting code required for it.

Do not proactively implement later features.

---

# Sprint Completion Rule

A Sprint can only be marked `[x]` after:

```text
Implementation
        ↓
Testing
        ↓
Typecheck
        ↓
Lint
        ↓
Build
        ↓
Manual verification
        ↓
Documentation/update
```

Then update the task from:

```text
[ ] 2.4 ...
```

to:

```text
[x] 2.4 ...
```

Do not mark tasks complete based only on code being written.

---

# Final Product Structure

At the end of Sprint 8, the application should contain:

```text
Dashboard
├── Financial Summary
├── Cash Flow
├── Expenses
├── Net Worth
├── Upcoming Payments
└── Recent Transactions

Accounts
├── Bank Accounts
├── Cash
├── Wallets
└── Business Accounts

Transactions
├── Income
├── Expenses
└── Transfers

Assets
├── Gold
├── Currency
├── Car
├── Investments
└── Other

Loans
├── Loans
├── Installments
└── Payment History

Calendar
├── Persian Calendar
├── Installments
├── Recurring Payments
└── Financial Events

Budgets
├── Monthly Budgets
├── Category Budgets
└── Budget Progress

Goals
├── Active Goals
├── Goal Progress
└── Contributions

Reports
├── Income
├── Expenses
├── Savings
├── Debt
├── Assets
└── Net Worth

Household
├── Reza
├── Yeganeh
└── Shared
```

The application should be usable as a real daily household financial management tool after Sprint 8.

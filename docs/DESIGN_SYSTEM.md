# Personal Finance Design System

This document defines the visual language and UI design system of the Personal Finance application.

The visual direction is inspired by modern premium financial SaaS products:

* Minimal
* Clean
* Premium
* Soft
* Professional
* Data-focused
* Calm
* Modern
* Highly readable

The attached visual reference is the primary visual inspiration for the overall design language.

The application must NOT copy the reference interface literally.

It should use the same visual principles while adapting them to the Personal Finance application's information architecture and Persian/RTL experience.

---

# 1. Design Principles

The interface must follow these principles:

### 1.1 Clarity First

Financial information must be immediately understandable.

Users should quickly understand:

* How much money they have
* How much they spent
* How much they earned
* What payments are upcoming
* How their assets changed
* How their budget is performing

---

### 1.2 Premium but Simple

The UI should feel polished without becoming visually noisy.

Prefer:

* Large whitespace
* Soft surfaces
* Rounded cards
* Subtle shadows
* Strong typography
* Restrained colors
* Clear hierarchy

Avoid:

* Excessive borders
* Excessive gradients
* Excessive shadows
* Too many colors
* Excessive icons
* Dense dashboards

---

### 1.3 Data Has Priority

Decorative UI must never compete with financial information.

The hierarchy should generally be:

```text
Important financial number
        ↓
Context / comparison
        ↓
Supporting information
        ↓
Action
```

---

# 2. Brand Color System

The primary color palette is based on the provided visual reference.

## 2.1 Core Colors

### Ink / Navy

```text
--color-ink: #1F2033
```

Hex:

```text
#1f2033
```

Usage:

* Primary text
* Headings
* Navigation
* Dark cards
* High-priority numbers
* Icons
* Dark surfaces

This is the primary dark brand color.

---

### Primary Purple

```text
--color-primary: #5346F0
```

Hex:

```text
#5346f0
```

Usage:

* Primary buttons
* Active navigation
* Selected tabs
* Important actions
* Links
* Focus states
* Main chart data
* Progress indicators
* Selected controls

This is the primary action color.

---

### Secondary Purple

```text
--color-secondary: #7F7CC9
```

Hex:

```text
#7f7cc9
```

Usage:

* Secondary chart series
* Supporting data
* Secondary indicators
* Muted accents
* Decorative elements
* Hover/secondary states

This color should NOT replace the primary purple for important actions.

---

### Background / White

```text
--color-background: #FDFEFF
```

Hex:

```text
#fdfeff
```

Usage:

* Main application background
* Primary surfaces
* Cards where appropriate
* Modal backgrounds

---

# 3. Extended Color Tokens

The four core colors are the source of truth.

Additional colors should be used carefully.

## Text

```text
Primary:
#1f2033

Secondary:
rgba(31, 32, 51, 0.65)

Muted:
rgba(31, 32, 51, 0.45)

Disabled:
rgba(31, 32, 51, 0.30)
```

Do not introduce random gray colors.

---

## Purple Alpha Tokens

Use the primary purple to generate subtle backgrounds.

```text
Primary 100%:
#5346f0

Primary 12%:
rgba(83, 70, 240, 0.12)

Primary 8%:
rgba(83, 70, 240, 0.08)

Primary 5%:
rgba(83, 70, 240, 0.05)
```

Typical usage:

```text
Primary 100%
→ buttons / active states

Primary 12%
→ selected backgrounds

Primary 8%
→ hover states

Primary 5%
→ subtle highlighted surfaces
```

---

# 4. Semantic Colors

Brand colors must remain dominant.

Semantic colors are only used to communicate meaning.

## Success

Recommended:

```text
#2E9B6F
```

Use for:

* Income
* Positive financial change
* Paid
* Completed
* Successful actions

---

## Danger

Recommended:

```text
#E5484D
```

Use for:

* Expenses when comparison requires semantic emphasis
* Overdue payments
* Destructive actions
* Errors

---

## Warning

Recommended:

```text
#D99A24
```

Use for:

* Upcoming payments
* Budget warnings
* Attention states

---

## Info

Use the primary purple:

```text
#5346f0
```

Do not introduce another blue unless there is a strong functional reason.

---

# 5. Color Usage Ratio

The interface should generally follow this visual balance:

```text
Neutral / White surfaces     ~70–80%
Dark Ink / Navy              ~10–15%
Primary Purple               ~5–10%
Semantic colors              As needed
```

Purple must feel special.

Do not make every component purple.

---

# 6. Background System

Use layered surfaces instead of excessive borders.

Recommended hierarchy:

```text
App Background
    ↓
Card Surface
    ↓
Elevated Surface
    ↓
Interactive Surface
```

Example:

```text
Application:
#fdfeff

Cards:
#ffffff / #fdfeff

Subtle purple surface:
rgba(83, 70, 240, 0.05)

Dark feature card:
#1f2033

Purple feature card:
#5346f0
```

---

# 7. Dark Cards

Dark cards are a major visual element inspired by the reference.

Use:

```text
Background:
#1f2033

Primary text:
#fdfeff

Secondary text:
rgba(253, 254, 255, 0.65)

Muted text:
rgba(253, 254, 255, 0.45)
```

Use dark cards for:

* Important summaries
* Account overviews
* Featured financial information
* High-priority sections

Do not use dark cards everywhere.

---

# 8. Purple Cards / Highlight Panels

Primary purple can be used for featured information.

```text
Background:
#5346f0

Text:
#fdfeff
```

For subtle purple cards:

```text
background:
rgba(83, 70, 240, 0.08)
```

Purple gradients are allowed only for major visual highlights.

Do not use gradients on every card.

---

# 9. Typography

The application is Persian-first.

The typography system must prioritize Persian readability.

Recommended font:

```text
Vazirmatn
```

Fallback:

```text
system-ui
sans-serif
```

The exact font can be changed by the Design System owner without changing component structure.

---

# 10. Typography Scale

Use a restrained type scale.

## Display

```text
48px
Line height: 1.1
Weight: 700
```

Use only for major financial numbers or hero areas.

---

## H1

```text
32px
Line height: 1.2
Weight: 700
```

---

## H2

```text
24px
Line height: 1.3
Weight: 700
```

---

## H3

```text
20px
Line height: 1.35
Weight: 600
```

---

## H4

```text
18px
Line height: 1.4
Weight: 600
```

---

## Body Large

```text
16px
Line height: 1.7
Weight: 400
```

---

## Body

```text
14px
Line height: 1.7
Weight: 400
```

---

## Caption

```text
12px
Line height: 1.5
Weight: 400
```

---

## Financial Numbers

Important monetary values should use:

```text
Weight: 700
Letter spacing: normal
```

Numbers should have strong visual hierarchy.

Example:

```text
42,850,000 تومان
```

should visually dominate:

```text
موجودی حساب
```

---

# 11. Spacing System

Use an 8px base spacing system.

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
80px
96px
```

Recommended token names:

```text
space-1  = 4px
space-2  = 8px
space-3  = 12px
space-4  = 16px
space-5  = 20px
space-6  = 24px
space-8  = 32px
space-10 = 40px
space-12 = 48px
space-16 = 64px
space-20 = 80px
space-24 = 96px
```

Do not create arbitrary spacing values unless necessary.

---

# 12. Layout Spacing

## Page Padding

Desktop:

```text
32px
```

Tablet:

```text
24px
```

Mobile:

```text
16px
```

---

## Section Spacing

Between major sections:

```text
32px – 48px
```

---

## Card Internal Padding

Default:

```text
24px
```

Compact:

```text
16px
```

Large / featured:

```text
32px
```

---

# 13. Border Radius

Rounded corners are a major part of the visual identity.

Use:

```text
radius-sm  = 8px
radius-md  = 12px
radius-lg  = 16px
radius-xl  = 20px
radius-2xl = 24px
radius-full = 9999px
```

Default application card:

```text
16px
```

Featured cards:

```text
20px – 24px
```

Buttons:

```text
12px
```

Pills:

```text
9999px
```

Inputs:

```text
12px
```

Dialogs:

```text
20px
```

---

# 14. Borders

Borders must be subtle.

Default border:

```text
rgba(31, 32, 51, 0.08)
```

Strong border:

```text
rgba(31, 32, 51, 0.12)
```

Focus border:

```text
#5346f0
```

Do not use dark 1px borders everywhere.

Whenever possible:

```text
Surface + shadow
```

should replace:

```text
Heavy border
```

---

# 15. Shadows

Shadows should be soft and diffused.

## Small

```css
box-shadow: 0 2px 8px rgba(31, 32, 51, 0.04);
```

## Medium

```css
box-shadow: 0 8px 24px rgba(31, 32, 51, 0.06);
```

## Large

```css
box-shadow: 0 16px 40px rgba(31, 32, 51, 0.08);
```

## Floating

```css
box-shadow: 0 20px 50px rgba(31, 32, 51, 0.10);
```

Avoid strong black shadows.

---

# 16. Cards

Cards are the primary content container.

Default card:

```text
Background: #fdfeff
Radius: 16px
Padding: 24px
Border: rgba(31,32,51,0.08)
Shadow: Small
```

Cards should not have both:

* strong border
* strong shadow

at the same time.

---

# 17. Card Hierarchy

### Default Card

For normal information.

```text
Radius: 16px
Padding: 24px
```

### Compact Card

For lists and dense data.

```text
Radius: 12px
Padding: 16px
```

### Featured Card

For important financial information.

```text
Radius: 20px
Padding: 24px – 32px
```

### Dark Card

```text
Background: #1f2033
Radius: 20px
```

---

# 18. Buttons

Buttons should be visually simple and confident.

## Primary Button

```text
Background: #5346f0
Text: #fdfeff
Radius: 12px
Height: 44px
Padding-inline: 18px
```

Hover:

```text
Slightly darker/lighter primary treatment
```

Do not introduce a completely different color.

---

## Secondary Button

```text
Background: #fdfeff
Text: #1f2033
Border: rgba(31,32,51,0.08)
Radius: 12px
Height: 44px
```

---

## Ghost Button

```text
Background: transparent
Text: #1f2033
Radius: 12px
```

Hover:

```text
rgba(83,70,240,0.08)
```

---

## Destructive Button

Use semantic danger only when necessary.

Do not make destructive actions visually dominant.

---

# 19. Icon Buttons

Icon-only buttons:

```text
32px
36px
40px
44px
```

Default:

```text
40 × 40px
Radius: 12px
```

Icons should generally use:

```text
18px – 20px
```

Every icon-only button must have an accessible label.

---

# 20. Inputs

Default input:

```text
Height: 44px
Radius: 12px
Padding-inline: 14px
Background: #fdfeff
Border: rgba(31,32,51,0.10)
```

Focus:

```text
Border: #5346f0
Box shadow:
0 0 0 3px rgba(83,70,240,0.12)
```

Error:

```text
Border: #E5484D
```

---

# 21. Select / Combobox

Use the same visual language as inputs.

```text
Height: 44px
Radius: 12px
```

Dropdown:

```text
Radius: 12px
Padding: 8px
Shadow: Medium
```

Option:

```text
Height: 40px
Radius: 8px
Padding-inline: 12px
```

Selected option:

```text
Background:
rgba(83,70,240,0.08)

Text:
#5346f0
```

---

# 22. Tabs

Tabs should be lightweight.

Active tab:

```text
Background: #5346f0
Text: #fdfeff
Radius: 9999px
```

Inactive:

```text
Background: transparent
Text: rgba(31,32,51,0.65)
```

For segmented controls, use:

```text
Pill container
```

rather than heavy borders.

---

# 23. Badges

Badges should be compact.

```text
Height: 28px
Padding-inline: 10px
Radius: 9999px
Font: 12px
```

Examples:

```text
Paid
Upcoming
Overdue
Shared
Personal
```

Semantic colors should be subtle backgrounds rather than saturated full backgrounds where possible.

---

# 24. Tables

Tables must be clean and spacious.

Header:

```text
Font: 12px
Weight: 600
Muted text
```

Row:

```text
Minimum height: 56px
```

Avoid vertical borders between every column.

Use:

```text
Whitespace
Subtle horizontal separators
```

for hierarchy.

---

# 25. Financial Transaction List

Transaction rows should prioritize:

```text
Category / Description
        ↓
Date / Account
        ↓
Amount
```

Positive values:

```text
Success
```

Negative values:

```text
Danger
```

Transfers:

```text
Primary / Neutral
```

Do not use red for every expense if it makes the UI visually aggressive.

---

# 26. Navigation

Desktop navigation should feel similar to the reference:

```text
Rounded navigation container
Soft background
Clear active state
```

Active navigation:

```text
Background: #5346f0
Text: #fdfeff
Radius: 9999px
```

Inactive:

```text
Text: rgba(31,32,51,0.65)
```

Navigation spacing:

```text
8px
```

---

# 27. Dashboard Layout

The dashboard should use a modular grid.

Example:

```text
┌──────────────────────────────────────┐
│ Page Header                          │
├────────────┬────────────┬────────────┤
│ Balance    │ Income     │ Expense    │
├────────────┴────────────┼────────────┤
│ Cash Flow Chart         │ Budgets    │
├─────────────────────────┼────────────┤
│ Transactions            │ Payments   │
└─────────────────────────┴────────────┘
```

The exact layout can change based on content.

Do not force every dashboard into the same grid.

---

# 28. Financial Summary Cards

Summary cards should contain:

```text
Label
Primary number
Comparison / context
Optional icon
Optional mini chart
```

Example:

```text
موجودی کل

125,400,000 تومان

↑ 8.2% نسبت به ماه قبل
```

Primary number should be visually dominant.

---

# 29. Charts

Charts must follow the same visual language.

Primary chart:

```text
#5346f0
```

Secondary:

```text
#7f7cc9
```

Positive:

```text
#2E9B6F
```

Negative:

```text
#E5484D
```

Grid lines:

```text
rgba(31,32,51,0.06)
```

Axis text:

```text
rgba(31,32,51,0.50)
```

---

# 30. Chart Rules

Charts must:

* Have sufficient whitespace
* Avoid unnecessary borders
* Avoid 3D effects
* Avoid excessive colors
* Have readable labels
* Work on mobile
* Handle empty data
* Handle large values

Prefer subtle gradients only for area charts.

Example:

```text
Primary line:
#5346f0

Area:
rgba(83,70,240,0.10)
```

---

# 31. Progress Indicators

Use rounded progress bars.

```text
Height: 8px
Radius: 9999px
```

Track:

```text
rgba(31,32,51,0.08)
```

Progress:

```text
#5346f0
```

Success:

```text
#2E9B6F
```

---

# 32. Modals / Dialogs

Dialogs should feel elevated and lightweight.

```text
Background: #fdfeff
Radius: 20px
Padding: 24px
Shadow: Large
```

Desktop max width:

```text
480px – 640px
```

Large dialogs:

```text
720px – 960px
```

Do not make dialogs unnecessarily large.

---

# 33. Drawers

Drawers should use:

```text
Background: #fdfeff
Shadow: Floating
Radius: 20px
```

On mobile:

```text
Bottom sheet
```

is preferred for suitable interactions.

---

# 34. Toasts / Notifications

Notifications should be compact.

```text
Radius: 12px
Padding: 12px 16px
Shadow: Medium
```

Use semantic color sparingly.

Example:

```text
Success → subtle green
Error → subtle red
Warning → subtle amber
Info → subtle purple
```

---

# 35. Empty States

Empty states must not feel like errors.

Structure:

```text
Icon / illustration

Title

Short explanation

Primary action
```

Example:

```text
هنوز تراکنشی ثبت نشده

اولین تراکنش خود را ثبت کنید تا
گزارش‌های مالی شما شروع به شکل‌گیری کنند.

[ثبت تراکنش]
```

---

# 36. Loading States

Use skeletons instead of generic spinners when loading page content.

Skeleton:

```text
Background:
rgba(31,32,51,0.06)

Radius:
8px – 12px
```

Animations should be subtle.

---

# 37. Error States

Error UI must be calm and informative.

Structure:

```text
Icon

Something went wrong

Short explanation

Retry action
```

Never display raw technical errors to users.

---

# 38. Responsive Breakpoints

Use standard responsive breakpoints.

```text
Mobile:
< 640px

Tablet:
640px – 1023px

Desktop:
1024px – 1279px

Large Desktop:
1280px+
```

Suggested Tailwind mapping:

```text
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

---

# 39. Mobile Rules

On mobile:

* Reduce page padding
* Stack cards
* Reduce chart height
* Convert tables to cards where necessary
* Keep primary actions reachable
* Preserve important financial numbers
* Avoid horizontal overflow
* Use bottom sheets when appropriate

Mobile page padding:

```text
16px
```

---

# 40. RTL Rules

The application is RTL-first.

Use:

```html
dir="rtl"
```

at the application level.

Do not manually mirror every component.

Use logical CSS properties where possible.

For example:

```css
margin-inline-start
margin-inline-end
padding-inline-start
padding-inline-end
```

rather than hard-coded left/right positioning.

---

# 41. Numbers

Financial numbers should remain easy to scan.

Use consistent formatting:

```text
125,400,000 تومان
```

Avoid mixing number formatting styles throughout the application.

The currency symbol/unit should have lower visual weight than the amount.

---

# 42. Persian Dates

Dates displayed to users should use Jalali format.

Example:

```text
۲۵ شهریور ۱۴۰۵
```

Compact:

```text
۲۵ شهریور
```

Very compact:

```text
۲۵/۰۶/۱۴۰۵
```

Choose the appropriate format based on available space.

---

# 43. Motion

Motion should be subtle.

Recommended duration:

```text
Fast:
120ms

Normal:
180ms

Slow:
240ms
```

Recommended easing:

```text
ease-out
```

Use animation for:

* Modal entrance
* Dropdown
* Tooltip
* Hover
* Tab transition
* Chart entrance
* Page transitions where appropriate

Avoid excessive animation on financial dashboards.

---

# 44. Hover States

Hover should be subtle.

For light surfaces:

```text
background:
rgba(83,70,240,0.04)
```

For buttons:

Use a small change in primary intensity.

Do not dramatically change component size on hover.

---

# 45. Focus States

Every interactive element must have a visible focus state.

Primary focus:

```text
outline:
3px solid rgba(83,70,240,0.15)

border:
#5346f0
```

Do not remove browser focus without replacing it with an accessible alternative.

---

# 46. Accessibility

The visual system must maintain:

* Strong text contrast
* Visible focus
* Minimum practical touch target
* Keyboard navigation
* Accessible labels
* Semantic HTML

Recommended minimum interactive target:

```text
40 × 40px
```

Prefer:

```text
44 × 44px
```

on touch devices.

---

# 47. Iconography

Use one consistent icon library throughout the application.

Recommended:

```text
Lucide Icons
```

Icons should generally be:

```text
16px
18px
20px
24px
```

Do not mix multiple icon styles.

Avoid decorative icons that do not communicate meaning.

---

# 48. Visual Density

Default density:

```text
Comfortable
```

The application should feel spacious.

Use:

```text
16px – 24px
```

internal spacing in most cards.

Dense layouts are appropriate for:

* Transaction tables
* Financial reports
* Large datasets

but not for the primary dashboard.

---

# 49. Design Tokens

Recommended CSS variables:

```css
:root {
  --color-ink: #1f2033;
  --color-primary: #5346f0;
  --color-secondary: #7f7cc9;
  --color-background: #fdfeff;

  --color-success: #2e9b6f;
  --color-danger: #e5484d;
  --color-warning: #d99a24;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

---

# 50. Tailwind Mapping

The Design System should be reflected in Tailwind configuration/theme tokens.

Do not scatter raw colors throughout components.

Bad:

```tsx
<div className="bg-[#5346f0]" />
```

Prefer:

```tsx
<div className="bg-primary" />
```

or the project's semantic token equivalent.

This makes future design changes much easier.

---

# 51. shadcn/ui Rules

Use shadcn/ui as the foundation for common components.

Examples:

* Button
* Input
* Select
* Dialog
* Dropdown
* Tabs
* Tooltip
* Popover
* Sheet
* Table
* Toast
* Badge

Customize shadcn components to match this Design System.

Do not create duplicate versions of components that already exist.

---

# 52. Component Variants

Components should use meaningful variants.

Example:

```text
Button

variant:
primary
secondary
ghost
destructive

size:
sm
md
lg
icon
```

Avoid arbitrary one-off variants.

---

# 53. Do Not Do

Never introduce:

* Random colors
* Random border radii
* Random shadows
* Excessive gradients
* Excessive glassmorphism
* Excessive blur
* Neon colors
* Heavy black shadows
* Multiple unrelated font families
* Inconsistent icon styles
* Arbitrary spacing values

If a new visual treatment is required, update this Design System first.

---

# 54. Visual Reference Summary

The attached reference establishes the following visual characteristics:

```text
Primary Dark:
#1f2033

Primary Purple:
#5346f0

Secondary Purple:
#7f7cc9

Background:
#fdfeff
```

Visual language:

```text
Soft
Rounded
Minimal
Premium
Light
Spacious
Data-oriented
Professional
```

The interface should feel:

> Modern financial software with a calm, premium visual identity.

It should NOT feel:

> Like a generic admin dashboard.

---

# 55. Design Decision Priority

When making a UI decision, follow this priority:

```text
1. Usability
2. Financial readability
3. Accessibility
4. Design System consistency
5. Responsive behavior
6. Visual polish
7. Decoration
```

Functionality must never be sacrificed for visual appearance.

---

# 56. Final Rule

Every new UI feature must answer:

```text
Does it belong to the Design System?
Does it use existing tokens?
Does it preserve visual hierarchy?
Does it work in RTL?
Does it work on mobile?
Does it communicate financial information clearly?
Does it remain consistent with existing components?
```

If the answer is no, revise the implementation before considering the feature complete.


---

# 57. Dark Theme

The sections above define the light palette. The application also ships a dark
theme, so the dark palette is derived from the same brand primitives rather
than invented alongside them.

Derivation rules:

```text
App background  → brand ink, darkened
Card surface    → brand ink itself (#1f2033)
Elevated / popover → brand ink, lightened
Primary         → brand purple, lifted for contrast on a dark surface
Borders         → white alpha, mirroring the ink alpha used in light mode
```

Resulting tokens:

```text
--background:  #14151f
--card:        #1f2033
--popover:     #262739
--foreground:  #fdfeff

--primary:     #6d62f3
--secondary:   #9a97d8

--success:     #3bb684
--danger:      #ff6369
--warning:     #e8ae3c

--border:        rgba(253, 254, 255, 0.10)
--border-strong: rgba(253, 254, 255, 0.16)
```

Text alphas mirror the light theme, measured against white instead of ink:

```text
Secondary: rgba(253, 254, 255, 0.65)
Muted:     rgba(253, 254, 255, 0.45)
Disabled:  rgba(253, 254, 255, 0.30)
```

The **dark feature card** of section 7 is unchanged by the theme. It is a
brand element rather than a themed surface, so it keeps `#1f2033` with
`#fdfeff` text in both themes, and is exposed as its own token pair
(`--ink-surface` / `--ink-surface-foreground`).

Purple keeps the same role it has in light mode: an accent that stays special.
Dark mode must not turn every surface purple.

---

# 58. Token Implementation

Tokens live in `src/app/globals.css` in two layers:

```text
Brand primitives   --brand-*        identical in every theme
Semantic tokens    --background, --card, --border, ...   re-declared in .dark
```

Components consume the **semantic** layer only, through Tailwind utilities
(`bg-card`, `text-muted-foreground`, `border-border`, `rounded-lg`,
`shadow-md`). A raw hex value in component markup is a design-system
violation.

The 8px spacing scale of section 11 already matches Tailwind's default scale
(`space-4` = 16px), so spacing is not redefined.

---

# 59. Chart Palette

Sections 29 and 30 set the visual language for charts. This section fixes the
exact steps, because chart colour is the one place where "looks fine" and
"is readable" come apart: two hues can be clearly different to most people and
nearly identical to a reader with colour vision deficiency.

Every palette here was checked with a validator rather than by eye, against
five criteria: an OKLCH lightness band for the surface, a chroma floor so no
step reads as grey, separation between adjacent pairs under protanopia,
deuteranopia and tritanopia, separation under normal vision, and contrast
against the chart surface.

## 59.1 Cash-flow series

```text
Light                      Dark
income   #0e9280           #0faa93
expense  #e05038           #e85f4a
savings  #5346f0           #6d62f3
```

These are **not** the semantic success and danger steps of section 4. Those are
tuned for text and badges, where each appears alone next to an icon and a
label. Side by side in a chart they are the classic red/green pair and
separate by only ΔE 6.7 under deuteranopia — the most common form of colour
blindness. Pushing the positive hue toward teal raises the worst adjacent pair
to ΔE 11.5 in light and ΔE 10.8 in dark.

The dark steps are re-stepped rather than reused: the light ones sit outside
the dark lightness band and fall to ΔE 5.6 there, which fails outright.

## 59.2 Sequential ramp

For magnitude — "which category cost the most" — a single hue, darkest for
the largest value.

```text
Light (largest first)      Dark (largest first)
#352aa1                    #c9c4fb
#4436c9                    #b3abf9
#5346f0                    #9c92f7
#6e5ff3                    #8579f5
#8579f5                    #6e5ff3
#9c92f7                    #5346f0
```

One hue, monotone lightness, even steps of roughly 0.065 OKLCH L. The ramp
runs the other way on a dark surface, because there the lightest step is the
one with the most contrast.

A slice that is an *absence* of data rather than a category — uncategorised
spending — takes `--chart-neutral`, which is outside the ramp.

## 59.3 Rules

* **Never generate a hue to fit one more series.** A generated ninth colour is
  indistinguishable from an existing one under CVD. Fold the tail into "سایر",
  or switch to a table.
* **Colour is never the only channel.** Two or more series always carry a
  legend, and the values are always reachable — as a direct label, a tooltip,
  or the figure beside the chart.
* **Text never wears a series colour.** Marks carry the colour; labels, values
  and axis text use the text tokens. Identity comes from the swatch beside the
  text.
* **Sequential for magnitude, categorical for identity.** Never a rainbow, and
  never a hue at a diverging midpoint.
* **Colour follows the entity, not its rank.** Filtering a series out must not
  repaint the ones that remain.

## 59.4 Marks

```text
Bar            ≤ 24px thick, 4px rounded at the data end, square at the baseline
Line           2px, round join and cap
Marker         ≥ 8px, 2px ring in the surface colour
Area fill      series hue at ~10%
Grid           1px solid, --chart-grid, never dashed
Gap            2px of surface between touching marks
```

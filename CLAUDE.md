# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Dev server at http://localhost:4200 (auto-opens browser)
npm run build      # Production build → dist/budget-app/
npx ng serve       # Dev server without opening browser
```

## Architecture

**Angular 17 standalone components** — no NgModules. All components use `standalone: true` and import their own dependencies.

**State management** uses Angular Signals exclusively:
- `BudgetService` (singleton, `providedIn: 'root'`) holds all state as `signal<MonthlyBudget>`
- `summary` is a `computed<BudgetSummary>()` that derives all mathematical totals reactively
- Persistence is manual via `localStorage` keyed by `presupuesto_{year}_{month}`
- No RxJS Subjects for state — use signals and computed

**Data flow:**
```
BudgetService.budget (signal)
  → BudgetService.summary (computed)
    → DashboardComponent (reads both)
      → CategoryCardComponent (@Input: CategorySummary)
      → BudgetRingComponent (injects service directly)
      → AddItemModalComponent (@Input: BudgetCategory, @Output: close)
```

**Mathematical coherence rules** enforced in `BudgetService.compute()`:
- `unallocated = totalIncome − totalPlanned` (can go negative = over budget)
- `savingsRate = savingsAmount / totalIncome × 100`
- `variance = actualAmount − plannedAmount` (positive = over budget per category)
- `executionRate = totalActual / totalPlanned × 100`
- Toggleing `isPaid` on an item auto-sets `actualAmount = plannedAmount`

## Key Constraints

**Angular template parser limitations:**
- No arrow functions (`=>`) in event bindings — add a method to the component instead
- `[class.xxx]` bindings break if the class name contains `[` or `/` characters — use `@if`/`@else` blocks or `[style]` bindings instead (e.g., avoid `[class.bg-[#fff]/5]`)

**Design system** (defined in `tailwind.config.js`):
- Fonts: `font-display` = Cormorant Garamond, `font-sans` = Syne, `font-mono` = DM Mono
- Palette: bg `#0C0C0E`, cards `#141416`, elevated `#1C1C1F`, borders `#232327`
- Accent lime: `#C9F131`, danger: `#FF7B7B`, success: `#4DFFB4`
- Category colors are stored in the model (HEX strings), used via `[style.color]` / `[style.background-color]` for dynamic binding

**Category structure** is fixed at 7 types (`CategoryType` union in `budget.model.ts`). Categories are seeded from `CATEGORY_DEFAULTS` in the service when no localStorage data exists.

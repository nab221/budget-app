# Budget App

A personal budgeting tool for a single user on one computer. It answers two questions:

1. **How much am I spending every month?** — income vs spending by category.
2. **If I have spare money, how do I pay my borrowings back?** — given the current bank
   balance and everything committed before the next payday, how much is safe to pay
   extra, and onto which credit card or loan.

> **Status: v4 refactor in progress.** The app is being rebuilt per
> `specs/REFACTOR-SPEC.md` (product contract) and `specs/IMPLEMENTATION-PLAN.md`
> (build order). Contributor/agent guidance lives in `CLAUDE.md`.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest
npm run build    # production build
```

## Design in one paragraph

Local-first and private: data lives in the browser's IndexedDB (Dexie, database
`BudgetAppV4`), with manual JSON export/import as backup — no accounts, no servers, no
sync. The UI is React on Vite; the financial engine (`src/engine/`) is pure, well-tested
JavaScript: UK credit-card minimum payments, avalanche/snowball payoff simulation,
0% promo and balance-transfer modelling, payday-to-payday affordability, UK
working-day payment adjustment, and bank-statement PDF parsing. All money is stored as
integer pence, GBP only.

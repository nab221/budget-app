---
name: verify
description: Build/launch/drive recipe for verifying budget-app changes in a real browser.
---

# Verifying budget-app in the browser

## Launch

```bash
npm install            # once per container
npm run dev            # serves http://localhost:5173/budget-app/  (note the base path!)
```

## Drive (headless Chromium + Playwright)

- Global playwright lives at `/opt/node22/lib/node_modules/playwright` — ESM ignores
  NODE_PATH, so import it by absolute path:
  `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`
- Launch with `executablePath: '/opt/pw-browsers/chromium'`. Do NOT `playwright install`.
- Form labels are NOT associated with inputs (`<label>` without htmlFor) — `getByLabel`
  fails. Locate by field container instead:
  `page.locator('.field', { hasText: 'Name' }).locator('input, select').first()`
- Fresh IndexedDB seeds default categories only (Groceries, Utilities, Housing,
  Transport, Eating Out, Kids, Debt Payment, Other + 2 income). No demo bills/debts.
- Collect `pageerror` + console errors; the app must stay clean while tabbing around.

## Flows worth driving

1. Expenses tab → Add → each of Recurring expense / Credit card / Loan.
2. Period toggle Week/Month/Year — check "Going out" totals recompute.
3. Pause an expense → totals drop; Resume restores.
4. Dashboard tiles + Next payments list reflect the same schedule.
5. Reload → everything persists (Dexie `BudgetAppV4`).

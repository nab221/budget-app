# Phase 6: Rolling Overview - Income/Expense Bars & Binning - Research

**Researched:** 2026-03-06
**Domain:** Charting (Chart.js), Data Aggregation (date-fns), UI Components (CSS)
**Confidence:** HIGH

## Summary

This phase focuses on upgrading the 'Rolling Financial Overview' chart from a simple line chart into a mixed visualization that combines a line for the account balance with bars for income and expenses. It also introduces time-based aggregation (Daily, Weekly, Monthly) to allow users to zoom out and see higher-level trends without the noise of daily fluctuations.

**Primary recommendation:** Use Chart.js mixed chart capabilities by setting individual dataset types, and implement binning logic in `cashflow.js` using `date-fns` for reliability across weeks and months.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-04 | Enhanced Rolling Overview: Replace income/expense lines with a bar chart (green/red) and add D/W/M binning via a modern radio button group. | Research into Chart.js mixed charts and segmented control CSS. |
| ANAL-04 | Implement interactive tooltips for all charts showing exact monetary values on hover/touch. | Verification of Chart.js tooltip callbacks for mixed charts. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.5.1 | Primary charting library | Robust, supports mixed charts, already in project. |
| date-fns | 4.1.0 | Date manipulation and binning | Lightweight, reliable for ISO weeks and month starts. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| Lucide Icons | N/A | (Conceptual) UI icons | Use standard emoji or existing icons for binning buttons if needed. |

**Installation:**
```bash
npm install date-fns
```
*(Already present in package.json)*

## Architecture Patterns

### Recommended Project Structure
- `src/utils/cashflow.js`: Add `aggregateRollingData` function to handle binning.
- `src/ui/charts.js`: Update `renderRollingOverviewChart` to support mixed types and bar styling.
- `src/ui/dashboard.js`: Manage binning state and UI interaction.
- `css/main.css`: Add styles for the `segmented-control` (radio group).

### Mixed Chart Implementation
Chart.js allows mixing different types in a single chart instance by specifying the `type` on the dataset object.

```javascript
// src/ui/charts.js
const chart = new Chart(canvas, {
  type: 'bar', // Default type
  data: {
    labels,
    datasets: [
      {
        type: 'line', // Override for balance
        label: 'Account Balance',
        data: balance,
        order: 1 // Lower order = drawn on top
      },
      {
        type: 'bar',
        label: 'Income',
        data: income,
        order: 2
      }
    ]
  }
});
```

### Data Binning Logic
Aggregation should be performed *after* the daily values are calculated to ensure balance continuity.

**Strategy:**
1. Generate daily rolling data as usual.
2. If binning is 'W' or 'M', iterate through labels.
3. Group by `startOfWeek` or `startOfMonth`.
4. Sum Income/Expenses.
5. Take the *last* Balance value of the period (Closing Balance).
6. Recalculate `todayIndex` based on which bin contains the current date.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Week/Month Calculation | Custom date math | `date-fns` | Handles edge cases (Leap years, ISO weeks, Timezones). |
| Chart Interactivity | Canvas event listeners | `Chart.js` built-in | Handles hover, touch, tooltips, and legend toggles natively. |
| Segmented Control | Custom JS for toggles | CSS `:checked` + `<label>` | More accessible, no JS required for basic styling, performs better. |

## Common Pitfalls

### Pitfall 1: Summing Balances
**What goes wrong:** Aggregating balance by summing values in a week (e.g., $1000 + $1005 + $1010...).
**Why it happens:** Mistakenly applying the same sum logic used for income/expenses.
**How to avoid:** Always use the *last* value in a bin for the balance dataset.

### Pitfall 2: Timezone Shifts
**What goes wrong:** Dates shifting by one day depending on the user's local time vs UTC.
**Why it happens:** Using `new Date()` on ISO strings without consistent UTC/Local handling.
**How to avoid:** Use `parseISO` from `date-fns` or ensure consistent use of UTC methods.

### Pitfall 3: Chart.js Registration
**What goes wrong:** Mixed charts failing to render bars.
**Why it happens:** Only `LineController` and `LineElement` are registered.
**How to avoid:** Explicitly register `BarController` and `BarElement` in `src/ui/charts.js`.

### Pitfall 4: Negative Expense Bars
**What goes wrong:** Expenses and Income overlapping in a way that is hard to read.
**How to avoid:** Multiple options:
1. Expenses as negative values (bars point down).
2. Stacked bars (if positive).
3. **Recommendation:** Negative values for expenses to match the "red/negative" mental model.

## Code Examples

### Segmented Control CSS
```css
.segmented-control {
  display: flex;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2px;
  width: fit-content;
}
.segmented-control input[type="radio"] { display: none; }
.segmented-control label {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-soft);
  cursor: pointer;
}
.segmented-control input[type="radio"]:checked + label {
  background: var(--card);
  color: var(--accent);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
```

### Data Aggregation with `date-fns`
```javascript
import { startOfWeek, startOfMonth, format, parseISO, isSameDay } from 'date-fns';

export function aggregateData(labels, balance, income, expenses, binning) {
  if (binning === 'D') return { labels, balance, income, expenses };

  const binnedLabels = [];
  const binnedBalance = [];
  const binnedIncome = [];
  const binnedExpenses = [];
  const today = new Date();

  let currentBinKey = null;
  let currentIncome = 0;
  let currentExpense = 0;
  let lastBalance = 0;

  for (let i = 0; i < labels.length; i++) {
    const date = parseISO(labels[i]);
    let binKey;

    if (binning === 'W') {
      binKey = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else { // 'M'
      binKey = format(startOfMonth(date), 'yyyy-MM');
    }

    if (currentBinKey !== null && binKey !== currentBinKey) {
      binnedLabels.push(currentBinKey);
      binnedBalance.push(lastBalance);
      binnedIncome.push(currentIncome);
      binnedExpenses.push(currentExpense);
      currentIncome = 0;
      currentExpense = 0;
    }

    currentBinKey = binKey;
    currentIncome += income[i];
    currentExpense += expenses[i];
    lastBalance = balance[i];
  }
  // ... Push last bin ...
}
```

## Sources

### Primary (HIGH confidence)
- [Chart.js Official Docs](https://www.chartjs.org/docs/latest/charts/mixed.html) - Mixed Chart types.
- [date-fns Official Docs](https://date-fns.org/docs/) - `startOfWeek`, `startOfMonth`.
- [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/:checked) - CSS `:checked` selector for UI toggles.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already in use or standard in ecosystem.
- Architecture: HIGH - Fits well within current repository patterns.
- Pitfalls: HIGH - Common charting/aggregation issues identified.

**Research date:** 2026-03-06
**Valid until:** 2026-04-05

# Phase 26: Foundation & Schema (V12) - Research

**Researched:** 2026-03-03
**Domain:** Database Schema Migration (Dexie.js)
**Confidence:** HIGH

## Summary
Phase 26 focuses on upgrading the IndexedDB schema to Version 12 to support automatic recurring transactions. This involves adding fields to `recurrentExpenses` and `oneOffExpenses` and migrating data from the deprecated `recurringTemplates` table. The primary challenge is ensuring a safe data transformation while generating the initial series of future transactions.

**Primary recommendation:** Use `crypto.randomUUID()` for unique series IDs with a fallback for non-secure contexts, and perform the 12-month series generation within the Dexie `upgrade()` hook to ensure atomicity.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | 4.0.11 | IndexedDB Wrapper | Built-in to project, handles versioning/upgrades. |
| date-fns | 4.1.0 | Date Manipulation | Used for generating future monthly instances. |
| Web Crypto | Native | UUID Generation | `crypto.randomUUID()` is the modern standard for UUIDs. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| `localStorage` | Native | State Persistence | To track if certain migration steps or prompts were handled. |

## Architecture Patterns

### Pattern 1: Safe UUID Generation
Since the app might be run in non-secure contexts (though unlikely for a budget app), a fallback is required.
```javascript
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Simple RFC4122 v4 compliant fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

## Code Examples

### Version 12 Upgrade Hook
```javascript
db.version(12).stores({
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate',
  recurringTemplates: null // Mark for deletion
}).upgrade(async tx => {
  // 1. Initialize existing recurrentExpenses
  await tx.table('recurrentExpenses').toCollection().modify(item => {
    item.isRecurring = item.isRecurring ?? true;
    item.recurrenceId = item.recurrenceId ?? generateUUID();
    item.parentDate = item.parentDate ?? item.date;
  });

  // 2. Initialize existing oneOffExpenses
  await tx.table('oneOffExpenses').toCollection().modify(item => {
    item.isRecurring = item.isRecurring ?? false;
    item.frequency = item.frequency ?? 'none';
    item.recurrenceId = item.recurrenceId ?? null;
    item.parentDate = item.parentDate ?? null;
  });

  // 3. Migrate Templates
  const templates = await tx.table('recurringTemplates').toArray();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const startDate = `${currentMonth}-01`;

  for (const tpl of templates) {
    if (tpl.type === 'fixed') {
      const recurrenceId = generateUUID();
      // Generate 12 instances
      for (let i = 0; i < 12; i++) {
        const date = addMonths(new Date(startDate), i).toISOString().split('T')[0];
        await tx.table('recurrentExpenses').add({
          date: date,
          categoryId: tpl.categoryId,
          label: tpl.name,
          amount: tpl.amount,
          status: 'pending',
          frequency: 'monthly',
          nextDate: date,
          isEssential: true,
          cycleTotal: 0,
          cycleCurrent: 0,
          isRecurring: true,
          recurrenceId: recurrenceId,
          parentDate: startDate
        });
      }
    }
  }
});
```

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: HIGH

**Research date:** 2026-03-03
**Valid until:** 2026-04-03

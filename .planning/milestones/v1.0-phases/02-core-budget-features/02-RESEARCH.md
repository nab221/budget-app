# Phase 2: Core Budget Features - Research

**Researched:** 2026-03-01
**Domain:** CRUD Operations, Data Security (AES-GCM), Debt Calculations, Recurring Templates
**Confidence:** HIGH

## Summary

This phase implements the core financial recording capabilities of the Budget App. The research focuses on extending the Dexie.js schema, implementing secure data export/import using the Web Crypto API, and establishing the logic for debt minimum payments and recurring transaction templates.

**Primary recommendation:** Use a modular repository pattern for data access and a dedicated `EncryptionService` using AES-GCM for secure data handling. Standardize all money operations on the `toPence/fromPence` utility established in Phase 1.

<user_constraints>
## User Constraints (from CONTEXT.md)

*No CONTEXT.md found. Using requirements from roadmap/instructions.*

### Focus Areas
- **Income/Fixed/Variable/Subscription CRUD**: Month-filtered views and full editing/deletion.
- **UK Debt Rules**: Implementation of `calcMinPayment()` for credit cards.
- **Subscription Logic**: Monthly-equivalent calculations for quarterly/annual items.
- **Recurring Templates**: Prompting logic at the start of each month.
- **Data Safety**: Export/Import with optional password protection (AES-GCM).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INC-01 to 04 | Income CRUD + Month Filter | Dexie `startsWith` query pattern for YYYY-MM dates. |
| FIXED-01 to 04| Fixed Spends + Paid Status | Schema update for `status` field; repository updates. |
| VAR-01 to 04 | Variable Spends CRUD | Repository pattern for variable transactions. |
| SUB-01 to 04 | Subscriptions + Monthly Eq | Formula: `amount / frequencyInMonths`. |
| REC-01 to 04 | Recurring Templates + Prompts | Start-of-month check against `localStorage.lastPromptedMonth`. |
| DEBT-01 to 06 | Debt Tracker + Statements | UK min payment formula: `max(1% balance + interest, 2.25% balance, £5)`. |
| ASSET-01 to 03 | Assets + Net Worth | Basic CRUD; integration into summary calculations. |
| DATA-01 to 05 | Export/Import + Encryption | AES-GCM with PBKDF2 key derivation from password. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | ^4.0.0 | IndexedDB Persistence | Already in use; excellent for schema migrations. |
| SubtleCrypto | (Native) | AES-GCM Encryption | High-performance, secure, and native to modern browsers. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| TextEncoder | (Native) | String to Binary | Converting JSON strings to buffers for encryption. |

## Architecture Patterns

### Database Schema (v2)
The following schema updates are required to support Phase 2 features:

```javascript
db.version(2).stores({
  income: '++id, date, source, amount, categoryId',
  fixedSpends: '++id, date, categoryId, label, amount, status',
  variableSpends: '++id, date, categoryId, note, amount',
  subscriptions: '++id, name, amount, categoryId, nextDate',
  recurringTemplates: '++id, name, amount, categoryId, frequency, type',
  debts: '++id, name, type',
  statements: '++id, debtId, date', // debtId is the FK
  assets: '++id, name, asOfDate',
  categories: '++id, name, group'
}).upgrade(tx => {
  // Migration logic:
  // 1. Rename fixedSpends.name to label
  // 2. Rename variableSpends.name to note
  // 3. Add default status 'pending' to fixedSpends
});
```

### Pattern: Start-of-Month Prompting (REC-02)
To handle recurring templates without a backend:
1. On app load, compare `new Date().toISOString().slice(0, 7)` with `localStorage.getItem('lastPromptedMonth')`.
2. If different, query `recurringTemplates` and check if corresponding transactions exist for the current month.
3. Show a modal with a list of "Due Transactions" that the user can confirm or dismiss.
4. On completion, update `localStorage`.

### Anti-Patterns to Avoid
- **Reusing IVs in AES-GCM:** Always generate a fresh 12-byte IV for every encryption operation.
- **Storing Passwords:** Never store the encryption password; derive the key and discard the password immediately.
- **Duplicate Data on Import:** The requirement (DATA-02) specifies that import should **replace** existing data, not merge.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encryption | Custom XOR/Cipher | SubtleCrypto (AES-GCM) | Industry standard, resistant to common attacks, hardware-accelerated. |
| Date Parsing | Complex Regex | `new Date()` or `Intl.DateTimeFormat` | Built-in tools handle ISO strings and locales effectively for this scale. |

## Common Pitfalls

### Pitfall 1: AES-GCM Binary Data in JSON
**What goes wrong:** `JSON.stringify` cannot handle `ArrayBuffer` or `Uint8Array` (encrypted data).
**How to avoid:** Convert the `salt`, `iv`, and `ciphertext` to a single `Uint8Array`, then encode to **Base64** or **Hex** before wrapping in a JSON backup file.

### Pitfall 2: UK Minimum Payment Calculation
**What goes wrong:** Calculating 1% of balance but forgetting to add the month's interest/fees (required by most UK lenders).
**Prevention:** The `calcMinPayment` function must include estimated interest if APR is provided: `(balance * (APR/100)) / 12`.

## Code Examples

### UK Minimum Payment (DEBT-02)
```javascript
/**
 * Calculates the UK standard minimum payment for a credit card.
 * Rule: max(1% balance + interest, 2.25% balance, £5 floor)
 */
export function calcMinPayment(balancePence, aprPercent, feesPence = 0) {
  if (balancePence <= 0) return 0;
  if (balancePence < 500) return balancePence; // Full balance if < £5

  const monthlyInterest = Math.round((balancePence * (aprPercent / 100)) / 12);
  
  const opt1 = Math.round(balancePence * 0.01) + monthlyInterest + feesPence;
  const opt2 = Math.round(balancePence * 0.0225);
  const opt3 = 500; // £5 floor

  return Math.max(opt1, opt2, opt3);
}
```

### AES-GCM Encryption (DATA-03)
```javascript
async function encryptData(data, password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const passwordKey = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    passwordKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, aesKey, encoder.encode(JSON.stringify(data))
  );
  
  // Package: [salt (16)] [iv (12)] [ciphertext (...)]
  const combined = new Uint8Array(16 + 12 + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(new Uint8Array(encrypted), 16 + 12);
  
  return btoa(String.fromCharCode(...combined));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plaintext Exports | Password-Protected AES-GCM | Security standard | Protects sensitive financial data in cloud backups. |
| Hard-coded Min Payments | Dynamic Rules (Shared Fn) | Architecture best practice | Ensures consistency between tracker and simulation. |

## Open Questions

1. **Subscription 'Next Date' handling:** Should the app automatically advance the date when the month rolls over?
   - *Recommendation:* Yes, but only after the user acknowledges the recurring transaction or the app detects the date has passed.
2. **Statement Overlap:** How to handle statements that cross calendar months?
   - *Recommendation:* Statements should be logged by their **Statement Date**; the dashboard filter will show statements issued within that period.

## Sources

### Primary (HIGH confidence)
- [Web Crypto API (SubtleCrypto)](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) - AES-GCM and PBKDF2 implementation.
- [UK Credit Card Minimum Payments (StepChange)](https://www.stepchange.org/debt-info/minimum-repayments-on-credit-cards.aspx) - Verification of payment rules.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: HIGH

**Research date:** 2026-03-01
**Valid until:** 2026-09-01

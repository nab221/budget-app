# Requirements: Budget App v1.3 (Enhanced Debt Management)

**Milestone Goal:** Comprehensive statement tracking with automatic expense integration and PDF summary extraction.

## v1.3 Requirements

### Schema & Data Infrastructure (DEBT-01)
- [ ] **DEBT-01.1**: Implement Schema v11: Expand `statements` table with `openingBalance`, `minimumPayment`, `paymentDueDate`, `actualPaymentAmount`, `actualPaymentDate`, and `linkedExpenseId`.
- [ ] **DEBT-01.2**: Implement Schema v11: Add `isDebtPayment` and `linkedStatementId` flags to `recurrentExpenses`.
- [ ] **DEBT-01.3**: Implement robust migrations for Schema v11.
- [ ] **DEBT-01.4**: Update `statementRepository` to support atomic creation of statements and linked expenses via `addWithExpense()`.
- [ ] **DEBT-01.5**: Update `statementRepository` to support updating actual payment details via `recordPayment()`.

### Statement Lifecycle & Automation (DEBT-02)
- [ ] **DEBT-02.1**: Implement automatic "Min Payment" recurrent expense creation when a statement is logged.
- [ ] **DEBT-02.2**: Ensure debt balance remains unchanged after payment confirmation; updates only occur when the *next* statement is logged.
- [ ] **DEBT-02.3**: Validate that a new statement's opening balance matches the previous closing balance.
- [ ] **DEBT-02.4**: Implement "Mark Paid" specialized workflow for debt-linked expenses that prompts for actual amount paid.

### PDF Summary Extraction (DEBT-03)
- [ ] **DEBT-03.1**: Enhance `pdf-import.js` with a "Statement Summary" mode distinct from transaction parsing.
- [ ] **DEBT-03.2**: Implement regex-based extraction for key fields (Balance, Min Due, Due Date) across multiple UK bank formats (Barclays, HSBC, etc.).
- [ ] **DEBT-03.3**: Pre-fill the statement logging form with extracted data for user review.
- [ ] **DEBT-03.4**: Provide manual fallback and hint if extraction fails.

### Forecast & UI Integration (DEBT-04)
- [ ] **DEBT-04.1**: Integrate debt payments into the 90-day daily cash flow forecast.
- [ ] **DEBT-04.2**: Apply v1.2 bank holiday and weekend adjustment logic to debt payment due dates.
- [ ] **DEBT-04.3**: Add visual `💳` badge and unique styling for debt-related expenses in all lists and charts.
- [ ] **DEBT-04.4**: Update Dashboard critical warnings to include upcoming debt payments.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEBT-01.1   | Phase 21 | Pending |
| DEBT-01.2   | Phase 21 | Pending |
| DEBT-01.3   | Phase 21 | Pending |
| DEBT-01.4   | Phase 21 | Pending |
| DEBT-01.5   | Phase 21 | Pending |
| DEBT-02.1   | Phase 22 | Pending |
| DEBT-02.2   | Phase 22 | Pending |
| DEBT-02.3   | Phase 22 | Pending |
| DEBT-02.4   | Phase 24 | Pending |
| DEBT-03.1   | Phase 23 | Pending |
| DEBT-03.2   | Phase 23 | Pending |
| DEBT-03.3   | Phase 23 | Pending |
| DEBT-03.4   | Phase 23 | Pending |
| DEBT-04.1   | Phase 25 | Pending |
| DEBT-04.2   | Phase 25 | Pending |
| DEBT-04.3   | Phase 24 | Pending |
| DEBT-04.4   | Phase 25 | Pending |

---
*Last updated: 2026-03-02 for v1.3 milestone*

# Roadmap: Budget App v1.3 (Enhanced Debt Management)

## Overview
This milestone introduces advanced tracking for debt statements, automating the creation of payment expenses and integrating them into the cash flow forecast. It also enhances the PDF import tool to extract high-level statement summaries, reducing manual entry for credit card management.

## Phases

- [x] **Phase 21: Data Layer & Repository (v1.3)** - Expand schema and repositories for statements and linked expenses.
- [x] **Phase 22: Debt UI & Statement Lifecycle** - Manual statement logging with automatic recurring expense generation.
- [x] **Phase 23: PDF Summary Extraction** - Extract statement fields (balance, min payment, due date) from PDFs.
- [x] **Phase 24: Payment Confirmation & Visuals** - specialized workflow for confirming actual debt payments and 💳 visual indicators.
- [x] **Phase 25: Forecast Integration & Polish** - Full integration with v1.2 daily cash flow and final UI polish.

---

## Phase Details

### Phase 21: Data Layer & Repository (v1.3)
**Goal**: Build the data foundation for linked statements and expenses.
**Depends on**: Phase 20
**Requirements**: DEBT-01.1, DEBT-01.2, DEBT-01.3, DEBT-01.4, DEBT-01.5
**Success Criteria**:
  1. `statements` table has new fields: `openingBalance`, `minimumPayment`, `paymentDueDate`, `actualPaymentAmount`, `actualPaymentDate`, `linkedExpenseId`.
  2. `recurrentExpenses` table has `isDebtPayment` and `linkedStatementId` flags.
  3. `statementRepository.addWithExpense()` correctly creates a statement and its linked "Min Payment" expense atomically.
  4. `statementRepository.recordPayment()` correctly updates actual payment details on the statement.

**Plans**:
- [x] 21-01-PLAN.md — Schema v11 Migration
- [x] 21-02-PLAN.md — statementRepository Enhancement
- [x] 21-03-PLAN.md — Repository Verification

### Phase 22: Debt UI & Statement Lifecycle
**Goal**: Implement the UI and logic for managing the statement-to-expense lifecycle.
**Depends on**: Phase 21
**Requirements**: DEBT-02.1, DEBT-02.2, DEBT-02.3
**Success Criteria**:
  1. Users can manually log all 1.3 statement fields in the Debt details UI.
  2. Saving a statement automatically triggers the creation of a recurring "Min Payment" expense for that debt.
  3. Debt balance remains unchanged until the *next* statement is logged, which must validate the previous closing balance.

**Plans**:
- [x] 22-01-PLAN.md — Enhanced Form & Atomic Deletion
- [x] 22-02-PLAN.md — Statement Lifecycle & Validation
- [x] 22-03-PLAN.md — Visual Indicators

### Phase 23: PDF Summary Extraction
**Goal**: Automate statement entry via PDF summary parsing.
**Depends on**: Phase 21
**Requirements**: DEBT-03.1, DEBT-03.2, DEBT-03.3, DEBT-03.4
**Success Criteria**:
  1. PDF import tool supports a "Statement Summary" mode (regex-based).
  2. Statement fields (Balance, Min Due, Due Date) are extracted from at least one sample UK bank PDF.
  3. Extracted data pre-fills the statement form for user confirmation; manual fallback is clear if extraction fails.

**Plans**:
- [x] 23-01-PLAN.md — Core Extraction Logic
- [x] 23-02-PLAN.md — UI Mode Integration
- [x] 23-03-PLAN.md — Form Integration

### Phase 24: Payment Confirmation & Visuals
**Goal**: Unified workflow for confirming debt payments and their visual representation.
**Depends on**: Phase 22
**Requirements**: DEBT-02.4, DEBT-04.3
**Success Criteria**:
  1. Debt-related expenses are visually distinct with a 💳 badge in all lists.
  2. Marking a debt expense as paid triggers a specialized dialog prompting for the actual amount paid.
  3. Actual payment history is correctly recorded and visible in the Debt view.

**Plans**:
- [x] 24-01-PLAN.md — Expenses UI Interception
- [x] 24-02-PLAN.md — Debt History UI

### Phase 25: Forecast Integration & Polish
**Goal**: Correctly project debt payments in the cash flow forecast.
**Depends on**: Phase 24
**Requirements**: DEBT-04.1, DEBT-04.2, DEBT-04.4
**Success Criteria**:
  1. Debt payment expenses appear in the 90-day forecast chart and daily planner.
  2. Payment due dates correctly shift for bank holidays and weekends using v1.2 logic.
  3. Forecasted balance accurately reflects upcoming minimum payments and potential cash flow impacts.

**Plans**:
- [x] 25-01-PLAN.md — Core Logic & Testing
- [x] 25-02-PLAN.md — UI Integration & Polish

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 21. Data Layer & Repository (v1.3) | 3/3 | Completed | 2026-03-02 |
| 22. Debt UI & Statement Lifecycle | 3/3 | Completed | 2026-03-02 |
| 23. PDF Summary Extraction | 3/3 | Completed | 2026-03-02 |
| 24. Payment Confirmation & Visuals | 2/2 | Completed | 2026-03-02 |
| 25. Forecast Integration & Polish | 2/2 | Completed | 2026-03-02 |

---
*Last updated: 2026-03-02*

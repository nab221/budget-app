# Requirements: Budget App v1.2 (Daily Cash Flow Engine)

**Milestone Goal:** Predict daily balances 90 days forward, handling UK bank holidays and weekends, with auto-generation of expected income.

## v1.2 Requirements

### Schema & Data Infrastructure (SCHEMA-01)
- [ ] **SCHEMA-01.1**: Implement Schema v10 including `dailyBalanceSnapshots`, `expectedIncome`, and `bankHolidayOverrides`.
- [ ] **SCHEMA-01.2**: Implement robust migrations for Schema v10.
- [ ] **SCHEMA-01.3**: Add repositories for new tables in `src/db/repository.js`.
- [ ] **SCHEMA-01.4**: UK Bank Holiday handling via `gov.uk` API integration.
- [ ] **SCHEMA-01.5**: Offline caching for UK Bank Holiday data to ensure engine works without internet.

### Forecast Engine (FORC-01)
- [ ] **FORC-01.1**: Implement 90-day forecast engine in `src/utils/cashflow.js` (opening + income - expenses = closing).
- [ ] **FORC-01.2**: Implement logic to move expenses falling on weekends or bank holidays to the next working day.
- [ ] **FORC-01.3**: Day-by-day iteration for 90 days to generate balance snapshots.

### Expected Income Engine (INC-01)
- [ ] **INC-01.1**: Auto-generate expected income entries from historical transaction patterns.
- [ ] **INC-01.2**: Provide UI for managing/overriding auto-generated expected income in `src/ui/expected-income.js`.

### Cash Flow UI & Dashboard (UI-01)
- [ ] **UI-01.1**: New "Cash Flow Planner" tab to view 90-day daily breakdown.
- [ ] **UI-01.2**: Add 90-day forecast chart to the main Dashboard.
- [ ] **UI-01.3**: Implement "Critical Date Warnings" for days where balance is predicted to fall below zero or a threshold.
- [ ] **UI-01.4**: Update `dashboard.js` and `charts.js` to integrate the new forecast data.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01.1 | Phase 17 | Pending |
| SCHEMA-01.2 | Phase 17 | Pending |
| SCHEMA-01.3 | Phase 17 | Pending |
| SCHEMA-01.4 | Phase 17 | Pending |
| SCHEMA-01.5 | Phase 17 | Pending |
| FORC-01.1   | Phase 18 | Pending |
| FORC-01.2   | Phase 18 | Pending |
| FORC-01.3   | Phase 18 | Pending |
| INC-01.1    | Phase 19 | Pending |
| INC-01.2    | Phase 19 | Pending |
| UI-01.1     | Phase 20 | Pending |
| UI-01.2     | Phase 20 | Pending |
| UI-01.3     | Phase 20 | Pending |
| UI-01.4     | Phase 20 | Pending |

---
*Last updated: 2026-03-01 after v1.1 milestone completion*

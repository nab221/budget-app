# Testing Patterns

**Analysis Date:** 2026-02-28

## Test Framework

**Runner:**
- Not detected - no test runner configured

**Assertion Library:**
- Not applicable - no automated tests present

**Run Commands:**
- No test scripts in project
- Manual testing only via browser opening `budget-app.html`

## Test File Organization

**Location:**
- No test files present - monolithic single-file application

**Naming:**
- Not applicable

**Structure:**
- Application code and styling coexist in `/d/code/github/budget-app/budget-app.html`
- No separate test directory

## Test Coverage

**Requirements:**
- None enforced - no test tooling integrated

**Current Coverage:**
- Zero automated test coverage
- Application relies entirely on manual testing in browser

## Testing Strategy

**Manual Testing Approach:**
Since no automated testing exists, the application is tested manually through:

1. **UI Interaction Testing** - End users manually interact with form inputs and buttons:
   - Data entry forms in each tab (Income, Fixed Spends, Variable, etc.)
   - Date pickers: `<input type="month" id="monthPicker"/>` (line 131)
   - Numeric inputs: `<input id="incAmount" type="number" step="0.01"/>` (line 159)
   - Dropdown selectors for categories and debt types

2. **Browser Data Persistence** - Manual verification:
   - IndexedDB integration via Dexie.js library (loaded from CDN, line 7)
   - Data persists across page reloads
   - Export/Import functionality for backup verification (lines 753-780)
   - Reset button clears all data (lines 782-787)

3. **Calculation Verification** - Manual testing of:
   - Debt payoff simulations (Snowball vs Avalanche strategies)
   - Minimum payment calculations: `calcMinPayment(debt, balance)` (lines 508-521)
   - Net worth and summary calculations (lines 714-732)
   - Interest calculations in statement processing

4. **Data Integrity** - Manual checks:
   - Adding/deleting records across all tables
   - Import merges data correctly: `if(Array.isArray(data.income))await db.income.bulkAdd(strip(data.income))` (line 771)
   - Export generates valid JSON with all tables (lines 754-763)

## Code Quality Assurances (No Automated Tests)

**Browser Console Debugging:**
- Dexie.js provides IndexedDB inspection in DevTools
- Developer can inspect `window.db` to verify state: `window.db.income.toArray()`
- Error messages from JSON parsing: `alert('Invalid JSON')` (line 768)

**Input Validation Pattern:**
All data entry follows early-return validation:
```javascript
// Example from renderIncome (lines 413-417):
async function renderIncome(){
  const mode=viewSelect.value;
  const rows=(await db.income.orderBy('date').toArray()).filter(r=>inRange(r.date,mode));
  document.getElementById('incBody').innerHTML=rows.map(r=>...).join('');
  return rows.reduce((s,r)=>s+(r.amount||0),0);
}

// Example from addIncBtn (lines 402-410):
document.getElementById('addIncBtn').addEventListener('click', async ()=>{
  const date=document.getElementById('incDate').value;
  const source=document.getElementById('incSource').value.trim()||'Unknown';
  const amount=parseFloat(document.getElementById('incAmount').value);
  if(!date||isNaN(amount))return;  // ← Early return if invalid
  await db.income.add({date,source,amount});
  document.getElementById('incAmount').value='';
  refreshAll();
});
```

**Calculation Testing Pattern:**
Payoff planner contains complex simulation logic that should be manually verified:
```javascript
// Lines 621-648: simulate() function
function simulate(order, extraMonthly){
  const ds=order.map(d=>({...d,bal:d.balance}));
  let months=0, totalInterest=0, totalPaid=0;
  const maxMonths=600;
  while(ds.some(d=>d.bal>0)&&months<maxMonths){
    months++;
    let extraLeft=extraMonthly;
    // pay interest & minimums
    for(const d of ds){
      if(d.bal<=0)continue;
      const mi=d.bal*(d.apr/100/12);
      d.bal+=mi;
      totalInterest+=mi;
      const mp=Math.min(d.bal, Math.max((d.minValue/100)*d.bal, d.minFloor||5));
      d.bal-=mp;
      totalPaid+=mp;
    }
    // apply extra to priority debt
    for(const d of ds){
      if(d.bal<=0||extraLeft<=0)continue;
      const pay=Math.min(d.bal,extraLeft);
      d.bal-=pay;
      extraLeft-=pay;
      totalPaid+=pay;
    }
  }
  return {months,totalInterest,totalPaid};
}
```

**Manual Test Scenarios:**
1. Create debt with £5000 balance at 20% APR
2. Add monthly statements with purchases/payments
3. Compare Snowball vs Avalanche with £100 extra per month
4. Verify month count and interest totals match expected calculations
5. Check that minimum payment rule variations work correctly

## Data Fixtures

**Test Data:**
- `DEFAULT_CATS` (lines 355-358) provides seed categories for testing:
```javascript
const DEFAULT_CATS = {
  fixed: ['Housing','Utilities','Credit Cards & Loans','Insurance','Health','Childcare','Professional Subscriptions','Savings','Other Fixed'],
  variable: ['Groceries','Eating Out / Takeaway','Clothing','Fuel / Transport','Miscellaneous','Entertainment','Gifts','Home / Garden']
};
```
- Seeding via "Seed defaults" button (line 249): `document.getElementById('seedCatsBtn')`

**Mock Data Generation:**
- No factories or builders
- All test data created through UI forms
- Export/Import feature enables test data backup/restore

## Integration Points (Browser-Based Testing)

**IndexedDB Integration:**
- Dexie.js handles database operations
- Can verify state via browser DevTools → Application → IndexedDB
- Manual inspection: `await db.debts.toArray()` in console

**Date/Time Handling:**
- `inRange()` function (lines 333-340) filters records by date range
- Manual tests verify filtering across 'current' (month), 'ytd', and 'all' modes:
```javascript
function inRange(dateStr,mode){
  if(mode==='all')return true;if(!dateStr)return false;
  const d=new Date(dateStr);if(isNaN(d))return false;
  const y=d.getFullYear(),m=d.getMonth();
  if(mode==='current')return y===anchorYear&&m===anchorMonth;
  if(mode==='ytd')return y===anchorYear&&m<=anchorMonth;
  return true;
}
```

**Currency Formatting:**
- `£()` function (lines 313-317) formats all currency:
```javascript
const £ = v => {
  if(v==null||isNaN(v)) return '£0.00';
  const neg = v < 0;
  return (neg?'-':'') + '£' + Math.abs(v).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
};
```
- Manual tests: verify negative values display with '-' prefix, verify decimal places

## Recommendations for Test Automation

**High Priority:**
1. **Debt Calculation Tests** - `calcMinPayment()` and `simulate()` contain financial logic that should have unit tests
2. **Date Range Filtering** - `inRange()` function should have edge case tests (year boundaries, leap years)
3. **Currency Parsing** - Test `£()` function with edge cases (null, NaN, very large numbers)

**Medium Priority:**
4. **Dexie Operations** - Test import/export JSON parsing with malformed data
5. **DOM Updates** - Test that `renderIncome()`, `renderDebts()` etc. correctly update tables
6. **State Consistency** - Test that deleting a debt also removes its statements

**Implementation Approach:**
- Add Jest or Vitest as dev dependency
- Extract financial calculations to separate `math.js` module for testing
- Create integration tests using Dexie's test database
- Use jsdom or happy-dom to test DOM rendering functions

---

*Testing analysis: 2026-02-28*

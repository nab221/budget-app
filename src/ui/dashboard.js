import {
  getDashboardData,
  getCurrentBalance,
  debtRepository,
  targetRepository,
  netWorthRepository,
  balanceSnapshotRepository,
  expectedIncomeRepository,
  childcareRepository,
  categoryRepository,
  getYearlyDailyIncome,
  getYearlyDailySpending,
  incomeSourceRepository,
  spendingBucketRepository,
  recurrentExpenseRepository,
  oneOffExpenseRepository,
  getSafetyBuffer,
  setSafetyBuffer,
  getLatestDailySnapshot,
  saveBalanceSnapshot
} from '../db/repository.js';
import { getDailyRollingData, calculateForecast } from '../utils/cashflow.js';
import { formatGBP, formatGBPShort, toPence, fromPence } from '../utils/currency.js';
import { simulatePayoff, calcMinPayment, calculateAmortisationSchedule } from '../utils/finance.js';
import { renderRollingOverviewChart, renderSpendingBreakdownChart } from './charts.js';
import { checkStoragePersistence } from './pwa-ux.js';
import { getEntitlementPeriod, calculateFundingGap } from '../utils/childcare.js';
import { modalUI, adjustFontSize } from './render.js';
import { renderSpendingHeatmap } from './heatmap.js';
import { pickInvariantForecastKpis, rebaseForecastSnapshots } from './dashboard-kpis.js';
import { getUpcomingIncomeEvents } from '../utils/income.js';
import { getPayPeriodBounds, getBillsInPayPeriod, calculatePayPeriodSummary } from '../utils/pay-period.js';
import { normalizeChildcareTopUps, includeChildcareTopUpsInCommittedOutgoings } from '../utils/affordability.js';
import { createSegmentedControl } from './components/segmented-control.js';

let _selectedMonth = new Date().toISOString().slice(0, 7);
let _selectedView = 'current';
let _dashboardForecastSnapshots = [];

// Pay-period affordability navigator state.
// _payPeriodOffset: how many income events forward/back from today's boundary.
// 0 = the current pay period (from today to next income event).
let _payPeriodOffset = 0;

function normalizeMonth(value) {
  return (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value))
    ? value
    : new Date().toISOString().slice(0, 7);
}

/**
 * Initialize Dashboard UI listeners and first render.
 */
export async function initDashboard() {
  // Phase 36: Measure the real rendered header height and set --header-height CSS variable.
  // This drives both the desktop sticky top and the mobile fixed top for the navigator shell,
  // ensuring it sits exactly below the header regardless of font size or toolbar wrapping.
  const headerEl = document.querySelector('header');
  if (headerEl) {
    const headerH = Math.ceil(headerEl.getBoundingClientRect().height);
    if (headerH > 0) {
      document.documentElement.style.setProperty('--header-height', `${headerH}px`);
    }
  }

  // Phase 36: Replace legacy viewSelect with accessible segmented control.
  // Fallback: also support legacy viewSelect if present (e.g. during tests or cached HTML).
  const segMount = document.getElementById('dashboardViewSegmentedControl');
  if (segMount) {
    createSegmentedControl({
      container: segMount,
      name: 'dashboard-view',
      options: [
        { value: 'current', label: 'This Month' },
        { value: 'ytd', label: 'Year to Date' },
        { value: 'all', label: 'All Time' },
      ],
      value: _selectedView,
      onChange: (nextValue) => {
        _selectedView = nextValue;
        renderDashboard();
      },
    });
  } else {
    // Legacy fallback: support <select id="viewSelect"> if present
    const viewSelect = document.getElementById('viewSelect');
    if (viewSelect) {
      viewSelect.value = _selectedView;
      viewSelect.addEventListener('change', (e) => {
        _selectedView = e.target.value;
        renderDashboard();
      });
    }
  }

  // First render
  await renderDashboard();
}

/**
 * Renders the month navigator (Select + Prev/Next buttons)
 */
function renderMonthNavigator(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  _selectedMonth = normalizeMonth(_selectedMonth);

  const [year, month] = _selectedMonth.split('-').map(Number);

  // Create select options for +/- 24 months
  let options = '';
  for (let i = -24; i <= 24; i++) {
    const d = new Date(Date.UTC(year, month - 1 + i, 1));
    const val = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    options += `<option value="${val}" ${val === _selectedMonth ? 'selected' : ''}>${label}</option>`;
  }

  container.innerHTML = `
    <button class="prev-month">◀</button>
    <select class="month-select">${options}</select>
    <button class="next-month">▶</button>
  `;

  container.querySelector('.prev-month').onclick = () => {
    const d = new Date(Date.UTC(year, month - 2, 1));
    _selectedMonth = d.toISOString().slice(0, 7);
    renderDashboard();
  };
  container.querySelector('.next-month').onclick = () => {
    const d = new Date(Date.UTC(year, month, 1));
    _selectedMonth = d.toISOString().slice(0, 7);
    renderDashboard();
  };
  container.querySelector('.month-select').onchange = (e) => {
    _selectedMonth = normalizeMonth(e.target.value);
    renderDashboard();
  };
}

/**
 * Render the dashboard summary cards and the daily rolling chart.
 */
export async function renderDashboard() {
  const container = document.getElementById('summaryGrid');
  if (!container) return;

  _selectedMonth = normalizeMonth(_selectedMonth);

  renderMonthNavigator('dashboardMonthPicker');

  // Phase 36: Show/hide month picker based on selected view mode.
  // Month selector is only relevant in 'current' (This Month) mode.
  const pickerContainer = document.getElementById('dashboardMonthPicker');
  if (pickerContainer) {
    pickerContainer.style.display = _selectedView === 'current' ? '' : 'none';
  }

  // Map 'current' (from UI) to 'month' (from repository)
  const normalizedPeriod = _selectedView === 'current' ? 'month' : _selectedView;

  const [data, rollingData, isPersisted, categories] = await Promise.all([
    getDashboardData(normalizedPeriod, _selectedMonth),
    getDailyRollingData(_selectedMonth),
    checkStoragePersistence(),
    categoryRepository.getCategories()
  ]);

  // 1. Render Rolling Chart (365 Days Daily)
  try {
    renderRollingOverviewChart('rollingOverviewChart', rollingData);
    
    // Add Forecast Table Toggle and Container if not present
    let forecastActionCont = document.getElementById('dashboardForecastActions');
    if (!forecastActionCont) {
      const chartCont = document.getElementById('rollingOverviewChartContainer');
      if (chartCont) {
        forecastActionCont = document.createElement('div');
        forecastActionCont.id = 'dashboardForecastActions';
        forecastActionCont.style.cssText = 'display:flex; justify-content:center; margin-top:10px; margin-bottom:15px;';
        
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggleForecastTableBtn';
        toggleBtn.className = 'ghost sm';
        toggleBtn.textContent = '📋 Show Detailed 45-Day Forecast';
        toggleBtn.onclick = () => toggleForecastTable();
        
        forecastActionCont.appendChild(toggleBtn);
        chartCont.parentNode.insertBefore(forecastActionCont, chartCont.nextSibling);

        const tableCont = document.createElement('div');
        tableCont.id = 'dashboardForecastTableContainer';
        tableCont.className = 'hidden';
        tableCont.style.cssText = 'margin-top:15px; overflow-x:auto; max-height:400px; border-top:1px solid var(--border-light);';
        chartCont.parentNode.insertBefore(tableCont, forecastActionCont.nextSibling);
      }
    }
    
    // If table is visible, re-render it
    const tableCont = document.getElementById('dashboardForecastTableContainer');
    if (tableCont && !tableCont.classList.contains('hidden')) {
      await renderForecastTable();
    }

  } catch (err) {
    console.warn('Could not render rolling overview chart:', err);
  }

  // 2. Render Spending Breakdown & Savings Rate
  try {
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
    const namedSpending = {};
    Object.entries(data.categorySpending).forEach(([id, amt]) => {
      const name = catMap[id] || 'Other';
      namedSpending[name] = (namedSpending[name] || 0) + amt;
    });
    renderSpendingBreakdownChart('spendingBreakdownChart', namedSpending);

    const savingsRateKPI = document.getElementById('savingsRateKPI');
    if (savingsRateKPI) {
      const savings = data.income - data.totalExpenses;
      const rate = data.income > 0 ? Math.max(0, Math.round((savings / data.income) * 100)) : 0;
      
      let rateColor = 'var(--danger)';
      if (rate >= 20) rateColor = 'var(--accent)';
      else if (rate >= 10) rateColor = 'var(--warn)';

      savingsRateKPI.innerHTML = `
        <div style="font-size: 3rem; font-weight: 800; color: ${rateColor}"><span class="privacy-blur">${rate}%</span></div>
        <div class="sum-label" style="margin-top: 5px">Monthly Savings Rate</div>
        <div class="hint" style="margin-top: 10px; text-align: center">
          Target: 20%+<br/>
          Current Savings: <span class="privacy-blur">${formatGBP(savings)}</span>
        </div>
      `;
    }
  } catch (err) {
    console.warn('Could not render spending breakdown or savings KPI:', err);
  }

  // 3. Fetch/Calculate Consolidated Data
  const debts = await debtRepository.getAll();
  const today = new Date().toISOString().split('T')[0];

  // Keep these KPIs invariant by always using today's forecast baseline.
  let forecastSnapshots = [];
  try {
    forecastSnapshots = await calculateForecast(today, 90);

    // Keep all dashboard balance surfaces aligned on today's chart balance.
    const rollingTodayBalance =
      rollingData && Number.isInteger(rollingData.todayIndex) && rollingData.todayIndex >= 0
        ? rollingData?.data?.balance?.[rollingData.todayIndex]
        : null;
    if (Number.isFinite(rollingTodayBalance)) {
      forecastSnapshots = rebaseForecastSnapshots(forecastSnapshots, rollingTodayBalance);
    }
  } catch (err) {
    console.warn('Could not calculate invariant forecast KPIs:', err);
  }

  _dashboardForecastSnapshots = forecastSnapshots;

  const invariantKpis = pickInvariantForecastKpis(forecastSnapshots);

  // Next Negative Alert warning
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 45);
  const horizonStr = horizon.toISOString().split('T')[0];
  const firstNeg = forecastSnapshots
    .filter(s => s.date >= today && s.date <= horizonStr && s.closingBalance < 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  // Debt Stats
  const extraMonthlyPounds = parseFloat(localStorage.getItem('payoffExtra')) || 0;
  const extraMonthlyPence = extraMonthlyPounds * 100;
  const totalMinPayments = debts.reduce((sum, d) => sum + calcMinPayment(d.currentBalance, d.apr, 0, new Date(), d.promoEndDate), 0);
  const totalRepayment = totalMinPayments + extraMonthlyPence;
  const repaymentImpactPercent = data.income > 0 ? Math.round((totalRepayment / data.income) * 100) : 0;
  
  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
  const hasExpiringPromo = debts.some(d => d.promoEndDate && new Date(d.promoEndDate) <= sixtyDaysFromNow && new Date(d.promoEndDate) >= new Date());

  // 4. Define the new card order
  const cards = [
    // Balance Banner (3 standardized cards)
    { 
      id: 'balance-card',
      label: 'Running Balance', 
      value: invariantKpis.runningBalance,
      color: 'var(--accent)',
      isBanner: true,
      canEdit: true
    },
    { 
      label: 'Next Month Forecast', 
      value: invariantKpis.nextMonthForecast,
      color: 'var(--info)',
      isBanner: true,
      isForecast: true
    },
    { 
      label: '3-Month Forecast', 
      value: invariantKpis.threeMonthForecast,
      color: 'var(--info)',
      isBanner: true,
      isForecast: true
    },
    // Standard cards
    { label: 'Income', value: data.income, color: 'var(--accent)' },
    { label: 'Expenses', value: data.totalExpenses, color: 'var(--danger)' },
    { label: 'Net Position', value: data.netPosition, color: data.netPosition >= 0 ? 'var(--accent)' : 'var(--danger)' },
    { label: 'Total Debt', value: data.totalDebt, color: 'var(--danger)' },
    { 
      label: 'Debt Repayment Stats', 
      value: totalRepayment, 
      color: repaymentImpactPercent > 30 ? 'var(--danger)' : repaymentImpactPercent > 15 ? 'var(--warn)' : 'var(--text-soft)',
      note: `${repaymentImpactPercent}% of income`,
      warning: hasExpiringPromo ? { title: 'Promo Expiring', text: 'Check Debts tab' } : null
    },
    { label: 'Total Assets', value: data.totalAssets, color: 'var(--accent)' },
    { 
      label: 'Childcare', 
      value: data.childcareSummary.reduce((s, c) => s + c.balance, 0), 
      color: 'var(--info)',
      childcare: data.childcareSummary
    },
    {
      label: 'Net Worth',
      badge: !isPersisted ? { text: 'Risk', title: 'Storage persistence not granted.' } : null,
      value: data.netWorth,
      color: data.netWorth >= 0 ? 'var(--accent)' : 'var(--danger)'
    }
  ];

  container.textContent = '';
  for (const card of cards) {
    // Filter out null values (per Task 3)
    if (card.value === null || card.value === undefined) continue;

    const item = document.createElement('div');
    item.className = card.isBanner ? 'dashboard-card' : 'sum-item';
    if (card.isForecast) item.classList.add('forecast-card');

    if (card.warning) {
      item.style.borderColor = 'var(--danger)';
      item.style.borderWidth = '2px';
    }

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'flex-start';

    const labelEl = document.createElement('div');
    labelEl.className = 'sum-label';
    labelEl.textContent = card.label;
    if (card.badge) {
      const b = document.createElement('span');
      b.className = 'pill';
      b.style.background = 'var(--danger)';
      b.style.color = '#fff';
      b.style.fontSize = '0.6rem';
      b.textContent = card.badge.text;
      b.title = card.badge.title;
      labelEl.appendChild(b);
    }
    head.appendChild(labelEl);

    if (card.canEdit) {
      const editBtn = document.createElement('button');
      editBtn.className = 'ghost sm';
      editBtn.style.padding = '2px';
      editBtn.innerHTML = '✏️';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        openBalanceAdjustmentModal(invariantKpis.runningBalance);
      };
      head.appendChild(editBtn);
    }
    item.appendChild(head);

    const valEl = document.createElement('div');
    valEl.className = 'sum-val';
    valEl.style.color = card.color;
    
    // Use centralized adjustFontSize from render.js
    adjustFontSize(valEl, card.value);
    item.appendChild(valEl);

    if (card.note) {
      const note = document.createElement('div');
      note.className = 'sum-note';
      note.textContent = card.note;
      item.appendChild(note);
    }

    if (card.warning) {
      const warn = document.createElement('div');
      warn.style.cssText = 'font-size:0.65rem; color:var(--danger); font-weight:600; margin-top:4px;';
      warn.innerHTML = `⚠️ ${card.warning.title}: <span class="privacy-blur">${card.warning.text}</span>`;
      item.appendChild(warn);
    }

    if (card.childcare && card.childcare.length > 0) {
      const list = document.createElement('div');
      list.style.marginTop = '8px';
      card.childcare.forEach(c => {
        const row = document.createElement('div');
        row.style.cssText = 'font-size:0.7rem; display:flex; justify-content:space-between; border-top:1px solid var(--border-light); padding:2px 0';
        row.innerHTML = `<span>${c.account.childName}</span> <span class="privacy-blur">${formatGBPShort(c.balance)}</span>`;
        list.appendChild(row);
      });
      item.appendChild(list);
    }

    container.appendChild(item);
  }

  // 5. Render Income Heatmap
  try {
    const year = parseInt(_selectedMonth.slice(0, 4));
    const currentYearData = await getYearlyDailyIncome(year);
    renderSpendingHeatmap('incomeHeatmapContainer', year, currentYearData);
  } catch (err) {
    console.warn('Could not render income heatmap:', err);
  }

  // 6. Render Spending Heatmap
  try {
    const year = parseInt(_selectedMonth.slice(0, 4));
    const currentYearData = await getYearlyDailySpending(year);
    renderSpendingHeatmap('spendingHeatmapContainer', year, currentYearData);
  } catch (err) {
    console.warn('Could not render spending heatmap:', err);
  }

  // 7. Render Pay-Period Affordability Section
  try {
    await renderPayPeriodSection();
  } catch (err) {
    console.warn('Could not render pay-period section:', err);
  }
}

// ---------------------------------------------------------------------------
// Pay-Period Affordability Section (Phase 34)
// ---------------------------------------------------------------------------

/**
 * Formats a pence value as a GBP string for pay-period display.
 * @param {number} pence
 * @returns {string}
 */
function _fmtPPAmount(pence) {
  return formatGBPShort(pence);
}

/**
 * Formats a Date or YYYY-MM-DD string for display in the timeline.
 * @param {Date|string} d
 * @returns {string}
 */
function _fmtPPDate(d) {
  const dateObj = d instanceof Date ? d : new Date(`${d}T00:00:00Z`);
  return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Ensures the pay-period section container exists in the DOM.
 * Creates it after summaryGrid if not present.
 * @returns {HTMLElement}
 */
function _ensurePayPeriodContainer() {
  let section = document.getElementById('payPeriodSection');
  if (!section) {
    section = document.createElement('div');
    section.id = 'payPeriodSection';
    section.style.cssText = 'margin-top:24px; padding:0 4px;';

    // Insert after summaryGrid (or append to body as fallback)
    const grid = document.getElementById('summaryGrid');
    if (grid && grid.parentNode) {
      grid.parentNode.insertBefore(section, grid.nextSibling);
    } else {
      document.body.appendChild(section);
    }
  }
  return section;
}

/**
 * Renders the pay-period affordability section below the summary cards.
 *
 * Reads income sources, spending buckets, balance snapshot, and recurrent/one-off
 * expenses to build the affordability view. Does NOT replace the existing
 * month navigator or summary card rendering.
 */
async function renderPayPeriodSection() {
  const section = _ensurePayPeriodContainer();
  section.innerHTML = ''; // Clear previous render

  // Fetch all required data in parallel
  const today = new Date().toISOString().split('T')[0];

  const [
    activeSources,
    allRecurring,
    allOneOff,
    spendingBuckets,
    safetyBuffer,
    latestSnapshot,
    allDebts,
    childcareTopUpAggregate
  ] = await Promise.all([
    incomeSourceRepository.getActive(),
    recurrentExpenseRepository.getAll(),
    oneOffExpenseRepository.getAll(),
    spendingBucketRepository.getAll(),
    getSafetyBuffer(),
    getLatestDailySnapshot(),
    debtRepository.getAll(),
    childcareRepository.getAllRequiredTopUps().catch(() => ({ topUps: [], totalTopUpPence: 0 }))
  ]);

  // Section header with balance-entry button
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-top:2px solid var(--border-light); padding-top:16px;';

  const title = document.createElement('h3');
  title.style.cssText = 'margin:0; font-size:1rem; font-weight:700;';
  title.textContent = 'Pay-Period Affordability';
  header.appendChild(title);

  const headerBtns = document.createElement('div');
  headerBtns.style.cssText = 'display:flex; gap:8px;';

  const balanceBtn = document.createElement('button');
  balanceBtn.className = 'ghost sm';
  balanceBtn.setAttribute('data-action', 'enter-balance');
  balanceBtn.textContent = 'Enter Balance';
  balanceBtn.onclick = () => openPayPeriodBalanceModal(latestSnapshot ? latestSnapshot.closingBalance : 0, safetyBuffer);
  headerBtns.appendChild(balanceBtn);

  header.appendChild(headerBtns);
  section.appendChild(header);

  // Opening balance display
  const openingBalance = latestSnapshot ? latestSnapshot.closingBalance : 0;
  const snapshotDateStr = latestSnapshot ? latestSnapshot.date : today;

  // Build income events from active sources (use _payPeriodOffset to navigate)
  // For offset navigation: generate enough upcoming events to skip forward
  const eventsNeeded = Math.max(1, _payPeriodOffset + 2) * activeSources.length + 5;
  const allUpcomingEvents = getUpcomingIncomeEvents(activeSources, snapshotDateStr, eventsNeeded);

  // Skip _payPeriodOffset events to find the right window
  // Each "step" skips to the next income event boundary
  let referenceDate = snapshotDateStr;
  let eventsForBounds = allUpcomingEvents;

  if (_payPeriodOffset > 0 && allUpcomingEvents.length > 0) {
    // Advance reference date by _payPeriodOffset income-event boundaries
    let offsetCount = 0;
    let cursor = snapshotDateStr;
    while (offsetCount < _payPeriodOffset) {
      const bounds = getPayPeriodBounds(
        getUpcomingIncomeEvents(activeSources, cursor, activeSources.length + 5),
        cursor
      );
      if (!bounds || !bounds.nextIncomeEvent) break;

      // Move cursor to day after end (the boundary event date itself is the start of next period)
      const nextCursor = bounds.nextIncomeEvent.adjustedDate;
      cursor = nextCursor;
      offsetCount++;
    }
    referenceDate = cursor;
    eventsForBounds = getUpcomingIncomeEvents(activeSources, referenceDate, activeSources.length + 5);
  } else if (_payPeriodOffset < 0) {
    // Backward navigation is clamped at 0 (can't go before current snapshot date)
    // (Clamping is done in the navigation handler, not in render)
  }

  // Derive pay-period bounds from income-event collection
  const bounds = getPayPeriodBounds(eventsForBounds, referenceDate);

  // --- No income sources configured ---
  if (!bounds) {
    const noIncome = document.createElement('div');
    noIncome.style.cssText = 'padding:16px; background:var(--bg-alt); border-radius:8px; text-align:center; color:var(--text-dim);';
    noIncome.textContent = activeSources.length === 0
      ? 'No income sources configured. Add an income source in Settings to see pay-period affordability.'
      : 'No upcoming income events found. Check your income source configuration in Settings.';
    section.appendChild(noIncome);
    return;
  }

  // Period window label and navigator
  const windowBar = document.createElement('div');
  windowBar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'ghost sm';
  prevBtn.setAttribute('data-action', 'prev-period');
  prevBtn.textContent = '← Prev';
  prevBtn.onclick = () => {
    if (_payPeriodOffset > 0) {
      _payPeriodOffset--;
    } else {
      _payPeriodOffset = Math.max(0, _payPeriodOffset - 1);
    }
    renderPayPeriodSection().catch(console.error);
  };
  // Disable prev if at start (offset=0)
  if (_payPeriodOffset <= 0) prevBtn.disabled = true;

  const windowLabel = document.createElement('span');
  windowLabel.style.cssText = 'font-size:0.85rem; font-weight:600; color:var(--text-soft);';
  windowLabel.textContent = `${_fmtPPDate(bounds.start)} – ${_fmtPPDate(bounds.end)}`;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'ghost sm';
  nextBtn.setAttribute('data-action', 'next-period');
  nextBtn.textContent = 'Next →';
  nextBtn.onclick = () => {
    _payPeriodOffset++;
    renderPayPeriodSection().catch(console.error);
  };

  windowBar.appendChild(prevBtn);
  windowBar.appendChild(windowLabel);
  windowBar.appendChild(nextBtn);
  section.appendChild(windowBar);

  // Next income metadata
  if (bounds.nextIncomeEvent) {
    const incomeRow = document.createElement('div');
    incomeRow.style.cssText = 'font-size:0.8rem; color:var(--text-dim); margin-bottom:8px;';
    incomeRow.innerHTML = `Next income: <strong>${bounds.nextIncomeEvent.sourceName}</strong> <span class="privacy-blur">${_fmtPPAmount(bounds.nextIncomeEvent.amount)}</span> on ${_fmtPPDate(bounds.nextIncomeEvent.adjustedDate)}`;
    section.appendChild(incomeRow);
  }

  // Opening balance row
  const openRow = document.createElement('div');
  openRow.style.cssText = 'display:flex; justify-content:space-between; font-size:0.85rem; padding:4px 0; border-bottom:1px solid var(--border-light); margin-bottom:4px;';
  openRow.innerHTML = `<span style="color:var(--text-dim)">Opening balance (${snapshotDateStr})</span> <span class="privacy-blur" style="font-weight:700">${_fmtPPAmount(openingBalance)}</span>`;
  section.appendChild(openRow);

  // Get bills in pay period, enriched with amortisation data for loan/mortgage
  const rawBills = getBillsInPayPeriod(allRecurring, allOneOff, spendingBuckets, bounds.start, bounds.end, null);

  // Include childcare top-up line items in committed outgoings (CHILD-02)
  const childcareNormalized = normalizeChildcareTopUps(childcareTopUpAggregate.topUps);
  const rawBillsWithChildcare = includeChildcareTopUpsInCommittedOutgoings(rawBills, childcareNormalized);

  // Enrich loan/mortgage bills with interest/principal split
  const bills = rawBillsWithChildcare.map(bill => {
    if (bill.isDebtPayment && (bill.debtType === 'loan' || bill.debtType === 'mortgage') && bill.debtId) {
      const debt = allDebts.find(d => d.id === bill.debtId);
      if (debt && debt.fixedMonthlyPayment > 0 && debt.currentBalance > 0) {
        try {
          const { schedule } = calculateAmortisationSchedule({
            outstandingBalance: debt.currentBalance,
            annualInterestRate: (debt.interestRate || debt.apr || 0) / 100,
            monthlyPayment: debt.fixedMonthlyPayment,
            paymentDayOfMonth: debt.paymentDayOfMonth || 1,
            paymentAdjustment: 'none',
            startDate: bill.date
          });
          if (schedule && schedule.length > 0) {
            return {
              ...bill,
              debtBreakdown: {
                interestAmount: schedule[0].interestPence,
                principalAmount: schedule[0].principalPence
              }
            };
          }
        } catch (_e) {
          // amortisation error — show full payment without split
        }
      }
    }
    return bill;
  });

  // Calculate summary
  const summary = calculatePayPeriodSummary(openingBalance, bills, safetyBuffer);

  // Deficit / safety buffer banners
  if (summary.isDeficit) {
    const banner = document.createElement('div');
    banner.style.cssText = 'background:rgba(239,68,68,0.12); border:1px solid var(--danger); border-radius:6px; padding:8px 12px; margin-bottom:8px; font-size:0.82rem; color:var(--danger); font-weight:600;';
    banner.textContent = `Projected deficit of ${_fmtPPAmount(Math.abs(summary.closingBalance))} — this pay period has a shortfall.`;
    section.appendChild(banner);
  } else if (summary.isBelowBuffer) {
    const banner = document.createElement('div');
    banner.style.cssText = 'background:rgba(251,191,36,0.12); border:1px solid var(--warn,#f59e0b); border-radius:6px; padding:8px 12px; margin-bottom:8px; font-size:0.82rem; color:var(--warn,#b45309); font-weight:600;';
    banner.textContent = `Closing balance is below your safety buffer (${_fmtPPAmount(safetyBuffer)}).`;
    section.appendChild(banner);
  }

  // Timeline table
  if (summary.rows.length > 0) {
    const tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'overflow-x:auto; margin-bottom:8px;';

    const table = document.createElement('table');
    table.className = 'tbl sm';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Date</th>
          <th>Bill</th>
          <th class="r">Amount</th>
          <th class="r">Running Balance</th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement('tbody');
    for (const row of summary.rows) {
      const tr = document.createElement('tr');
      if (row.runningBalance < 0) tr.style.background = 'rgba(239,68,68,0.06)';

      const dateTd = document.createElement('td');
      dateTd.style.cssText = 'font-size:0.78rem;';
      dateTd.textContent = _fmtPPDate(row.date);
      if (row.isAdjusted) {
        const adj = document.createElement('span');
        adj.title = 'Date adjusted for bank holiday/weekend';
        adj.style.cssText = 'font-size:0.6rem; color:var(--info); margin-left:2px;';
        adj.textContent = '*';
        dateTd.appendChild(adj);
      }
      tr.appendChild(dateTd);

      const nameTd = document.createElement('td');
      nameTd.style.cssText = 'font-size:0.78rem;';
      nameTd.textContent = row.name;
      tr.appendChild(nameTd);

      const amtTd = document.createElement('td');
      amtTd.className = 'r';
      amtTd.style.cssText = 'font-size:0.78rem; color:var(--danger);';
      amtTd.innerHTML = `<span class="privacy-blur">${_fmtPPAmount(row.amount)}</span>`;
      tr.appendChild(amtTd);

      const balTd = document.createElement('td');
      balTd.className = 'r';
      balTd.style.cssText = `font-size:0.78rem; font-weight:600; color:${row.runningBalance < 0 ? 'var(--danger)' : 'inherit'};`;
      balTd.innerHTML = `<span class="privacy-blur">${_fmtPPAmount(row.runningBalance)}</span>`;
      tr.appendChild(balTd);

      tbody.appendChild(tr);

      // Interest split row for loan/mortgage
      if (row.debtBreakdown) {
        const splitTr = document.createElement('tr');
        splitTr.style.cssText = 'background:rgba(0,0,0,0.02);';

        const emptyDate = document.createElement('td');
        splitTr.appendChild(emptyDate);

        const splitLabel = document.createElement('td');
        splitLabel.style.cssText = 'font-size:0.7rem; color:var(--text-dim); padding-left:16px;';
        splitLabel.textContent = `↳ of which interest: ${_fmtPPAmount(row.debtBreakdown.interestAmount)} / principal: ${_fmtPPAmount(row.debtBreakdown.principalAmount)}`;
        splitTr.appendChild(splitLabel);

        const emptyAmt = document.createElement('td');
        splitTr.appendChild(emptyAmt);
        const emptyBal = document.createElement('td');
        splitTr.appendChild(emptyBal);

        tbody.appendChild(splitTr);
      }
    }

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    section.appendChild(tableWrap);
  } else {
    const noExpenses = document.createElement('div');
    noExpenses.style.cssText = 'padding:10px 0; color:var(--text-dim); font-size:0.82rem;';
    noExpenses.textContent = 'No committed expenses in this pay period.';
    section.appendChild(noExpenses);
  }

  // Projected closing balance
  const closingRow = document.createElement('div');
  closingRow.style.cssText = 'display:flex; justify-content:space-between; font-size:0.88rem; padding:6px 0; border-top:1px solid var(--border-light); margin-top:4px;';
  closingRow.innerHTML = `
    <span style="font-weight:600;">Projected balance at next income</span>
    <span class="privacy-blur" style="font-weight:700; color:${summary.closingBalance < 0 ? 'var(--danger)' : 'inherit'};">
      ${_fmtPPAmount(summary.closingBalance)}
    </span>
  `;
  section.appendChild(closingRow);

  // Max extra payment line
  const maxExtra = Math.max(0, summary.closingBalance - safetyBuffer);
  const extraRow = document.createElement('div');
  extraRow.style.cssText = 'display:flex; justify-content:space-between; font-size:0.82rem; padding:4px 0; color:var(--text-dim);';
  extraRow.innerHTML = `
    <span>Max extra payment (safe to pay)</span>
    <span class="privacy-blur" style="font-weight:700; color:${maxExtra > 0 ? 'var(--accent)' : 'var(--text-dim)'};">
      ${_fmtPPAmount(maxExtra)}
    </span>
  `;
  section.appendChild(extraRow);

  // Footnote for adjusted dates
  if (bills.some(b => b.isAdjusted)) {
    const footnote = document.createElement('div');
    footnote.style.cssText = 'font-size:0.65rem; color:var(--text-dim); margin-top:6px;';
    footnote.textContent = '* Date adjusted for bank holiday or weekend';
    section.appendChild(footnote);
  }
}

/**
 * Opens the balance-entry modal for the pay-period affordability view.
 * Writes to the dailyBalanceSnapshots path via saveBalanceSnapshot.
 *
 * @param {number} currentBalancePence - current snapshot balance in pence
 * @param {number} safetyBufferPence - current safety buffer in pence
 */
function openPayPeriodBalanceModal(currentBalancePence, safetyBufferPence) {
  const content = `
    <div style="padding:10px">
      <label style="display:block;margin-bottom:8px">Current Account Balance (£)</label>
      <input type="number" id="ppBalanceInput" step="0.01"
        value="${(currentBalancePence / 100).toFixed(2)}"
        style="width:100%;font-size:1.2rem;padding:10px; margin-bottom:12px;"/>
      <label style="display:block;margin-bottom:8px">Snapshot Date</label>
      <input type="date" id="ppSnapshotDateInput"
        value="${new Date().toISOString().split('T')[0]}"
        style="width:100%;padding:8px; margin-bottom:12px;"/>
      <label style="display:block;margin-bottom:8px">Safety Buffer (£)</label>
      <input type="number" id="ppSafetyBufferInput" step="0.01"
        value="${(safetyBufferPence / 100).toFixed(2)}"
        style="width:100%;padding:8px;"/>
      <div class="hint" style="margin-top:10px">
        The safety buffer is the minimum balance you want to keep. Any projected balance above this can be used for extra payments.
      </div>
    </div>
  `;

  modalUI.show('Set Pay-Period Balance', content, [
    { label: 'Cancel', className: 'ghost', onClick: () => modalUI.close() },
    { label: 'Save', className: 'primary', onClick: async () => {
      const balVal = parseFloat(document.getElementById('ppBalanceInput').value);
      const dateVal = document.getElementById('ppSnapshotDateInput').value;
      const bufVal = parseFloat(document.getElementById('ppSafetyBufferInput').value);

      if (isNaN(balVal) || !dateVal) {
        notificationUI.warning('Please enter a valid balance and date.');
        return;
      }

      const balPence = Math.round(balVal * 100);
      await saveBalanceSnapshot(dateVal, balPence);

      if (!isNaN(bufVal)) {
        const bufPence = Math.round(bufVal * 100);
        await setSafetyBuffer(bufPence);
      }

      modalUI.close();
      await renderPayPeriodSection();
    }}
  ]);
}

/**
 * Modal to adjust current balance.
 */
function openBalanceAdjustmentModal(currentBalancePence) {
  const content = `
    <div style="padding:10px">
      <label style="display:block;margin-bottom:8px">Actual Bank Balance (£)</label>
      <input type="number" id="adjBalanceInput" step="0.01" value="${(currentBalancePence / 100).toFixed(2)}" style="width:100%;font-size:1.2rem;padding:10px"/>
      <div class="hint" style="margin-top:10px">A "Balance Adjustment" transaction will be created for today to match this amount.</div>
    </div>
  `;
  
  modalUI.show('Set Current Balance', content, [
    { label: 'Cancel', className: 'ghost', onClick: () => modalUI.close() },
    { label: 'Save Balance', className: 'primary', onClick: async () => {
      const val = parseFloat(document.getElementById('adjBalanceInput').value);
      if (isNaN(val)) return;
      
      const { adjustBalance } = await import('../db/repository.js');
      const today = new Date().toISOString().split('T')[0];
      await adjustBalance(Math.round(val * 100), today);
      modalUI.close();
      if (window.app) window.app.renderAll();
    }}
  ]);
}

/**
 * Toggles the visibility of the 90-day forecast table.
 */
export async function toggleForecastTable() {
  const tableCont = document.getElementById('dashboardForecastTableContainer');
  const btn = document.getElementById('toggleForecastTableBtn');
  if (!tableCont || !btn) return;

  const isHidden = tableCont.classList.contains('hidden');
  if (isHidden) {
    tableCont.classList.remove('hidden');
    btn.textContent = '✖ Hide Detailed Forecast';
    await renderForecastTable();
  } else {
    tableCont.classList.add('hidden');
    btn.textContent = '📋 Show Detailed 45-Day Forecast';
  }
}

/**
 * Renders the 45-day daily forecast table.
 */
async function renderForecastTable() {
  const tableCont = document.getElementById('dashboardForecastTableContainer');
  if (!tableCont) return;

  tableCont.innerHTML = '<div class="hint" style="text-align:center; padding:20px">Calculating 45-day forecast...</div>';

  try {
    const snapshots = Array.isArray(_dashboardForecastSnapshots)
      ? _dashboardForecastSnapshots.slice(0, 45)
      : [];

    if (!snapshots || snapshots.length === 0) {
      tableCont.innerHTML = '<div class="hint" style="text-align:center; padding:20px">No forecast data available.</div>';
      return;
    }

    tableCont.innerHTML = `
      <table class="tbl sm">
        <thead>
          <tr>
            <th>Date</th>
            <th class="r">In</th>
            <th class="r">Out</th>
            <th class="r">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${snapshots.map(s => {
            const dateObj = new Date(s.date);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const rowStyle = s.closingBalance < 0 ? 'background:rgba(239,68,68,0.1)' : '';
            const dateStyle = isWeekend ? 'color:var(--text-dim)' : '';
            
            return `
              <tr style="${rowStyle}">
                <td style="${dateStyle}">
                  ${s.date} <span style="font-size:0.6rem; opacity:0.7">${dateObj.toLocaleDateString('en-GB', {weekday:'short'})}</span>
                  ${s.hasDebtPayment ? ' 💳' : ''}
                </td>
                <td class="r" style="color:var(--success)"><span class="privacy-blur">${s.incomeTotal > 0 ? formatGBPShort(s.incomeTotal) : '—'}</span></td>
                <td class="r" style="color:var(--danger)"><span class="privacy-blur">${s.expenseTotal > 0 ? formatGBPShort(s.expenseTotal) : '—'}</span></td>
                <td class="r" style="font-weight:600; color:${s.closingBalance < 0 ? 'var(--danger)' : 'inherit'}">
                  <span class="privacy-blur">${formatGBPShort(s.closingBalance)}</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error('Failed to render forecast table:', err);
    tableCont.innerHTML = '<div class="hint" style="text-align:center; padding:20px; color:var(--danger)">Failed to calculate forecast.</div>';
  }
}

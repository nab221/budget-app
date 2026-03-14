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
  getYearlyDailySpending
} from '../db/repository.js';
import { getDailyRollingData, calculateForecast } from '../utils/cashflow.js';
import { formatGBP, formatGBPShort, toPence, fromPence } from '../utils/currency.js';
import { simulatePayoff, calcMinPayment } from '../utils/finance.js';
import { renderRollingOverviewChart, renderSpendingBreakdownChart } from './charts.js';
import { checkStoragePersistence } from './pwa-ux.js';
import { getEntitlementPeriod, calculateFundingGap } from '../utils/childcare.js';
import { modalUI, adjustFontSize } from './render.js';
import { renderSpendingHeatmap } from './heatmap.js';
import { pickInvariantForecastKpis, rebaseForecastSnapshots } from './dashboard-kpis.js';

let _selectedMonth = new Date().toISOString().slice(0, 7);
let _selectedView = 'current';
let _dashboardForecastSnapshots = [];

function normalizeMonth(value) {
  return (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value))
    ? value
    : new Date().toISOString().slice(0, 7);
}

/**
 * Initialize Dashboard UI listeners and first render.
 */
export async function initDashboard() {
  const viewSelect = document.getElementById('viewSelect');
  if (viewSelect) {
    viewSelect.value = _selectedView;
    viewSelect.addEventListener('change', (e) => {
      _selectedView = e.target.value;
      renderDashboard();
    });
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

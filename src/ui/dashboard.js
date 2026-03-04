import { 
  getDashboardData, 
  getRollingFinancialData, 
  getCurrentBalance,
  debtRepository, 
  targetRepository, 
  netWorthRepository, 
  balanceSnapshotRepository,
  dailyBalanceRepository,
  expectedIncomeRepository
} from '../db/repository.js';
import { formatGBP, formatGBPShort } from '../utils/currency.js';
import { simulatePayoff, calcMinPayment, calculateBalanceChain } from '../utils/finance.js';
import { renderRollingOverviewChart } from './charts.js';
import { checkStoragePersistence } from './pwa-ux.js';
import { getEntitlementPeriod } from '../utils/childcare.js';

/**
 * Render the dashboard summary cards and the unified rolling chart.
 * @param {string} containerId - The ID of the container element.
 * @param {string} periodType - 'month', 'ytd', or 'all'.
 * @param {string} targetMonth - YYYY-MM string.
 */
export async function renderDashboard(containerId, periodType, targetMonth) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Map 'current' (from UI) to 'month' (from repository)
  const normalizedPeriod = periodType === 'current' ? 'month' : periodType;

  const [data, rollingData, isPersisted] = await Promise.all([
    getDashboardData(normalizedPeriod, targetMonth),
    getRollingFinancialData(targetMonth),
    checkStoragePersistence()
  ]);

  // 1. Render Unified Rolling Chart
  try {
    renderRollingOverviewChart('rollingOverviewChart', rollingData);
  } catch (err) {
    console.warn('Could not render rolling overview chart:', err);
  }

  // Calculate debt-free countdown
  const debts = await debtRepository.getAll();
  let debtFreeText = 'No debt';
  let debtFreeColor = 'var(--accent)';

  if (debts && debts.length > 0) {
    const savedStrategy = localStorage.getItem('budget_payoff_preference') || 'avalanche';
    const savedExtra = parseFloat(localStorage.getItem('payoffExtra')) || 0;
    const simulation = simulatePayoff(debts, savedStrategy, savedExtra * 100);

    if (simulation.monthsToClear >= 600) {
      debtFreeText = 'Never (at min)';
      debtFreeColor = 'var(--danger)';
    } else {
      const years = Math.floor(simulation.monthsToClear / 12);
      const months = simulation.monthsToClear % 12;
      debtFreeText = years > 0 ? `${years}y ${months}m` : `${months} months`;
      debtFreeColor = 'var(--warn)';
    }
  }

  // Childcare assets card (only if accounts exist)
  const childcareSummary = data.childcareSummary || [];
  const childcareTotalBalance = childcareSummary.reduce((s, c) => s + c.balance, 0);

  const todayBalance = await getCurrentBalance();

  const cards = [
    { label: 'Income', value: data.income, color: 'var(--accent)' },
    { label: 'Expenses', value: data.totalExpenses, color: 'var(--danger)' },
    { label: 'Net Position', value: data.netPosition, color: data.netPosition >= 0 ? 'var(--accent)' : 'var(--danger)' },
    { label: 'Total Debt', value: data.totalDebt, color: 'var(--danger)' },
    { label: 'Total Assets', value: data.totalAssets, color: 'var(--accent)' },
    ...(childcareSummary.length > 0 ? [{ label: 'Childcare Assets', value: childcareTotalBalance, color: 'var(--info)' }] : []),
    {
      label: 'Net Worth',
      badge: !isPersisted ? { text: 'Risk', title: 'Storage persistence not granted. Your data may be purged by the browser.' } : null,
      value: data.netWorth,
      color: data.netWorth >= 0 ? 'var(--accent)' : 'var(--danger)'
    },
    { label: 'Recurrent-to-Income', value: `${data.fixedToIncomeRatio}%`, color: data.fixedToIncomeRatio > 50 ? 'var(--warn)' : 'var(--text-soft)', isRaw: true },
    { label: 'Debt-Free In', value: debtFreeText, color: debtFreeColor, isRaw: true },
    { 
      label: 'Credit Card Payments', 
      value: data.ccPayments + data.extraPayment, 
      color: 'var(--danger)',
      percent: data.income > 0 ? Math.round(((data.ccPayments + data.extraPayment) / data.income) * 100) : 0
    },
    { 
      label: 'Loan & Mortgage Payments', 
      value: data.loanPayments, 
      color: 'var(--danger)',
      percent: data.income > 0 ? Math.round((data.loanPayments / data.income) * 100) : 0
    },
    { 
      label: 'Current Balance', 
      value: todayBalance, 
      color: todayBalance >= 0 ? 'var(--accent)' : 'var(--danger)' 
    }
  ];

  // Build cards using safe DOM methods
  container.textContent = '';
  for (const card of cards) {
    const item = document.createElement('div');
    item.className = 'sum-item';

    const labelEl = document.createElement('div');
    labelEl.className = 'sum-label';
    labelEl.textContent = card.label;

    if (card.badge) {
      const badge = document.createElement('span');
      badge.className = 'pill';
      badge.style.cssText = 'background:var(--danger);color:#fff;font-size:.65rem;vertical-align:middle';
      badge.title = card.badge.title;
      badge.textContent = card.badge.text;
      labelEl.append(' ', badge);
    }

    const valEl = document.createElement('div');
    valEl.className = 'sum-val';
    valEl.style.color = card.color;
    
    if (card.isRaw) {
      valEl.textContent = card.value;
    } else {
      adjustFontSize(valEl, card.value);
      if (card.percent !== undefined) {
        const p = document.createElement('div');
        p.style.cssText = 'font-size:0.75rem; color:var(--text-soft); font-weight:400; margin-top:2px;';
        p.textContent = `${card.percent}% of income`;
        valEl.appendChild(p);
      }
    }

    item.append(labelEl, valEl);
    container.append(item);
  }

  // 2. Render Next Negative Alert
  await renderNextNegativeAlert();

  // Also render progress bars, childcare funding card, and balance panel
  renderInlineProgressBars(data.bucketSpending);
  renderChildcareFunding(childcareSummary);
  renderDebtRepaymentPanel(debts, data.income);
  renderBalancePanel();
}

/**
 * Renders an alert if a future projected balance is negative within the next 90 days.
 */
async function renderNextNegativeAlert() {
  const snapshots = await dailyBalanceRepository.getAll();
  if (!snapshots || snapshots.length === 0) return;

  const today = new Date().toISOString().split('T')[0];
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 90);
  const horizonStr = horizon.toISOString().split('T')[0];

  const firstNeg = snapshots
    .filter(s => s.date >= today && s.date <= horizonStr && s.closingBalance < 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const existingAlert = document.getElementById('dashboardNextNegativeAlert');
  if (existingAlert) existingAlert.remove();

  if (firstNeg) {
    const container = document.getElementById('summaryGrid').parentNode;
    const alert = document.createElement('div');
    alert.id = 'dashboardNextNegativeAlert';
    alert.style.cssText = 'background:rgba(213, 94, 0, 0.1); border-left:4px solid var(--danger); padding:12px; margin-bottom:15px; border-radius:8px;';
    
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:700; color:var(--danger); margin-bottom:4px; font-size:0.9rem;';
    title.textContent = '⚠️ Future Deficit Alert';
    
    const body = document.createElement('div');
    body.style.fontSize = '0.85rem';
    body.innerHTML = `Projected balance: <strong style="color:var(--danger)">${formatGBP(firstNeg.closingBalance)}</strong> on <strong>${firstNeg.date}</strong>.`;
    
    alert.append(title, body);
    container.insertBefore(alert, document.getElementById('rollingOverviewChartContainer').nextSibling);
  }
}

/**
 * Renders minimal bucket budget progress bars inline with the summary grid.
 * @param {Object} bucketSpending - { recurrent: pence, 'one-off': pence }
 */
async function renderInlineProgressBars(bucketSpending) {
  let container = document.getElementById('dashboardInlineProgress');
  if (!container) {
    const sumGrid = document.getElementById('summaryGrid');
    if (sumGrid) {
      container = document.createElement('div');
      container.id = 'dashboardInlineProgress';
      container.style.cssText = 'grid-column: 1 / -1; margin-top: 10px; display: flex; gap: 20px; flex-wrap: wrap;';
      sumGrid.parentNode.insertBefore(container, sumGrid.nextSibling);
    }
  }
  if (!container) return;

  const targets = await targetRepository.getAll();
  const targetMap = new Map(targets.map(t => [t.bucket, t.amount]));

  const buckets = [
    { key: 'recurrent', label: 'Recurrent' },
    { key: 'one-off', label: 'One-off' }
  ];

  const bucketsWithTargets = buckets.filter(b => targetMap.has(b.key));

  if (bucketsWithTargets.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = bucketsWithTargets.map(b => {
    const actual = (bucketSpending && bucketSpending[b.key]) || 0;
    const target = targetMap.get(b.key);
    const percent = Math.min(Math.round((actual / target) * 100), 100);
    const isOver = actual > target;

    let barColor = 'var(--success)';
    if (percent >= 100) barColor = 'var(--danger)';
    else if (percent >= 80) barColor = 'var(--warn)';

    return `
      <div style="flex: 1; min-width: 200px;">
        <div style="display:flex; justify-content:space-between; font-size:.7rem; margin-bottom:2px">
          <span style="font-weight:600">${b.label} Target</span>
          <span style="font-weight:600; color:${isOver ? 'var(--danger)' : 'inherit'}">
            ${formatGBPShort(actual)} / ${formatGBPShort(target)} (${percent}%)
          </span>
        </div>
        <div style="height:6px; background:var(--bg-alt); border-radius:3px; overflow:hidden">
          <div style="height:100%; width:${percent}%; background:${barColor}; transition:width 0.3s"></div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renders a debt repayment impact panel on the dashboard.
 * Shows min payments + extra as % of income and alerts for expiring promos.
 * @param {Array} debts 
 * @param {number} totalIncomePence 
 */
function renderDebtRepaymentPanel(debts, totalIncomePence) {
  let section = document.getElementById('dashboardDebtRepaymentSection');
  if (!section) {
    const dashCard = document.querySelector('.card');
    if (dashCard) {
      section = document.createElement('div');
      section.id = 'dashboardDebtRepaymentSection';
      section.style.cssText = 'margin-top:20px; padding-top:20px; border-top:1px solid var(--border)';
      dashCard.appendChild(section);
    }
  }
  if (!section) return;

  if (!debts || debts.length === 0) {
    section.innerHTML = '';
    return;
  }

  const extraMonthlyPounds = parseFloat(localStorage.getItem('payoffExtra')) || 0;
  const extraMonthlyPence = extraMonthlyPounds * 100;
  
  const today = new Date();
  const totalMinPayments = debts.reduce((sum, d) => sum + calcMinPayment(d.currentBalance, d.apr, 0, today, d.promoEndDate), 0);
  const totalRepayment = totalMinPayments + extraMonthlyPence;
  const impactPercent = totalIncomePence > 0 ? Math.round((totalRepayment / totalIncomePence) * 100) : 0;

  // Check for promos expiring within 60 days
  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
  const expiringDebts = debts.filter(d => {
    if (!d.promoEndDate) return false;
    const promoEnd = new Date(d.promoEndDate);
    return promoEnd <= sixtyDaysFromNow && promoEnd >= new Date();
  });

  const alertsHTML = expiringDebts.map(d => `
    <div style="background:rgba(213, 94, 0, 0.1); border-left:4px solid var(--warn); padding:8px 12px; margin-bottom:8px; font-size:.85rem">
      ⚠️ <strong>Promo Expiring:</strong> ${d.name} ends on ${d.promoEndDate}. 
      APR will jump to ${d.postPromoApr}%.
    </div>
  `).join('');

  section.innerHTML = `
    <h3 style="font-size:.9rem;margin-bottom:12px;font-weight:600">Debt Repayment Impact</h3>
    
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px">
      <div>
        <div style="font-size:1.1rem; font-weight:700">${formatGBP(totalRepayment)} / month</div>
        <div class="hint" style="font-size:.75rem">
          ${formatGBP(totalMinPayments)} min + ${formatGBP(extraMonthlyPence)} extra
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:1.5rem; font-weight:800; color:${impactPercent > 30 ? 'var(--danger)' : impactPercent > 15 ? 'var(--warn)' : 'var(--success)'}">${impactPercent}%</div>
        <div class="hint" style="font-size:.75rem">of net income</div>
      </div>
    </div>

    ${alertsHTML}
  `;
}

/**
 * Renders the Childcare Funding section on the dashboard.
 * @param {Array} childcareSummary - Array of { account, balance, gap, suggestedDeposit }
 */
function renderChildcareFunding(childcareSummary) {
  let section = document.getElementById('dashboardChildcareSection');
  if (!section) {
    const dashCard = document.querySelector('.card');
    if (dashCard) {
      section = document.createElement('div');
      section.id = 'dashboardChildcareSection';
      section.style.cssText = 'margin-top:20px; padding-top:20px; border-top:1px solid var(--border)';
      dashCard.appendChild(section);
    }
  }
  if (!section) return;

  if (!childcareSummary || childcareSummary.length === 0) {
    section.innerHTML = '';
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  const accountRows = childcareSummary.map(({ account, balance, gap, suggestedDeposit }) => {
    // Check reconfirmation due
    let reconfirmHTML = '';
    if (account.entitlementStart) {
      try {
        const period = getEntitlementPeriod(account.entitlementStart, today);
        const msUntilEnd = period.end.getTime() - new Date(today).getTime();
        const daysUntilEnd = Math.ceil(msUntilEnd / (1000 * 60 * 60 * 24));
        if (daysUntilEnd >= 0 && daysUntilEnd <= 7) {
          reconfirmHTML = `<span class="pill" style="background:var(--warn);color:#000;font-size:.65rem;margin-left:6px" title="Log in to GOV.UK to reconfirm TFC eligibility">Reconfirm in ${daysUntilEnd}d</span>`;
        }
      } catch (e) {
        // Ignore
      }
    }

    const gapInfo = gap > 0
      ? `<span style="color:var(--warn);font-size:.8rem">Gap: ${formatGBP(gap)} — Deposit ${formatGBP(suggestedDeposit)} to cover</span>`
      : `<span style="color:var(--success);font-size:.8rem">Funded</span>`;

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-light)">
        <div>
          <span style="font-weight:600;font-size:.9rem">${account.childName}</span>
          ${reconfirmHTML}
          <div style="margin-top:2px">${gapInfo}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1rem;font-weight:700;color:var(--info)">${formatGBP(balance)}</div>
          <div class="hint" style="font-size:.7rem">of ${formatGBP(account.targetMonthlySpend || 0)} target</div>
        </div>
      </div>
    `;
  }).join('');

  section.innerHTML = `
    <h3 style="font-size:.9rem;margin-bottom:12px;font-weight:600">Childcare Funding</h3>
    ${accountRows}
  `;
}

/**
 * Renders the Balance Panel on the dashboard.
 */
async function renderBalancePanel() {
  let section = document.getElementById('dashboardBalanceSection');
  if (!section) {
    const dashCard = document.querySelector('.card');
    if (dashCard) {
      section = document.createElement('div');
      section.id = 'dashboardBalanceSection';
      section.style.cssText = 'margin-top:20px; padding-top:20px; border-top:1px solid var(--border)';
      dashCard.appendChild(section);
    }
  }
  if (!section) return;

  // Load all snapshots
  let snapshots = [];
  try {
    const { db } = await import('../db/schema.js');
    const raw = await db.balanceSnapshots.toArray();
    if (raw.length === 0) {
      const earliest = await db.income.orderBy('date').first();
      const startDate = earliest ? String(earliest.date).slice(0, 7) : new Date().toISOString().slice(0, 7);
      snapshots = await calculateBalanceChain(startDate, 3);
    } else {
      snapshots = raw.sort((a, b) => a.month.localeCompare(b.month));
    }
  } catch (err) {
    console.warn('[renderBalancePanel] Could not load balance data:', err);
    section.innerHTML = '<div class="hint">Balance data unavailable.</div>';
    return;
  }

  if (!snapshots || snapshots.length === 0) {
    section.innerHTML = '<div class="hint">No balance data yet. Add income records to see your running balance.</div>';
    return;
  }

  const actualSnaps = snapshots.filter(s => !s.isProjection);
  const currentSnap = actualSnaps.length > 0 ? actualSnaps[actualSnaps.length - 1] : snapshots[0];
  const projectionSnaps = snapshots.filter(s => s.isProjection);
  const nextMonthSnap = projectionSnaps[0] ?? null;
  const forecastSnap = projectionSnaps.length > 0 ? projectionSnaps[projectionSnaps.length - 1] : null;

  const hasNegativeProjection = snapshots.some(s => s.closingBalance < 0);

  section.textContent = '';
  const title = document.createElement('h3');
  title.style.cssText = 'font-size:.9rem;margin-bottom:12px;font-weight:600';
  title.textContent = 'Account Balance';
  section.append(title);

  const cardGrid = document.createElement('div');
  cardGrid.className = 'sum-grid';
  cardGrid.style.marginBottom = '20px';
  section.append(cardGrid);

  const cardData = [
    { label: `Running (${currentSnap.month})`, value: currentSnap.closingBalance },
    { label: nextMonthSnap ? `Next Month (${nextMonthSnap.month})` : null, value: nextMonthSnap?.closingBalance },
    { label: forecastSnap ? `3-Month Forecast (${forecastSnap.month})` : null, value: forecastSnap?.closingBalance }
  ].filter(c => c.label !== null);

  for (const card of cardData) {
    const el = document.createElement('div');
    el.className = 'balance-card';
    if (card.value < 0 || (card === cardData[0] && hasNegativeProjection)) {
      el.style.borderColor = 'var(--danger)';
      el.style.borderLeftColor = 'var(--danger)';
      el.style.background = 'rgba(220,38,38,0.05)';
    }

    const label = document.createElement('div');
    label.className = 'sum-label';
    label.textContent = card.label;

    const val = document.createElement('div');
    val.className = 'sum-val';
    val.style.color = card.value < 0 ? 'var(--danger)' : 'var(--accent)';
    adjustFontSize(val, card.value);

    el.append(label, val);
    cardGrid.append(el);
  }
}

/**
 * Adjusts the font size of an element based on the length of the currency string.
 */
function adjustFontSize(el, pence) {
  const amount = Math.abs(pence / 100);
  let fontSize = '1.35rem';
  let displayValue = formatGBP(pence);

  if (amount >= 100000) {
    displayValue = formatGBPShort(pence);
  } else if (amount >= 10000) {
    fontSize = '1.15rem';
  } else if (amount >= 1000) {
    fontSize = '1.25rem';
  }

  el.style.fontSize = fontSize;
  el.textContent = displayValue;
}

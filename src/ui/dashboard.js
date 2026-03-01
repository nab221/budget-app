import { getDashboardData, getSpendingTrends, debtRepository, targetRepository, netWorthRepository, balanceSnapshotRepository } from '../db/repository.js';
import { formatGBP } from '../utils/currency.js';
import { simulatePayoff, calcMinPayment, calculateBalanceChain } from '../utils/finance.js';
import { renderTrendsChart, renderBalanceChart } from './charts.js';
import { checkStoragePersistence } from './pwa-ux.js';
import { getEntitlementPeriod } from '../utils/childcare.js';

/**
 * Render the dashboard summary cards.
 * @param {string} containerId - The ID of the container element.
 * @param {string} periodType - 'month', 'ytd', or 'all'.
 * @param {string} targetMonth - YYYY-MM string.
 */
export async function renderDashboard(containerId, periodType, targetMonth) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Map 'current' (from UI) to 'month' (from repository)
  const normalizedPeriod = periodType === 'current' ? 'month' : periodType;

  const [data, isPersisted] = await Promise.all([
    getDashboardData(normalizedPeriod, targetMonth),
    checkStoragePersistence()
  ]);

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

  const cards = [
    { label: 'Income', value: data.income, color: 'var(--accent)' },
    { label: 'Recurrent Expenses', value: data.fixed, color: 'var(--danger)' },
    { label: 'One-off Expenses', value: data.variable, color: 'var(--danger)' },
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
    { label: 'Debt-Free In', value: debtFreeText, color: debtFreeColor, isRaw: true }
  ];

  // Build cards using safe DOM methods — no innerHTML for dynamic content (FOUND-04)
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
    valEl.textContent = card.isRaw ? card.value : formatGBP(card.value);

    item.append(labelEl, valEl);
    container.append(item);
  }

  // Render spending trends chart (12 months)
  try {
    const trendsData = await getSpendingTrends(targetMonth);
    renderTrendsChart('trendsChart', trendsData);
  } catch (err) {
    console.warn('Could not render trends chart:', err);
  }

  // Also render progress bars, snapshots, childcare funding card, and balance panel
  renderProgressBars(data.bucketSpending);
  renderSnapshots();
  renderChildcareFunding(childcareSummary);
  renderDebtRepaymentPanel(debts, data.income);
  renderBalancePanel();
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
    const dashCard = document.querySelector('.card section');
    const grid2 = document.querySelector('.card .grid2');
    if (grid2) {
      section = document.createElement('div');
      section.id = 'dashboardDebtRepaymentSection';
      section.style.cssText = 'margin-top:20px; padding-top:20px; border-top:1px solid var(--border)';
      grid2.parentNode.insertBefore(section, grid2);
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
 * Renders bucket budget progress bars on the dashboard.
 * Displays two bars: Recurrent and One-off, using bucket-based targets.
 * @param {Object} bucketSpending - { recurrent: pence, 'one-off': pence }
 */
async function renderProgressBars(bucketSpending) {
  const container = document.getElementById('dashboardProgress');
  if (!container) return;

  const targets = await targetRepository.getAll();
  const targetMap = new Map(targets.map(t => [t.bucket, t.amount]));

  const buckets = [
    { key: 'recurrent', label: 'Recurrent', hint: 'Standing commitments: rent, bills, loans' },
    { key: 'one-off', label: 'One-off', hint: 'Irregular spending: groceries, clothing, etc.' }
  ];

  const bucketsWithTargets = buckets.filter(b => targetMap.has(b.key));

  if (bucketsWithTargets.length === 0) {
    container.innerHTML = '<div class="hint">Set Recurrent and One-off targets in Settings to see progress.</div>';
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
      <div style="margin-bottom:12px">
        <div style="display:flex; justify-content:space-between; font-size:.8rem; margin-bottom:2px">
          <span style="font-weight:600" title="${b.hint}">${b.label}</span>
          <span style="font-weight:600; color:${isOver ? 'var(--danger)' : 'inherit'}">
            ${formatGBP(actual)} / ${formatGBP(target)}
          </span>
        </div>
        <div class="hint" style="font-size:.7rem;margin-bottom:4px">${b.hint}</div>
        <div style="height:8px; background:var(--bg-alt); border-radius:4px; overflow:hidden">
          <div style="height:100%; width:${percent}%; background:${barColor}; transition:width 0.3s"></div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renders the Childcare Funding section on the dashboard.
 * Shows per-account balances, funding gaps, top-up suggestions,
 * and reconfirmation alerts for accounts approaching period end.
 *
 * @param {Array} childcareSummary - Array of { account, balance, gap, suggestedDeposit }
 */
function renderChildcareFunding(childcareSummary) {
  // Find or create the childcare section container
  let section = document.getElementById('dashboardChildcareSection');
  if (!section) {
    // Insert before the grid2 section (Budget Progress / Net Worth History)
    const dashCard = document.querySelector('.card section');
    const grid2 = document.querySelector('.card .grid2');
    if (grid2) {
      section = document.createElement('div');
      section.id = 'dashboardChildcareSection';
      section.style.cssText = 'margin-top:20px; padding-top:20px; border-top:1px solid var(--border)';
      grid2.parentNode.insertBefore(section, grid2);
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
 * Shows the running balance (today's closing balance) and a 3-month forward forecast.
 * Turns the card background red if any projected snapshot in the next 3 months is < 0.
 * Also renders the 90-day balance trend chart.
 */
async function renderBalancePanel() {
  let section = document.getElementById('dashboardBalanceSection');
  if (!section) {
    // Insert before the grid2 section (Budget Progress / Net Worth History)
    const grid2 = document.querySelector('.card .grid2');
    if (grid2) {
      section = document.createElement('div');
      section.id = 'dashboardBalanceSection';
      section.style.cssText = 'margin-top:20px; padding-top:20px; border-top:1px solid var(--border)';
      grid2.parentNode.insertBefore(section, grid2);
    }
  }
  if (!section) return;

  // Load all snapshots
  let snapshots = [];
  try {
    // Fetch all stored balance snapshots
    const allSnaps = await balanceSnapshotRepository.getLatestSnapshot();
    // If no snapshots exist yet, trigger recalculation
    if (!allSnaps) {
      const earliest = await (async () => {
        try {
          const { db } = await import('../db/schema.js');
          return db.income.orderBy('date').first();
        } catch (e) {
          return null;
        }
      })();
      const startDate = earliest ? String(earliest.date).slice(0, 7) : new Date().toISOString().slice(0, 7);
      snapshots = await calculateBalanceChain(startDate, 3);
    } else {
      // Read all snapshots from DB (sorted by month)
      const { db } = await import('../db/schema.js');
      const raw = await db.balanceSnapshots.toArray();
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

  // Determine today's balance (last non-projection snapshot, or first if all projections)
  const today = new Date().toISOString().slice(0, 7);
  const actualSnaps = snapshots.filter(s => !s.isProjection);
  const currentSnap = actualSnaps.length > 0
    ? actualSnaps[actualSnaps.length - 1]
    : snapshots[0];

  // Check if any projection in the next 3 months is negative
  const projectionSnaps = snapshots.filter(s => s.isProjection);
  const hasNegativeProjection = projectionSnaps.some(s => s.closingBalance < 0);
  const currentBalanceNegative = currentSnap.closingBalance < 0;
  const isAlertState = hasNegativeProjection || currentBalanceNegative;

  // Get forecast — the last projection snapshot
  const forecastSnap = projectionSnaps.length > 0
    ? projectionSnaps[projectionSnaps.length - 1]
    : currentSnap;

  // Build the balance card HTML
  const cardBg = isAlertState
    ? 'background:rgba(220,38,38,0.08); border:1px solid var(--danger);'
    : 'background:var(--bg-alt); border:1px solid var(--border);';
  const balanceColor = currentBalanceNegative ? 'var(--danger)' : 'var(--success)';
  const forecastColor = forecastSnap.closingBalance < 0 ? 'var(--danger)' : 'var(--success)';

  section.innerHTML = `
    <h3 style="font-size:.9rem;margin-bottom:12px;font-weight:600">Account Balance</h3>
    <div id="balanceCard" style="display:flex;justify-content:space-between;align-items:stretch;gap:16px;padding:16px;border-radius:8px;${cardBg}">
      <div style="flex:1">
        <div class="hint" style="font-size:.75rem;margin-bottom:4px">Running Balance (${currentSnap.month})</div>
        <div style="font-size:1.6rem;font-weight:800;color:${balanceColor}">${formatGBP(currentSnap.closingBalance)}</div>
        ${isAlertState ? '<div style="font-size:.75rem;color:var(--danger);margin-top:4px;font-weight:600">Projected negative balance ahead</div>' : ''}
      </div>
      <div style="flex:1;border-left:1px solid var(--border);padding-left:16px">
        <div class="hint" style="font-size:.75rem;margin-bottom:4px">3-Month Forecast (${forecastSnap.month})</div>
        <div style="font-size:1.6rem;font-weight:800;color:${forecastColor}">${formatGBP(forecastSnap.closingBalance)}</div>
        <div class="hint" style="font-size:.7rem;margin-top:4px">Based on known income &amp; expenses</div>
      </div>
    </div>
    <div class="chart-container" style="margin-top:16px">
      <canvas id="balanceChart"></canvas>
    </div>
  `;

  // Render the 90-day trend chart
  renderBalanceChart('balanceChart', snapshots);
}

/**
 * Renders historical net worth snapshots on the dashboard.
 */
async function renderSnapshots() {
  const container = document.getElementById('dashboardSnapshots');
  if (!container) return;

  const snapshots = await netWorthRepository.getAll();
  // Sort by month descending
  snapshots.sort((a, b) => b.month.localeCompare(a.month));

  if (snapshots.length === 0) {
    container.innerHTML = '<div class="hint">Waiting for first monthly snapshot...</div>';
    return;
  }

  container.innerHTML = `
    <table class="tbl" style="font-size:.8rem">
      <thead>
        <tr>
          <th>Month</th>
          <th class="r">Assets</th>
          <th class="r">Debt</th>
          <th class="r">Net Worth</th>
        </tr>
      </thead>
      <tbody>
        ${snapshots.slice(0, 6).map(s => `
          <tr>
            <td>${s.month}</td>
            <td class="r">${formatGBP(s.totalAssets)}</td>
            <td class="r" style="color:var(--danger)">${formatGBP(s.totalDebt)}</td>
            <td class="r" style="font-weight:600; color:${s.netWorth >= 0 ? 'var(--success)' : 'var(--danger)'}">
              ${formatGBP(s.netWorth)}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

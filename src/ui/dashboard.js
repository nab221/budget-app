import { getDashboardData, getSpendingTrends, debtRepository, targetRepository, netWorthRepository } from '../db/repository.js';
import { formatGBP } from '../utils/currency.js';
import { simulatePayoff } from '../utils/finance.js';
import { renderTrendsChart } from './charts.js';
import { checkStoragePersistence } from './pwa-ux.js';

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
    // We use Avalanche as the baseline for the dashboard countdown
    const simulation = simulatePayoff(debts, 'avalanche', 0);
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

  const cards = [
    { label: 'Income', value: data.income, color: 'var(--accent)' },
    { label: 'Recurrent Expenses', value: data.fixed, color: 'var(--danger)' },
    { label: 'One-off Expenses', value: data.variable, color: 'var(--danger)' },
    { label: 'Net Position', value: data.netPosition, color: data.netPosition >= 0 ? 'var(--accent)' : 'var(--danger)' },
    { label: 'Total Debt', value: data.totalDebt, color: 'var(--danger)' },
    { label: 'Total Assets', value: data.totalAssets, color: 'var(--accent)' },
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

  // Also render progress bars and snapshots
  renderProgressBars(data.bucketSpending);
  renderSnapshots();
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

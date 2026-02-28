import { getDashboardData, debtRepository } from '../db/repository.js';
import { formatGBP } from '../utils/currency.js';
import { simulatePayoff } from '../utils/finance.js';

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

  const data = await getDashboardData(normalizedPeriod, targetMonth);
  
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
    { label: 'Fixed Expenses', value: data.fixed, color: 'var(--danger)' },
    { label: 'Variable Expenses', value: data.variable, color: 'var(--danger)' },
    { label: 'Net Position', value: data.netPosition, color: data.netPosition >= 0 ? 'var(--accent)' : 'var(--danger)' },
    { label: 'Subscriptions', value: data.totalSubscriptions, color: 'var(--text-soft)' },
    { label: 'Total Debt', value: data.totalDebt, color: 'var(--danger)' },
    { label: 'Total Assets', value: data.totalAssets, color: 'var(--accent)' },
    { label: 'Net Worth', value: data.netWorth, color: data.netWorth >= 0 ? 'var(--accent)' : 'var(--danger)' },
    { label: 'Fixed-to-Income', value: `${data.fixedToIncomeRatio}%`, color: data.fixedToIncomeRatio > 50 ? 'var(--warn)' : 'var(--text-soft)', isRaw: true },
    { label: 'Debt-Free In', value: debtFreeText, color: debtFreeColor, isRaw: true }
  ];

  container.innerHTML = cards.map(card => `
    <div class="sum-item">
      <div class="sum-label">${card.label}</div>
      <div class="sum-val" style="color: ${card.color}">
        ${card.isRaw ? card.value : formatGBP(card.value)}
      </div>
    </div>
  `).join('');
}

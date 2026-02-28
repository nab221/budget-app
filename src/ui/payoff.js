import { debtRepository } from '../db/repository.js';
import { simulatePayoff } from '../utils/finance.js';
import { formatGBP, toPence } from '../utils/currency.js';

/**
 * Renders the Debt Payoff Planner view.
 */
export async function renderPayoffPlanner() {
  const debts = await debtRepository.getAll();
  const extraPaymentInput = document.getElementById('payoffExtra');
  const comparisonContainer = document.getElementById('payoffComparison');
  const tableContainer = document.getElementById('payoffTableContainer');

  if (!debts || debts.length === 0) {
    comparisonContainer.innerHTML = '<div class="hint">Add some debts in the "Debts" tab to see payoff simulations.</div>';
    tableContainer.innerHTML = '';
    return;
  }

  // Handle extra payment change
  const updateSimulations = () => {
    const extraPounds = parseFloat(extraPaymentInput.value) || 0;
    const extraPence = toPence(extraPounds);

    const strategies = [
      { id: 'avalanche', name: 'Debt Avalanche', description: 'Highest interest first' },
      { id: 'snowball', name: 'Debt Snowball', description: 'Smallest balance first' },
      { id: 'min', name: 'Minimum Only', description: 'Paying minimums only' }
    ];

    const results = strategies.map(strategy => {
      const simulation = simulatePayoff(debts, strategy.id, extraPence);
      return {
        ...strategy,
        ...simulation
      };
    });

    // Find the fastest and cheapest
    const minMonths = Math.min(...results.filter(r => r.monthsToClear < 600).map(r => r.monthsToClear));
    const minInterest = Math.min(...results.map(r => r.totalInterest));

    // Render comparison cards
    comparisonContainer.innerHTML = results.map(res => `
      <div class="card ${res.monthsToClear === minMonths && res.id !== 'min' ? 'border-primary' : ''}" style="padding:15px; flex:1">
        <h3 style="font-size:.9rem; margin-bottom:4px">${res.name}</h3>
        <div class="hint" style="margin-bottom:12px">${res.description}</div>
        
        <div style="margin-bottom:8px">
          <span style="font-size:1.4rem; font-weight:700">${res.monthsToClear >= 600 ? 'Never' : res.monthsToClear + ' months'}</span>
          <div class="hint">Time to clear</div>
        </div>

        <div>
          <span style="font-weight:600; color:${res.totalInterest === minInterest ? 'var(--success)' : 'inherit'}">
            ${formatGBP(res.totalInterest)}
          </span>
          <div class="hint">Total interest paid</div>
        </div>

        ${res.id !== 'min' && res.monthsToClear === minMonths ? 
          '<div class="pill" style="margin-top:10px; background:var(--bg-alt); color:var(--primary); font-size:.7rem; text-align:center">FASTEST</div>' : ''}
      </div>
    `).join('');

    // Render detailed table for the selected/fastest strategy (Avalanche)
    const activeStrategy = results.find(r => r.id === 'avalanche');
    tableContainer.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Debt Name</th>
            <th class="r">Interest Paid</th>
            <th class="r">Months to Clear</th>
          </tr>
        </thead>
        <tbody>
          ${activeStrategy.resultsByDebt.map(d => `
            <tr>
              <td>${d.name}</td>
              <td class="r">${formatGBP(d.totalInterest)}</td>
              <td class="r">${d.monthsToClear === Infinity ? 'Never' : d.monthsToClear + ' mo'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  // Initial render
  updateSimulations();

  // Attach listener (ensure only one listener exists if render is called multiple times)
  extraPaymentInput.oninput = updateSimulations;
}

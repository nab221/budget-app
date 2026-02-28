import { debtRepository } from '../db/repository.js';
import { simulatePayoff, modelBalanceTransfer } from '../utils/finance.js';
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
    document.getElementById('btModelerContainer').innerHTML = '';
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
  renderBTModeler(debts);

  // Attach listener (ensure only one listener exists if render is called multiple times)
  extraPaymentInput.oninput = updateSimulations;
}

/**
 * Renders the Balance Transfer Modeler component.
 * @param {Array} debts - All user debts.
 */
export function renderBTModeler(debts) {
  const container = document.getElementById('btModelerContainer');
  if (!container) return;

  const cardDebts = debts.filter(d => d.type === 'credit_card' || d.type === 'overdraft' || d.type === 'other');
  
  if (cardDebts.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="card" style="padding:20px; border:1px dashed var(--primary); background:var(--bg-alt)">
      <h3 style="margin-bottom:15px">Balance Transfer Modeler</h3>
      <div class="hint" style="margin-bottom:20px">Thinking of moving a balance? See if the transfer fee is worth the interest savings.</div>

      <div class="form-row" style="margin-bottom:20px">
        <div style="flex:2">
          <label>Source Debt</label>
          <select id="btSourceDebt">
            ${cardDebts.map(d => `<option value="${d.id}">${d.name} (${formatGBP(d.currentBalance)} @ ${d.apr}%)</option>`).join('')}
          </select>
        </div>
        <div style="flex:1">
          <label>Promo (Months)</label>
          <input id="btPromoMonths" type="number" value="12" min="1" step="1"/>
        </div>
        <div style="flex:1">
          <label>Fee (%)</label>
          <input id="btFeePercent" type="number" value="3.0" min="0" step="0.1"/>
        </div>
      </div>

      <div id="btResults" style="padding:15px; border-radius:8px; background:var(--bg)">
        <!-- BT calculation results injected here -->
      </div>
    </div>
  `;

  const btSourceSelect = document.getElementById('btSourceDebt');
  const btPromoInput = document.getElementById('btPromoMonths');
  const btFeeInput = document.getElementById('btFeePercent');
  const btResults = document.getElementById('btResults');

  const updateBTModel = () => {
    const debtId = btSourceSelect.value;
    const promoMonths = parseInt(btPromoInput.value) || 0;
    const feePercent = parseFloat(btFeeInput.value) || 0;

    const debt = debts.find(d => d.id === debtId);
    if (!debt || promoMonths <= 0) return;

    const result = modelBalanceTransfer(debt, promoMonths, feePercent);
    const savings = result.totalCostCurrent - result.totalCostBT;

    btResults.innerHTML = `
      <div class="grid2" style="gap:20px">
        <div>
          <div style="font-size:.8rem; color:var(--text-soft)">Upfront Transfer Fee</div>
          <div style="font-size:1.2rem; font-weight:600">${formatGBP(result.transferFeePence)}</div>
        </div>
        <div>
          <div style="font-size:.8rem; color:var(--text-soft)">Potential Savings</div>
          <div style="font-size:1.2rem; font-weight:600; color:${savings > 0 ? 'var(--success)' : 'var(--danger)'}">
            ${savings > 0 ? 'Save ' : 'Costs '}${formatGBP(Math.abs(savings))}
          </div>
        </div>
      </div>

      <div style="margin-top:20px; padding-top:15px; border-top:1px solid var(--border)">
        <div style="font-weight:600; margin-bottom:4px">Target Monthly Payment</div>
        <div style="font-size:1.4rem; color:var(--primary); font-weight:700">${formatGBP(result.recommendedMonthlyPayment)}</div>
        <div class="hint">Pay this amount monthly to clear the transferred balance before the 0% period ends.</div>
      </div>

      ${savings > 0 ? `
        <div style="margin-top:15px; color:var(--success); font-weight:600; display:flex; align-items:center; gap:8px">
          <span>✅ Recommended: This transfer saves you ${formatGBP(savings)} compared to minimum payments.</span>
        </div>
      ` : `
        <div style="margin-top:15px; color:var(--danger); font-weight:600; display:flex; align-items:center; gap:8px">
          <span>⚠️ Not Recommended: The transfer fee is higher than the expected interest cost.</span>
        </div>
      `}
    `;
  };

  // Listeners
  btSourceSelect.onchange = updateBTModel;
  btPromoInput.oninput = updateBTModel;
  btFeeInput.oninput = updateBTModel;

  // Initial update
  updateBTModel();
}


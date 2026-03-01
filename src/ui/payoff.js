import { debtRepository } from '../db/repository.js';
import { simulatePayoff, modelBalanceTransfer, calcMinPayment } from '../utils/finance.js';
import { formatGBP, toPence } from '../utils/currency.js';
import { renderDebtPayoffChart } from './charts.js';

/**
 * Renders the Debt Payoff Planner view.
 */
export async function renderPayoffPlanner() {
  const debts = await debtRepository.getAll();
  const extraPaymentInput = document.getElementById('payoffExtra');
  const strategyInput = document.getElementById('payoffStrategy');
  const comparisonContainer = document.getElementById('payoffComparison');
  const tableContainer = document.getElementById('payoffTableContainer');
  const chartTitle = document.getElementById('payoffChartTitle');

  if (!debts || debts.length === 0) {
    comparisonContainer.innerHTML = '<div class="hint">Add some debts in the "Debts" tab to see payoff simulations.</div>';
    tableContainer.innerHTML = '';
    document.getElementById('btModelerContainer').innerHTML = '';
    return;
  }

  // Load persistence
  const savedExtra = localStorage.getItem('payoffExtra');
  if (savedExtra !== null) extraPaymentInput.value = savedExtra;

  const savedStrategy = localStorage.getItem('budget_payoff_preference');
  if (savedStrategy !== null) strategyInput.value = savedStrategy;

  /**
   * Transforms simulation history into the series format expected by charts.js
   */
  const getChartDataFromHistory = (history, debtsArr) => {
    const CHART_MONTHS = 120;
    const limitedHistory = history.slice(0, CHART_MONTHS);
    
    // Initialize series with starting balances (Month 0)
    const series = debtsArr.map(d => ({
      name: d.name,
      balances: [d.currentBalance]
    }));

    // Fill in monthly balances
    limitedHistory.forEach(snapshot => {
      series.forEach(s => {
        const debtPayment = snapshot.payments.find(p => p.debtName === s.name);
        s.balances.push(debtPayment ? debtPayment.remainingBalance : 0);
      });
    });

    return series;
  };

  // Handle changes
  const updateSimulations = () => {
    const extraPounds = parseFloat(extraPaymentInput.value) || 0;
    const extraPence = toPence(extraPounds);
    const selectedStrategyId = strategyInput.value;

    // Persist
    localStorage.setItem('payoffExtra', extraPounds);
    localStorage.setItem('budget_payoff_preference', selectedStrategyId);

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
      <div class="card ${res.id === selectedStrategyId ? 'border-primary' : ''}" 
           style="padding:15px; flex:1; cursor:pointer; position:relative"
           onclick="document.getElementById('payoffStrategy').value='${res.id}'; document.getElementById('payoffStrategy').dispatchEvent(new Event('change'))">
        ${res.id === selectedStrategyId ? '<div style="position:absolute; top:8px; right:8px; color:var(--primary); font-size:1.2rem">✓</div>' : ''}
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

    // Detailed 12-Month Breakdown Table
    const activeResult = results.find(r => r.id === selectedStrategyId);
    const snapshot12 = activeResult.history.slice(0, 12);
    
    // Sort debts by name for consistent column ordering
    const sortedDebts = [...debts].sort((a, b) => a.name.localeCompare(b.name));

    tableContainer.innerHTML = `
      <div style="overflow-x:auto">
        <table class="tbl" style="font-size:0.85rem; min-width:600px">
          <thead>
            <tr>
              <th>Month</th>
              <th class="r">Total Paid</th>
              ${sortedDebts.map(d => `<th class="r" style="border-left:1px solid var(--border-light)">${d.name}<br/><span style="font-size:0.7rem;font-weight:400">P | I</span></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${snapshot12.map(s => {
              const hasRateJump = s.payments.some(p => p.isRateJump);
              const totalPaid = s.payments.reduce((sum, p) => sum + p.amount, 0);
              return `
                <tr ${hasRateJump ? 'style="background:rgba(213, 94, 0, 0.05)" title="Interest rate jump occurred this month"' : ''}>
                  <td>${s.date}${hasRateJump ? ' ⚡' : ''}</td>
                  <td class="r" style="font-weight:600">${formatGBP(totalPaid)}</td>
                  ${sortedDebts.map(d => {
                    const p = s.payments.find(pay => pay.debtId === d.id) || { principalPaid: 0, interestCharged: 0 };
                    return `
                      <td class="r" style="border-left:1px solid var(--border-light); white-space:nowrap">
                        <span style="color:var(--text)">${formatGBP(p.principalPaid)}</span> | 
                        <span style="color:var(--danger); font-size:0.75rem">${formatGBP(p.interestCharged)}</span>
                      </td>
                    `;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="hint" style="margin-top:10px">P | I = Principal Paid | Interest Charged. Highlighted rows ⚡ indicate a promo interest rate expired.</div>
    `;

    // Update chart
    if (chartTitle) chartTitle.textContent = `Debt Payoff Timeline (${activeResult.name})`;
    const projectionData = getChartDataFromHistory(activeResult.history, debts);
    renderDebtPayoffChart('payoffChart', projectionData);
  };

  // Initial render
  updateSimulations();
  renderBTModeler(debts);

  // Attach listeners
  extraPaymentInput.oninput = updateSimulations;
  strategyInput.onchange = updateSimulations;
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


import { debtRepository } from '../db/repository.js';
import { simulatePayoff, simulateLoanPayoff, modelBalanceTransfer } from '../utils/finance.js';
import { formatGBP, toPence } from '../utils/currency.js';
import { renderDebtPayoffChart } from './charts.js';

/**
 * Renders the dual-section Debt Payoff Planner view.
 */
export async function renderPayoffPlanner() {
  const allDebts = await debtRepository.getAll();
  const extraPaymentInput = document.getElementById('payoffExtra');
  
  if (!extraPaymentInput) return;

  // Load persistent extra payment
  const savedExtra = localStorage.getItem('payoffExtra');
  if (savedExtra !== null) extraPaymentInput.value = savedExtra;

  if (!allDebts || allDebts.length === 0) {
    document.getElementById('ccPayoffSection').innerHTML = '<div class="hint" style="padding:20px; text-align:center">Add some debts in the "Debts" tab to see payoff simulations.</div>';
    document.getElementById('loanPayoffSection').classList.add('hidden');
    document.getElementById('payoffScheduleBody').innerHTML = '<tr><td colspan="6" class="hint" style="text-align:center">No debts to display.</td></tr>';
    return;
  }

  const ccDebts = allDebts.filter(d => (d.debtType || 'credit-card') === 'credit-card');
  const loanDebts = allDebts.filter(d => d.debtType === 'loan' || d.debtType === 'mortgage');

  const updateAll = () => {
    const totalExtraPence = toPence(parseFloat(extraPaymentInput.value) || 0);
    localStorage.setItem('payoffExtra', extraPaymentInput.value);

    // 1. Credit Card Payoff
    let ccResult = null;
    if (ccDebts.length > 0) {
      ccResult = renderCreditCardPayoff(ccDebts, totalExtraPence);
    } else {
      document.getElementById('ccPayoffSection').classList.add('hidden');
    }

    // 2. Loan Payoff
    let loanResult = null;
    if (loanDebts.length > 0) {
      document.getElementById('loanPayoffSection').classList.remove('hidden');
      loanResult = renderLoanPayoff(loanDebts, totalExtraPence);
    } else {
      document.getElementById('loanPayoffSection').classList.add('hidden');
    }

    // 3. Consolidated Schedule
    renderConsolidatedSchedule(ccResult, loanResult);
    
    // 4. BT Modeler (only if CCs exist)
    renderBTModeler(allDebts);
  };

  extraPaymentInput.oninput = updateAll;
  updateAll();
}

/**
 * Renders the Credit Card specific payoff section.
 */
function renderCreditCardPayoff(debts, extraPence) {
  const strategyInput = document.getElementById('payoffStrategy');
  const comparisonContainer = document.getElementById('ccPayoffComparison');
  const selectedStrategyId = strategyInput.value || 'avalanche';

  localStorage.setItem('budget_payoff_preference', selectedStrategyId);

  const strategies = [
    { id: 'avalanche', name: 'Avalanche', description: 'Highest interest first' },
    { id: 'snowball', name: 'Snowball', description: 'Smallest balance first' },
    { id: 'min', name: 'Min Only', description: 'Paying minimums only' }
  ];

  const results = strategies.map(s => ({
    ...s,
    ...simulatePayoff(debts, s.id, extraPence)
  }));

  const minInterest = Math.min(...results.map(r => r.totalInterest));
  const activeResult = results.find(r => r.id === selectedStrategyId);

  comparisonContainer.innerHTML = results.map(res => `
    <div class="card ${res.id === selectedStrategyId ? 'border-primary' : ''}" 
         style="padding:12px; flex:1; cursor:pointer; position:relative; border:1px solid ${res.id === selectedStrategyId ? 'var(--accent)' : 'var(--border-light)'}"
         onclick="document.getElementById('payoffStrategy').value='${res.id}'; document.getElementById('payoffStrategy').dispatchEvent(new Event('change'))">
      <h3 style="font-size:.8rem; margin-bottom:4px">${res.name}</h3>
      <div style="font-size:1.1rem; font-weight:700">${res.monthsToClear >= 600 ? 'Never' : res.monthsToClear + 'm'}</div>
      <div style="font-size:.8rem; color:${res.totalInterest === minInterest ? 'var(--success)' : 'inherit'}"><span class="privacy-blur">${formatGBP(res.totalInterest)}</span> int.</div>
    </div>
  `).join('');

  strategyInput.onchange = () => renderPayoffPlanner();

  const projectionData = getChartDataFromHistory(activeResult.history, debts);
  renderDebtPayoffChart('ccPayoffChart', projectionData);

  return activeResult;
}

/**
 * Renders the Loan & Mortgage specific payoff section.
 */
function renderLoanPayoff(debts, extraPence) {
  const strategyInput = document.getElementById('loanPayoffStrategy');
  const comparisonContainer = document.getElementById('loanPayoffComparison');
  const selectedStrategyId = strategyInput.value || 'term-reduction';

  const strategies = [
    { id: 'term-reduction', name: 'Term Reduction', description: 'Payment same, term shortens' },
    { id: 'payment-reduction', name: 'Payment Reduction', description: 'Term same, payment drops' }
  ];

  const results = strategies.map(s => ({
    ...s,
    ...simulateLoanPayoff(debts, s.id, extraPence)
  }));

  const minInterest = Math.min(...results.map(r => r.totalInterest));
  const activeResult = results.find(r => r.id === selectedStrategyId);

  const hasInterestOnly = debts.some(d => d.isInterestOnly);
  const interestOnlyHint = hasInterestOnly 
    ? '<div class="hint" style="margin-top:10px; color:var(--warn); grid-column: 1 / -1">⚠️ Some loans are configured as Interest-Only. Their principal balance will not decrease unless you provide an "Extra Monthly Payment" above.</div>' 
    : '';

  comparisonContainer.innerHTML = results.map(res => `
    <div class="card ${res.id === selectedStrategyId ? 'border-primary' : ''}" 
         style="padding:12px; flex:1; cursor:pointer; position:relative; border:1px solid ${res.id === selectedStrategyId ? 'var(--accent)' : 'var(--border-light)'}"
         onclick="document.getElementById('loanPayoffStrategy').value='${res.id}'; document.getElementById('loanPayoffStrategy').dispatchEvent(new Event('change'))">
      <h3 style="font-size:.8rem; margin-bottom:4px">${res.name}</h3>
      <div style="font-size:1.1rem; font-weight:700">${res.monthsToClear >= 600 ? '50+ years' : res.monthsToClear + ' months'}</div>
      <div style="font-size:.8rem; color:${res.totalInterest === minInterest ? 'var(--success)' : 'inherit'}">
        <span class="privacy-blur">${formatGBP(res.totalInterest)}</span> int. ${res.totalFees > 0 ? `(+ <span class="privacy-blur">${formatGBP(res.totalFees)}</span> fees)` : ''}
      </div>
    </div>
  `).join('') + interestOnlyHint;

  strategyInput.onchange = () => renderPayoffPlanner();

  const projectionData = getChartDataFromHistory(activeResult.history, debts);
  renderDebtPayoffChart('loanPayoffChart', projectionData);

  return activeResult;
}

/**
 * Helper to transform history into chart series.
 */
function getChartDataFromHistory(history, debtsArr) {
  const CHART_MONTHS = 24; // Focus on next 2 years
  const limitedHistory = history.slice(0, CHART_MONTHS);
  
  const series = debtsArr.map(d => ({
    name: d.name,
    balances: [d.currentBalance]
  }));

  limitedHistory.forEach(snapshot => {
    series.forEach(s => {
      const debtPayment = snapshot.payments.find(p => p.debtName === s.name);
      s.balances.push(debtPayment ? debtPayment.remainingBalance : (s.balances[s.balances.length-1] || 0));
    });
  });

  return series;
}

/**
 * Renders a combined schedule from both CC and Loan results.
 */
function renderConsolidatedSchedule(ccResult, loanResult) {
  const body = document.getElementById('payoffScheduleBody');
  if (!body) return;

  const ccHistory = ccResult?.history || [];
  const loanHistory = loanResult?.history || [];
  const maxMonths = Math.max(ccHistory.length, loanHistory.length);
  const limitedMonths = Math.min(maxMonths, 24); // Show 2 years max for the detailed breakdown

  // Collect all unique debts from both results to build columns
  const allDebts = [];
  if (ccResult) {
    const firstSnap = ccResult.history[0];
    if (firstSnap) firstSnap.payments.forEach(p => allDebts.push({ id: p.debtId, name: p.debtName, type: 'cc' }));
  }
  if (loanResult) {
    const firstSnap = loanResult.history[0];
    if (firstSnap) firstSnap.payments.forEach(p => allDebts.push({ id: p.debtId, name: p.debtName, type: 'loan' }));
  }

  // Update Table Header
  const table = body.closest('table');
  if (table) {
    table.innerHTML = `
      <thead>
        <tr>
          <th>Month</th>
          <th class="r">Total Paid</th>
          ${allDebts.map(d => `<th class="r" style="border-left:1px solid var(--border-light)">${d.name}<br/><span style="font-size:0.65rem; font-weight:400">Payment</span></th>`).join('')}
          <th class="r" style="border-left:2px solid var(--border-light)">Balance</th>
        </tr>
      </thead>
      <tbody id="payoffScheduleBody"></tbody>
    `;
  }

  const newBody = document.getElementById('payoffScheduleBody');
  let html = '';

  for (let i = 0; i < limitedMonths; i++) {
    const ccSnap = ccHistory[i];
    const loanSnap = loanHistory[i];
    
    const date = ccSnap?.date || loanSnap?.date || `Month ${i+1}`;
    const totalPaid = (ccSnap?.totalPrincipalPaid || 0) + (ccSnap?.totalInterestCharged || 0) + 
                      (loanSnap?.totalPrincipalPaid || 0) + (loanSnap?.totalInterestCharged || 0);
    const balance = (ccSnap?.totalRemainingBalance || 0) + (loanSnap?.totalRemainingBalance || 0);

    html += `
      <tr>
        <td class="nw">${date}</td>
        <td class="r" style="font-weight:600"><span class="privacy-blur">${formatGBP(totalPaid)}</span></td>
        ${allDebts.map(d => {
          const snap = d.type === 'cc' ? ccSnap : loanSnap;
          const p = snap?.payments.find(pay => pay.debtId === d.id) || { amount: 0, principalPaid: 0, interestCharged: 0 };
          const interest = p.interestCharged || p.feeCharged || 0;
          return `
            <td class="r nw" style="border-left:1px solid var(--border-light)">
              <div style="font-weight:600"><span class="privacy-blur">${formatGBP(p.amount)}</span></div>
              <div class="hint" style="font-size:0.65rem">
                <span class="privacy-blur">${formatGBP(p.principalPaid)}</span> P | <span class="privacy-blur">${formatGBP(interest)}</span> I
              </div>
            </td>
          `;
        }).join('')}
        <td class="r nw" style="font-weight:600; border-left:2px solid var(--border-light)"><span class="privacy-blur">${formatGBP(balance)}</span></td>
      </tr>
    `;
  }

  newBody.innerHTML = html || '<tr><td colspan="6" class="hint" style="text-align:center">No data.</td></tr>';
}

/**
 * Renders the Balance Transfer Modeler component.
 */
export function renderBTModeler(debts) {
  const container = document.getElementById('btModelerContainer');
  if (!container) return;

  const cardDebts = debts.filter(d => (d.debtType || 'credit-card') === 'credit-card');
  
  if (cardDebts.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="card" style="padding:20px; border:1px dashed var(--accent); background:var(--bg-alt)">
      <h3 style="margin-bottom:15px">Balance Transfer Modeler</h3>
      <div class="hint" style="margin-bottom:20px">Moving a balance to 0%? See if the transfer fee is worth the interest savings.</div>

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
    const debtId = parseInt(btSourceSelect.value);
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
          <div style="font-size:1.2rem; font-weight:600"><span class="privacy-blur">${formatGBP(result.transferFeePence)}</span></div>
        </div>
        <div>
          <div style="font-size:.8rem; color:var(--text-soft)">Potential Savings</div>
          <div style="font-size:1.2rem; font-weight:600; color:${savings > 0 ? 'var(--success)' : 'var(--danger)'}">
            ${savings > 0 ? 'Save ' : 'Costs '}<span class="privacy-blur">${formatGBP(Math.abs(savings))}</span>
          </div>
        </div>
      </div>

      <div style="margin-top:20px; padding-top:15px; border-top:1px solid var(--border)">
        <div style="font-weight:600; margin-bottom:4px">Target Monthly Payment</div>
        <div style="font-size:1.4rem; color:var(--accent); font-weight:700"><span class="privacy-blur">${formatGBP(result.recommendedMonthlyPayment)}</span></div>
        <div class="hint">Pay this amount monthly to clear the transferred balance before the 0% period ends.</div>
      </div>

      ${savings > 0 ? `
        <div style="margin-top:15px; color:var(--success); font-weight:600; display:flex; align-items:center; gap:8px; font-size:0.85rem">
          <span>✅ Recommended: This transfer saves you <span class="privacy-blur">${formatGBP(savings)}</span> compared to minimum payments.</span>
        </div>
      ` : `
        <div style="margin-top:15px; color:var(--danger); font-weight:600; display:flex; align-items:center; gap:8px; font-size:0.85rem">
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

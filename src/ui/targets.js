import { targetRepository } from '../db/repository.js';
import { toPence, fromPence } from '../utils/currency.js';
import { triggerHaptic } from '../utils/haptics.js';
import { notificationUI } from './notifications.js';

/**
 * Targets UI Module
 * Handles rendering and event handling for bucket-based budget targets.
 * Targets are set at the bucket level: 'recurrent' and 'one-off'.
 */
export const targetsUI = {
  /**
   * Initialize Targets UI.
   */
  async init() {
    // Called from app.js or settings tab handler
  },

  /**
   * Render target settings in the settings view.
   * Shows two inputs: Recurrent Monthly Target and One-off Monthly Target.
   */
  async renderTargetSettings() {
    const container = document.getElementById('targetSettingsContainer');
    if (!container) return;

    const [recurrentTarget, oneOffTarget] = await Promise.all([
      targetRepository.getByBucket('recurrent'),
      targetRepository.getByBucket('one-off')
    ]);

    const recurrentAmount = recurrentTarget ? fromPence(recurrentTarget.amount) : '';
    const oneOffAmount = oneOffTarget ? fromPence(oneOffTarget.amount) : '';

    container.innerHTML = `
      <div style="margin-top:20px; padding-top:20px; border-top:1px solid var(--border)">
        <h3 style="font-size:.9rem;margin-bottom:4px">Monthly Budget Targets</h3>
        <div class="hint" style="margin-bottom:16px">
          Set monthly spending targets by bucket. These appear as progress bars on the dashboard.
          <br><strong>Recurrent</strong> covers standing commitments (rent, bills, loans).
          <strong>One-off</strong> covers irregular purchases (groceries, clothing, etc).
        </div>
        <div class="form-row" style="flex-wrap:wrap;gap:16px">
          <div style="display:flex;flex-direction:column;gap:6px">
            <label style="font-weight:600">Recurrent Monthly Target (£)</label>
            <div class="hint" style="margin-bottom:4px">All recurring / standing expenses</div>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="number" step="0.01" min="0" id="recurrentTargetInput"
                value="${recurrentAmount}" placeholder="e.g. 1500"
                style="width:150px;text-align:right" />
              <button class="primary sm" id="saveRecurrentTargetBtn">Save</button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label style="font-weight:600">One-off Monthly Target (£)</label>
            <div class="hint" style="margin-bottom:4px">Irregular / discretionary spending</div>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="number" step="0.01" min="0" id="oneOffTargetInput"
                value="${oneOffAmount}" placeholder="e.g. 500"
                style="width:150px;text-align:right" />
              <button class="primary sm" id="saveOneOffTargetBtn">Save</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners(container);
  },

  /**
   * Set up event listeners for the target settings UI.
   * @param {HTMLElement} container
   */
  setupEventListeners(container) {
    const saveBtn = (bucketName, inputId, btnId) => {
      const btn = container.querySelector(`#${btnId}`);
      const input = container.querySelector(`#${inputId}`);
      if (!btn || !input) return;

      const save = async () => {
        const amount = parseFloat(input.value);
        try {
          const existing = await targetRepository.getByBucket(bucketName);

          if (isNaN(amount) || amount <= 0) {
            if (existing) {
              await targetRepository.delete(existing.id);
              input.value = '';
              console.log(`Deleted target for bucket '${bucketName}'`);
              triggerHaptic('delete');
            }
          } else {
            const amountPence = toPence(amount);
            if (existing) {
              await targetRepository.update(existing.id, { amount: amountPence });
              console.log(`Updated target for bucket '${bucketName}' to ${amount}`);
            } else {
              await targetRepository.add({ bucket: bucketName, amount: amountPence });
              console.log(`Added target for bucket '${bucketName}': ${amount}`);
            }
            triggerHaptic('success');
          }

          // Visual feedback
          btn.textContent = 'Saved!';
          btn.classList.replace('primary', 'ghost');
          setTimeout(() => {
            btn.textContent = 'Save';
            btn.classList.replace('ghost', 'primary');
          }, 2000);

        } catch (error) {
          console.error(`Failed to save target for bucket '${bucketName}':`, error);
          notificationUI.error('Failed to save target: ' + error.message);
        }
      };

      btn.addEventListener('click', save);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') save();
      });
    };

    saveBtn('recurrent', 'recurrentTargetInput', 'saveRecurrentTargetBtn');
    saveBtn('one-off', 'oneOffTargetInput', 'saveOneOffTargetBtn');
  }
};

import { modalUI, showModal, closeModal } from './render.js';
import { RecurrenceManager } from '../utils/recurrence.js';
import { alertWithHaptic } from '../utils/haptics.js';

// Re-export for components that expect them in templates.js
export { showModal, closeModal };

/**
 * Template UI Module (v1.5: Minimized to Modal Helper & Recurrence Trigger)
 * Legacy template logic removed in favor of automatic recurrence.
 */
export const templateUI = {
  async init() {
    // legacy templates deprecated in v1.5
    console.log('templateUI.init(): minimal mode active (recurrence system)');
  },

  /**
   * Manual trigger for recurrence check (previously manual template trigger).
   */
  async manualTrigger(monthStr) {
    try {
      const results = await RecurrenceManager.checkAndGenerate();
      const total = results.recurrentExpenses + results.oneOffExpenses;
      
      if (total > 0) {
        alertWithHaptic(`Recurrence check complete. Generated ${total} new instances.`, 'success');
        window.dispatchEvent(new CustomEvent('app:refresh'));
      } else {
        alertWithHaptic('Recurrence check complete. No new instances needed at this time.', 'success');
      }
    } catch (err) {
      console.error('Recurrence trigger failed:', err);
      alertWithHaptic('Recurrence check failed: ' + err.message);
    }
  },

  /**
   * Shared modal bridge for expensesUI recurrence prompts.
   */
  showModal(title, content, footer) {
    modalUI.show(title, content, footer);
  },

  /**
   * Close the active modal.
   */
  closeModal() {
    modalUI.close();
  }
};

// Make it globally accessible for inline onclick handlers (simpler for this scale)
window.templateUI = templateUI;

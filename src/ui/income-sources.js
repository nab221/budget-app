/**
 * income-sources.js — Phase 39.1 Income Sources tab UI.
 *
 * Wave 0 stub: exports the incomeSources object with no-op methods.
 * Real implementation is added in Phase 39.1 Plan 02.
 */

export const incomeSources = {
  /** @type {string} */
  CONTAINER_ID: 'incomeSourcesContainer',

  /** Initialize the module. */
  async init() {},

  /** Render pending income cards and CRUD controls. */
  async render() {},

  /**
   * Confirm a pending income event and record it in incomeRepository.
   * @param {{ sourceName: string, adjustedDate: string, amount: number }} event - amount in PENCE
   */
  async confirmIncome(_event) {},

  /**
   * Confirm a pending income event with a user-supplied override amount.
   * @param {{ sourceName: string, adjustedDate: string, amount: number }} event - amount in PENCE
   * @param {number} overrideAmountPounds - user-entered amount in POUNDS
   */
  async adjustIncome(_event, _overrideAmountPounds) {},
};

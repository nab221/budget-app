import { getSetting, setSetting } from '../../db/settings.js';

/**
 * Remembered provider→debtId association for card-statement import (spec §4.6).
 * Stored as a single JSON object under the settings key `statementDebtMap`, e.g.
 * `{ "MBNA": 3, "American Express": 5 }`. On the next import of the same
 * provider the UI preselects the remembered debt.
 *
 * The old card parsers did not expose an account-number fragment, so the key is
 * the provider name alone (no last-4-digit refinement).
 */
const KEY = 'statementDebtMap';

/** @returns {Promise<Record<string, number>>} */
export async function getStatementDebtMap() {
  const value = await getSetting(KEY);
  return value && typeof value === 'object' ? value : {};
}

/**
 * Look up the remembered debtId for a provider, or null.
 * @param {string} provider
 * @returns {Promise<number|null>}
 */
export async function getRememberedDebtId(provider) {
  const map = await getStatementDebtMap();
  const id = map[provider];
  return typeof id === 'number' ? id : null;
}

/**
 * Remember that `provider` statements map to `debtId`.
 * @param {string} provider
 * @param {number} debtId
 */
export async function rememberDebtForProvider(provider, debtId) {
  const map = await getStatementDebtMap();
  map[provider] = debtId;
  await setSetting(KEY, map);
}

/**
 * Typed settings helper over the `settings` key/value table.
 *
 * Storage: each setting is one row `{ key, value }`. Pence values are stored as
 * **integer pence** (raw — the settings table is not a money-entity repository,
 * so there is no pounds-at-rest translation on the raw getters). Convenience
 * getters/setters suffixed `Pounds` bridge to the pounds-at-the-edge convention
 * used by the entity repositories.
 *
 * Every setter dispatches `db:mutated` so the React layer re-reads.
 */

import { db } from './schema.js';
import { toPence, fromPence } from '../engine/currency.js';
import { dispatchMutation } from './events.js';

export const SETTINGS_DEFAULTS = {
  currentBalancePence: null,
  balanceAsOf: null,
  safetyBufferPence: 20000, // £200
  everydaySpendPence: 0,
  payoffStrategy: 'avalanche',
  payoffExtraPence: 0,
  theme: 'system',
  privacyMode: false,
  lastExportAt: null,
  // Mileage claim tracker (amendment 2026-08-02 (h)). The employer rate is
  // pence PER MILE (not a money total), used only to prefill a new trip's
  // reimbursement; 0 means "employer pays nothing". The marginal rate turns a
  // shortfall into what the claim is actually worth as a refund.
  mileageEmployerRatePence: 0,
  mileageMarginalRate: 0.4,
};

/**
 * Raw getter: returns the stored value, or the documented default when unset.
 * @param {string} key
 */
export async function getSetting(key) {
  const row = await db.settings.get(key);
  if (row === undefined || row === null) {
    return key in SETTINGS_DEFAULTS ? SETTINGS_DEFAULTS[key] : undefined;
  }
  return row.value;
}

/**
 * Raw setter: stores the value verbatim and signals a mutation.
 * @param {string} key
 * @param {*} value
 */
export async function setSetting(key, value) {
  await db.settings.put({ key, value });
  dispatchMutation();
}

/** Read every known setting, applying defaults. */
export async function getAllSettings() {
  const out = {};
  for (const key of Object.keys(SETTINGS_DEFAULTS)) {
    out[key] = await getSetting(key);
  }
  return out;
}

// ── Typed convenience (pence at rest; pounds bridges) ──────────────────────

export const settings = {
  // Safety buffer
  getSafetyBufferPence: () => getSetting('safetyBufferPence'),
  setSafetyBufferPence: (pence) => setSetting('safetyBufferPence', pence),
  getSafetyBufferPounds: async () => fromPence(await getSetting('safetyBufferPence')),
  setSafetyBufferPounds: (pounds) => setSetting('safetyBufferPence', toPence(pounds)),

  // Everyday spend allowance
  getEverydaySpendPence: () => getSetting('everydaySpendPence'),
  setEverydaySpendPence: (pence) => setSetting('everydaySpendPence', pence),
  getEverydaySpendPounds: async () => fromPence(await getSetting('everydaySpendPence')),
  setEverydaySpendPounds: (pounds) => setSetting('everydaySpendPence', toPence(pounds)),

  // Payoff strategy + extra
  getPayoffStrategy: () => getSetting('payoffStrategy'),
  setPayoffStrategy: (strategy) => setSetting('payoffStrategy', strategy),
  getPayoffExtraPence: () => getSetting('payoffExtraPence'),
  setPayoffExtraPence: (pence) => setSetting('payoffExtraPence', pence),
  getPayoffExtraPounds: async () => fromPence(await getSetting('payoffExtraPence')),
  setPayoffExtraPounds: (pounds) => setSetting('payoffExtraPence', toPence(pounds)),

  // Current balance anchor (spec §4.1)
  getCurrentBalancePence: () => getSetting('currentBalancePence'),
  setCurrentBalancePence: (pence) => setSetting('currentBalancePence', pence),
  getCurrentBalancePounds: async () => {
    const p = await getSetting('currentBalancePence');
    return p === null ? null : fromPence(p);
  },
  setCurrentBalancePounds: (pounds) => setSetting('currentBalancePence', toPence(pounds)),
  getBalanceAsOf: () => getSetting('balanceAsOf'),
  setBalanceAsOf: (date) => setSetting('balanceAsOf', date),

  // UI prefs
  getTheme: () => getSetting('theme'),
  setTheme: (theme) => setSetting('theme', theme),
  getPrivacyMode: () => getSetting('privacyMode'),
  setPrivacyMode: (on) => setSetting('privacyMode', !!on),

  // Mileage claim tracker. `mileageEmployerRatePence` is pence per mile, so
  // there is deliberately no `Pounds` bridge — it is a rate, not an amount.
  getMileageEmployerRatePence: () => getSetting('mileageEmployerRatePence'),
  setMileageEmployerRatePence: (pencePerMile) =>
    setSetting('mileageEmployerRatePence', Math.max(0, Math.round(Number(pencePerMile) || 0))),
  getMileageMarginalRate: () => getSetting('mileageMarginalRate'),
  // Clamped to 0–1: a rate outside that would make `computeRelief` report a
  // refund bigger than the claim, or a negative one.
  setMileageMarginalRate: (rate) =>
    setSetting('mileageMarginalRate', Math.min(1, Math.max(0, Number(rate) || 0))),

  // Backup bookkeeping
  getLastExportAt: () => getSetting('lastExportAt'),
  setLastExportAt: (iso) => setSetting('lastExportAt', iso),
};

export default settings;

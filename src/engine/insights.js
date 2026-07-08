/**
 * insights.js — the dashboard's rule engine (dashboard plan §Z2).
 *
 * Pure module: pence in, cards out. Each rule is a function of
 * `(data, nowStr)` returning zero or more insight cards; `buildInsights` runs
 * them all and sorts by severity. The dashboard shows the top few and renders
 * nothing when the list is empty — no "all good!" filler.
 *
 * Card shape: `{ id, severity: 'danger'|'warn'|'info', title, body, tab? }`.
 * `tab` names the app tab that acts on the insight (deep link). Titles and
 * bodies are ready-to-render strings; money inside them is formatted here
 * (engine `formatGBP`), so tests can assert the exact copy.
 */

import { differenceInCalendarDays, parseISO } from 'date-fns';
import { calcMinPayment, simulatePayoff } from './finance.js';
import { annualisedBillPence } from './spending.js';
import { toFinanceDebts } from './payoff.js';
import { formatGBP } from './currency.js';

const SEVERITY_RANK = { danger: 0, warn: 1, info: 2 };

// Rule thresholds — named so the copy and the tests agree.
export const PROMO_NOTICE_DAYS = 90; // promo-cliff rule starts firing
export const PROMO_WARN_DAYS = 30;
export const PROMO_DANGER_DAYS = 7;
export const SMALL_EXPENSE_PENCE = 1500; // "subscription creep" = under £15
export const SMALL_EXPENSE_MIN_COUNT = 3;
export const STRATEGY_SAVING_MIN_PENCE = 1000; // ignore < £10 differences
export const STALE_BALANCE_DAYS = 60;
export const BACKUP_STALE_DAYS = 14;

const daysBetween = (fromStr, toStr) =>
  differenceInCalendarDays(parseISO(toStr), parseISO(fromStr));

/**
 * The APR a debt actually charges at `refStr`: 0 inside a card's promo window,
 * the post-promo rate (falling back to the standard APR) after it; a loan's
 * flat interest rate.
 */
export function effectiveApr(debt, refStr) {
  if (debt.debtType === 'loan') return debt.interestRate ?? 0;
  const promoActive = debt.promoEndDate && refStr < debt.promoEndDate;
  return promoActive ? 0 : (debt.postPromoApr ?? debt.apr ?? 0);
}

/**
 * Estimated interest cost per month across all debts at current balances
 * (balance × APR ÷ 12 per debt — the same convention the simulators charge).
 *
 * @param {Array} debts - planData-shape debts (pence).
 * @param {string} refStr - ISO yyyy-MM-dd used for promo checks.
 * @returns {{ totalPence: number, byDebt: Array<{id, name, pence}> }}
 */
export function monthlyInterestPence(debts, refStr) {
  const byDebt = [];
  let totalPence = 0;
  for (const d of debts || []) {
    const balance = d.balancePence || 0;
    if (balance <= 0) continue;
    const pence = Math.round((balance * (effectiveApr(d, refStr) / 100)) / 12);
    byDebt.push({ id: d.id, name: d.name, pence });
    totalPence += pence;
  }
  return { totalPence, byDebt };
}

// ---------------------------------------------------------------------------
// Rules — each returns an array of cards (usually 0 or 1)
// ---------------------------------------------------------------------------

/** Rule 1 — a 0% promo is about to end and the card gets expensive. */
function promoCliff(data, nowStr) {
  const cards = [];
  for (const d of data.debts || []) {
    if (d.debtType === 'loan' || !d.promoEndDate) continue;
    if ((d.balancePence || 0) <= 0) continue;
    if (d.promoEndDate < nowStr) continue; // already over — the APR tells the story now
    const days = daysBetween(nowStr, d.promoEndDate);
    if (days > PROMO_NOTICE_DAYS) continue;
    const rate = d.postPromoApr ?? d.apr ?? 0;
    // Minimum payment the day after the promo ends (no promo window passed —
    // we are pricing the cliff itself).
    const newMin = calcMinPayment(d.balancePence || 0, rate, 0, null, null);
    const severity =
      days <= PROMO_DANGER_DAYS ? 'danger' : days <= PROMO_WARN_DAYS ? 'warn' : 'info';
    cards.push({
      id: `promo-cliff-${d.id}`,
      severity,
      title:
        days === 0
          ? `0% on ${d.name} ends today`
          : `0% on ${d.name} ends in ${days} day${days === 1 ? '' : 's'}`,
      body: `At ${rate}% its minimum payment becomes ≈ ${formatGBP(newMin)}/month on the current ${formatGBP(d.balancePence || 0)} balance. Clearing or transferring it before ${d.promoEndDate} avoids the jump.`,
      tab: 'payoff',
    });
  }
  return cards;
}

/** Rule 4 — many small recurring expenses quietly add up. */
function subscriptionCreep(data) {
  const small = (data.recurringBills || []).filter(
    (b) => b.active !== false && (b.amountPence || 0) > 0 && b.amountPence < SMALL_EXPENSE_PENCE
  );
  if (small.length < SMALL_EXPENSE_MIN_COUNT) return [];
  const annual = Math.round(small.reduce((t, b) => t + annualisedBillPence(b), 0));
  return [
    {
      id: 'subscription-creep',
      severity: 'info',
      title: 'Small subscriptions add up',
      body: `Your ${small.length} recurring expenses under £15 total ≈ ${formatGBP(annual)} a year. Worth a cancellation audit?`,
      tab: 'expenses',
    },
  ];
}

/** Rule 5 — the persisted payoff strategy is not the cheapest one. */
function strategyCheck(data, nowStr) {
  const { cards } = toFinanceDebts(data.debts || []);
  if (cards.length < 2) return []; // with one card the strategies are identical
  const chosen = data.payoffStrategy === 'snowball' ? 'snowball' : 'avalanche';
  const other = chosen === 'snowball' ? 'avalanche' : 'snowball';
  const extra = data.payoffExtraPence || 0;
  const chosenSim = simulatePayoff(cards, chosen, extra, nowStr);
  const otherSim = simulatePayoff(cards, other, extra, nowStr);
  const saving = chosenSim.totalInterest - otherSim.totalInterest;
  if (saving < STRATEGY_SAVING_MIN_PENCE) return [];
  const monthsSooner = chosenSim.monthsToClear - otherSim.monthsToClear;
  return [
    {
      id: 'strategy-check',
      severity: 'warn',
      title: `${other === 'avalanche' ? 'Avalanche' : 'Snowball'} would beat your ${chosen} plan`,
      body: `Switching to ${other} saves ≈ ${formatGBP(saving)} in interest${
        monthsSooner > 0
          ? ` and clears the cards ${monthsSooner} month${monthsSooner === 1 ? '' : 's'} sooner`
          : ''
      }. Change the strategy on the Payoff tab if the trade-off suits you.`,
      tab: 'payoff',
    },
  ];
}

/** Rule 6 — debt balances haven't been updated for a while; projections drift. */
function staleBalances(data, nowStr) {
  const stale = (data.debts || []).filter((d) => {
    if ((d.balancePence || 0) <= 0) return false;
    if (!d.balanceAsOf) return true;
    return daysBetween(d.balanceAsOf, nowStr) > STALE_BALANCE_DAYS;
  });
  if (stale.length === 0) return [];
  const names = stale.map((d) => d.name);
  const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '');
  return [
    {
      id: 'stale-balances',
      severity: 'warn',
      title:
        stale.length === 1
          ? `${names[0]}'s balance needs updating`
          : `${stale.length} debt balances need updating`,
      body: `${shown} ${stale.length === 1 ? 'has' : 'have'} had no balance update in over ${STALE_BALANCE_DAYS} days — every payoff figure drifts with it. Update from your banking app or a statement PDF.`,
      tab: 'expenses',
    },
  ];
}

/** Rule 7 — the 14-day backup nudge, as a dashboard card. */
function backupNudge(data, nowStr) {
  const last = data.lastExportAt;
  let ageDays = null;
  if (last) {
    const then = new Date(last).getTime();
    if (!Number.isNaN(then)) {
      ageDays = Math.floor((parseISO(nowStr).getTime() - then) / (1000 * 60 * 60 * 24));
      if (ageDays <= BACKUP_STALE_DAYS) return [];
    }
  }
  return [
    {
      id: 'backup-nudge',
      severity: 'info',
      title: last ? `Your last backup is ${ageDays} days old` : 'No backup exported yet',
      body: 'This data lives only in this browser. Export a JSON backup from Settings — it takes one click.',
      tab: 'settings',
    },
  ];
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const RULES = [promoCliff, subscriptionCreep, strategyCheck, staleBalances, backupNudge];

/**
 * Run every insight rule and return the cards, most severe first (stable by
 * rule order within a severity).
 *
 * @param {{ recurringBills?: Array, debts?: Array, childcareDeposits?: Array,
 *   payoffStrategy?: string, payoffExtraPence?: number,
 *   lastExportAt?: string|null }} data - PENCE domain.
 * @param {string} nowStr - ISO yyyy-MM-dd "today".
 * @returns {Array<{id, severity, title, body, tab?}>}
 */
export function buildInsights(data, nowStr) {
  const cards = RULES.flatMap((rule) => rule(data, nowStr));
  return cards
    .map((card, i) => ({ card, i }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.card.severity] - SEVERITY_RANK[b.card.severity] || a.i - b.i
    )
    .map(({ card }) => card);
}

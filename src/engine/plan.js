/**
 * plan.js — the pay-period assembly engine (Phase 3, step 1).
 *
 * Pure module. **No DB access.** Everything works in integer **pence** and is
 * driven entirely by injected data plus an injected `now` so it is fully
 * deterministic and testable. The `src/db/planData.js` adapter is responsible
 * for reading the repositories (which speak POUNDS at their edge) and handing
 * this module clean pence-domain objects.
 *
 * ── Money convention ───────────────────────────────────────────────────────
 * Every `*Pence` field here is genuine integer pence. There are NO pounds in
 * this file — conversions happen once, at the planData adapter boundary.
 *
 * ── Period model (design decision) ─────────────────────────────────────────
 * A pay period runs from one income event (of ANY source) to the next: it is
 * payday-to-payday. `offset` selects which period relative to today:
 *   0  → the period that CONTAINS `now`
 *   -n → n periods earlier,  +n → n periods later.
 *
 * The window for a period is [periodStart, periodEnd) — inclusive of the start
 * payday, exclusive of the end payday — so every calendar date belongs to
 * exactly one period and nothing is double-counted across adjacent periods.
 *
 * `openingBalancePence` is the manually-entered current balance (settings
 * anchor). It is treated as the balance at `periodStart` (the last payday); the
 * owner is expected to refresh it around payday, which is why the dashboard
 * shows a stale-balance hint. Income that arrives AT `periodStart` is therefore
 * already baked into that opening balance and is not re-added; income arriving
 * strictly inside the period is added to the running balance; the income at
 * `periodEnd` belongs to the NEXT period (it is the answer to "how much do I
 * have right before next payday") and is surfaced only as the boundary event.
 *
 * ── childcareDeposits stub contract (Phase 5 wires this) ───────────────────
 * `childcareDeposits` is an array of committed monthly childcare deposits, each:
 *   { label: string, amountPence: number, paymentDayOfMonth: number (1-28),
 *     adjustToWorkingDay?: boolean (default true) }
 * They are placed within the period exactly like debt payments (monthly
 * day-of-month occurrence, working-day adjusted). Empty by default in Phase 3.
 */

import {
  addMonths,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  parseISO,
  subMonths,
} from 'date-fns';
import { getUpcomingIncomeEvents } from './income.js';
import { nextWorkingDay } from './banking-calendar.js';
import { calcMinPayment, orderDebtsByStrategy } from './finance.js';

// ---------------------------------------------------------------------------
// Date helpers (all comparisons on 'yyyy-MM-dd' strings — lexical order works)
// ---------------------------------------------------------------------------

export const FREQUENCY_MONTHS = { monthly: 1, quarterly: 3, annual: 12 };

/**
 * Number of calendar months in one step of a bill frequency.
 * `monthly → 1`, `quarterly → 3`, `annual → 12`. Unknown frequencies fall back
 * to monthly. This is the SINGLE source of truth for frequency stepping — both
 * the read-time occurrence computation here and `src/db/billConfirmation.js`
 * (which bumps `nextDueDate` on confirm/unconfirm) go through it, so they can
 * never drift. Note: do NOT use `recurrence.advanceNextDate` for this — it keys
 * off `annually` and treats the spec's `annual` as monthly.
 *
 * @param {string} frequency
 * @returns {number}
 */
export function frequencyStepMonths(frequency) {
  return FREQUENCY_MONTHS[frequency] ?? 1;
}

/**
 * Days in a given calendar month, computed purely from year+month integers so
 * there is NO Date/timezone involvement (H2). `month` is 1-12.
 * @param {number} year
 * @param {number} month - 1-12
 * @returns {number}
 */
export function daysInMonthYM(year, month) {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/**
 * Nominal 'yyyy-MM-dd' for a given `yyyy-MM` month + day-of-month, clamped to
 * the real length of that month. PURE STRING MATH — no Date object, so it is
 * completely timezone-independent (H2: the old version mixed a local
 * `getDaysInMonth` with `setUTCDate`, which under BST landed dates in the wrong
 * month/day).
 *
 * @param {string} yyyyMM - e.g. '2026-07'
 * @param {number} dayOfMonth
 * @returns {string} 'yyyy-MM-dd'
 */
export function dateForMonthDayStr(yyyyMM, dayOfMonth) {
  const [year, month] = yyyyMM.split('-').map(Number);
  const dim = daysInMonthYM(year, month);
  const clamped = Math.min(Math.max(dayOfMonth || 1, 1), dim);
  return `${yyyyMM}-${String(clamped).padStart(2, '0')}`;
}

/**
 * Advance a 'yyyy-MM-dd' date by `steps` frequency steps (may be negative to
 * roll backwards). Returns a 'yyyy-MM-dd' string. Shared by plan occurrence
 * computation and bill confirmation so the two stay consistent.
 *
 * When `anchorDay` is supplied the target date is re-clamped to
 * `min(anchorDay, daysInMonth(target))` (M4). This prevents month-end drift:
 * a bill due the 31st that gets clamped to the 28th in February must return to
 * the 31st in March rather than being stuck on the 28th forever. Without an
 * anchor the behaviour is unchanged (date-fns `addMonths` clamps as before).
 *
 * @param {string} dateStr - ISO 'yyyy-MM-dd'
 * @param {string} frequency - 'monthly' | 'quarterly' | 'annual'
 * @param {number} [steps=1]
 * @param {number|null} [anchorDay=null] - original intended day-of-month.
 * @returns {string}
 */
export function advanceByFrequency(dateStr, frequency, steps = 1, anchorDay = null) {
  const stepped = addMonths(parseISO(dateStr), frequencyStepMonths(frequency) * steps);
  const yyyyMM = fmt(stepped).slice(0, 7);
  if (anchorDay != null) return dateForMonthDayStr(yyyyMM, anchorDay);
  return fmt(stepped);
}

function fmt(date) {
  return format(date, 'yyyy-MM-dd');
}

/** Day-of-month (1-31) parsed from a 'yyyy-MM-dd' string — pure, TZ-free. */
function dayOfMonthFromISO(iso) {
  const n = Number(String(iso).slice(8, 10));
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}

/** Working-day adjust a 'yyyy-MM-dd' string, returning { date, isAdjusted }. */
function adjust(nominalStr, adjustToWorkingDay) {
  if (!adjustToWorkingDay) return { date: nominalStr, isAdjusted: false };
  const adjusted = fmt(nextWorkingDay(nominalStr));
  return { date: adjusted, isAdjusted: adjusted !== nominalStr };
}

/**
 * All monthly occurrences of `dayOfMonth` whose (working-day adjusted) date
 * lands within [startStr, endStr) — used for debt payments and childcare.
 * Returns [{ date, isAdjusted }].
 */
function monthlyOccurrencesInWindow(dayOfMonth, adjustToWorkingDay, startStr, endStr) {
  const out = [];
  // Begin one month before the window start so a late-month nominal date whose
  // working-day shift crosses into the window is still caught. The Date cursor
  // is used ONLY to enumerate months (via local parse+format, which round-trips
  // the calendar month safely); the actual nominal date is built with pure
  // string math so nothing depends on the process timezone (H2).
  let cursor = subMonths(parseISO(`${startStr.slice(0, 7)}-01`), 1);
  const guardEnd = parseISO(`${endStr.slice(0, 7)}-01`);
  for (let i = 0; i < 200 && cursor <= addMonths(guardEnd, 1); i += 1) {
    const nominal = dateForMonthDayStr(fmt(cursor).slice(0, 7), dayOfMonth);
    const { date, isAdjusted } = adjust(nominal, adjustToWorkingDay);
    if (date >= startStr && date < endStr) out.push({ date, isAdjusted });
    cursor = addMonths(cursor, 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Income events + period boundaries
// ---------------------------------------------------------------------------

/**
 * Build the sorted list of income boundary dates (unique, ascending) and a
 * lookup of the events landing on each date, over a window wide enough to
 * cover the requested offset in both directions.
 */
function computeIncomeTimeline(incomeSources, now, offset) {
  // income.js expects { id, name, monthlyAmount, payDateRule, payDateDay, isActive }.
  const mapped = (incomeSources || []).map((s) => ({
    id: s.id,
    name: s.name,
    monthlyAmount: s.amountPence, // already pence in the plan domain
    payDateRule: s.payDateRule,
    payDateDay: s.payDateDay,
    isActive: s.active !== false,
  }));
  const active = mapped.filter((s) => s.isActive);
  if (active.length === 0) return { boundaries: [], byDate: new Map() };

  const backMonths = 3 + Math.max(0, -offset);
  const forwardMonths = 4 + Math.max(0, offset);
  const fromDate = fmt(subMonths(now, backMonths));
  // Enough events to cover the window (roughly one per source per month) plus a
  // small margin. Kept tight so we don't enumerate years into the future.
  const limit = Math.max(8, active.length * (backMonths + forwardMonths + 2));
  const events = getUpcomingIncomeEvents(active, fromDate, limit);

  const byDate = new Map();
  for (const ev of events) {
    if (!byDate.has(ev.adjustedDate)) byDate.set(ev.adjustedDate, []);
    byDate.get(ev.adjustedDate).push(ev);
  }
  const boundaries = Array.from(byDate.keys()).sort();
  return { boundaries, byDate };
}

// ---------------------------------------------------------------------------
// Outgoings assembly
// ---------------------------------------------------------------------------

/** Recurring-bill instances (computed, never persisted) within [start, end). */
function billOutgoings(recurringBills, startStr, endStr) {
  const rows = [];
  for (const bill of recurringBills || []) {
    if (bill.active === false) continue;
    if (!bill.nextDueDate) continue;

    // `nextDueDate` is by definition the next UNPAID occurrence — once a bill is
    // confirmed paid, `nextDueDate` is advanced one step past the paid date. We
    // therefore NEVER walk earlier than `nextDueDate` (the old unconditional
    // one-step back-off re-introduced a just-paid occurrence — BUG-1 / M1).
    //
    // The anchor day keeps month-end bills from drifting (M4): the walk is done
    // in pure string space via `advanceByFrequency(..., anchorDay)`.
    const anchorDay = bill.dueDayAnchor ?? dayOfMonthFromISO(bill.nextDueDate);

    // Fast-forward towards the window, but stop while the NEXT occurrence would
    // still be before the window start — leaving the cursor on the last
    // occurrence whose nominal is < start (so a working-day shift can pull it
    // in) OR on `nextDueDate` itself when that already sits on/after the start.
    let curStr = bill.nextDueDate;
    let guard = 0;
    while (guard < 600) {
      const nextStr = advanceByFrequency(curStr, bill.frequency, 1, anchorDay);
      if (nextStr < startStr) {
        curStr = nextStr;
        guard += 1;
      } else {
        break;
      }
    }

    for (let i = 0; i < 600; i += 1) {
      const nominalStr = curStr;
      if (nominalStr >= endStr) break;
      // Inclusion is decided on the working-day-adjusted date, not the nominal.
      const withinEnd = !bill.endDate || nominalStr <= bill.endDate;
      if (withinEnd) {
        const { date, isAdjusted } = adjust(nominalStr, bill.adjustToWorkingDay !== false);
        if (date >= startStr && date < endStr) {
          rows.push({
            date,
            label: bill.label || 'Bill',
            amountPence: bill.amountPence || 0,
            kind: 'bill',
            isAdjusted,
            sourceId: bill.id,
          });
        }
      }
      curStr = advanceByFrequency(curStr, bill.frequency, 1, anchorDay);
    }
  }
  return rows;
}

/** Minimum payment (pence) for a credit-card debt, honouring override + promo. */
function creditCardMinPence(debt, referenceDate) {
  const override = debt.minPaymentOverridePence;
  if (override != null && override !== '') return override; // already pence
  return calcMinPayment(
    debt.balancePence || 0,
    debt.apr ?? 0,
    0,
    referenceDate,
    debt.promoEndDate ?? null,
  );
}

/** Debt payments (card minimums + loan fixed payments) within [start, end). */
function debtOutgoings(debts, startStr, endStr) {
  const rows = [];
  for (const debt of debts || []) {
    const day = debt.paymentDayOfMonth || 1;
    const occurrences = monthlyOccurrencesInWindow(day, true, startStr, endStr);
    if (occurrences.length === 0) continue;

    if (debt.debtType === 'loan') {
      const amountPence = debt.fixedMonthlyPaymentPence || 0;
      if (amountPence <= 0) continue;
      for (const occ of occurrences) {
        rows.push({
          date: occ.date,
          label: `${debt.name} (loan)`,
          amountPence,
          kind: 'loan',
          isAdjusted: occ.isAdjusted,
          debtId: debt.id,
        });
      }
    } else {
      // credit card — min payment computed on the payment date (promo-aware)
      if ((debt.balancePence || 0) <= 0) continue;
      for (const occ of occurrences) {
        const amountPence = creditCardMinPence(debt, occ.date);
        if (amountPence <= 0) continue;
        rows.push({
          date: occ.date,
          label: `${debt.name} (min payment)`,
          amountPence,
          kind: 'debt-min',
          isAdjusted: occ.isAdjusted,
          debtId: debt.id,
        });
      }
    }
  }
  return rows;
}

/** Childcare deposits (stub input) placed like debt payments. */
function childcareOutgoings(childcareDeposits, startStr, endStr) {
  const rows = [];
  for (const dep of childcareDeposits || []) {
    const amountPence = dep.amountPence || 0;
    if (amountPence <= 0) continue;
    const occurrences = monthlyOccurrencesInWindow(
      dep.paymentDayOfMonth || 1,
      dep.adjustToWorkingDay !== false,
      startStr,
      endStr,
    );
    for (const occ of occurrences) {
      rows.push({
        date: occ.date,
        label: dep.label || 'Childcare deposit',
        amountPence,
        kind: 'childcare',
        isAdjusted: occ.isAdjusted,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

function buildRecommendation(debts, strategy, safeExtraPence, needsBalance, nowStr) {
  if (needsBalance) {
    return { needsBalance: true, hasSpare: false, safeExtraPence: null, debtId: null, debtName: null };
  }

  const withBalance = (debts || []).filter((d) => (d.balancePence || 0) > 0);
  const cards = withBalance.filter((d) => d.debtType !== 'loan');
  const loans = withBalance.filter((d) => d.debtType === 'loan');

  let target = null;
  if (cards.length > 0) {
    // Reuse the finance ordering helper (single source of truth for strategy order).
    const ordered = orderDebtsByStrategy(
      cards.map((d) => ({ ...d, currentBalance: d.balancePence })),
      strategy,
      nowStr,
    );
    target = ordered[0] || null;
  } else if (loans.length > 0) {
    // No cards to overpay — fall back to the highest-rate loan.
    target = [...loans].sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0))[0];
  }

  return {
    needsBalance: false,
    hasSpare: safeExtraPence > 0,
    safeExtraPence,
    debtId: target ? target.id : null,
    debtName: target ? target.name : null,
    hasDebts: withBalance.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble a full pay-period plan.
 *
 * @param {object} data
 * @param {Date} data.now - injected "today".
 * @param {Array} data.incomeSources - pence-domain income sources.
 * @param {Array} data.recurringBills - pence-domain recurring bills.
 * @param {Array} data.debts - pence-domain debts.
 * @param {object} data.settings - { currentBalancePence (nullable), safetyBufferPence, everydaySpendPence, payoffStrategy }.
 * @param {Array} [data.childcareDeposits] - stub, see contract above.
 * @param {number} [offset=0] - period offset (0 = current).
 * @returns {object} plan (see module doc).
 */
export function buildPlan(data, offset = 0) {
  const {
    now = new Date(),
    incomeSources = [],
    recurringBills = [],
    debts = [],
    settings = {},
    childcareDeposits = [],
  } = data || {};

  const nowStr = fmt(now);
  const currentBalancePence = settings.currentBalancePence ?? null;
  const safetyBufferPence = settings.safetyBufferPence ?? 20000;
  const everydaySpendPence = settings.everydaySpendPence ?? 0;
  const strategy = settings.payoffStrategy ?? 'avalanche';
  const balanceAsOf = settings.balanceAsOf ?? null;
  const needsBalance = currentBalancePence == null;

  const { boundaries, byDate } = computeIncomeTimeline(incomeSources, now, offset);

  // No income → no period. Return a coherent flagged state.
  if (boundaries.length < 2) {
    return {
      offset,
      needsIncome: true,
      needsBalance,
      hasPeriod: false,
      periodStart: null,
      periodEnd: null,
      periodDays: 0,
      incomeEvents: [],
      outgoings: [],
      timeline: [],
      openingBalancePence: needsBalance ? null : currentBalancePence,
      projectedEndBalancePence: null,
      belowBufferDate: null,
      negativeDate: null,
      safetyBufferPence,
      safeExtraPence: null,
      recommendation: buildRecommendation(debts, strategy, 0, needsBalance, nowStr),
      canGoPrev: false,
      canGoNext: false,
    };
  }

  // Index of the period containing `now`: last boundary on/before now.
  let curIdx = -1;
  for (let k = 0; k < boundaries.length; k += 1) {
    if (boundaries[k] <= nowStr) curIdx = k;
  }
  if (curIdx === -1) curIdx = 0; // now precedes the earliest generated boundary

  const startIdx = curIdx + offset;
  const endIdx = startIdx + 1;
  const canGoPrev = startIdx - 1 >= 0;
  const canGoNext = endIdx + 1 < boundaries.length;

  if (startIdx < 0 || endIdx >= boundaries.length) {
    return {
      offset,
      needsIncome: false,
      needsBalance,
      hasPeriod: false,
      periodStart: null,
      periodEnd: null,
      periodDays: 0,
      incomeEvents: [],
      outgoings: [],
      timeline: [],
      openingBalancePence: needsBalance ? null : currentBalancePence,
      projectedEndBalancePence: null,
      belowBufferDate: null,
      negativeDate: null,
      safetyBufferPence,
      safeExtraPence: null,
      recommendation: buildRecommendation(debts, strategy, 0, needsBalance, nowStr),
      canGoPrev,
      canGoNext,
    };
  }

  const periodStart = boundaries[startIdx];
  const periodEnd = boundaries[endIdx];
  const periodDays = differenceInCalendarDays(parseISO(periodEnd), parseISO(periodStart));

  // Income events touching the period: opening (== start) and the boundary
  // (== end, the next payday). Because every income event defines a boundary,
  // there is never an income event strictly *inside* a period — the opening
  // payday is already baked into the anchor balance, and the boundary payday
  // belongs to the next period (the projection ends right before it arrives).
  const incomeEvents = [];
  for (const dateKey of boundaries) {
    if (dateKey < periodStart || dateKey > periodEnd) continue;
    for (const ev of byDate.get(dateKey)) {
      incomeEvents.push({
        date: dateKey,
        label: ev.sourceName,
        amountPence: ev.amount,
        sourceId: ev.sourceId,
        isOpening: dateKey === periodStart,
        isBoundary: dateKey === periodEnd,
      });
    }
  }

  // Outgoings within [periodStart, periodEnd).
  const outgoings = [
    ...billOutgoings(recurringBills, periodStart, periodEnd),
    ...debtOutgoings(debts, periodStart, periodEnd),
    ...childcareOutgoings(childcareDeposits, periodStart, periodEnd),
  ].map((o) => ({ ...o, direction: 'out' }));

  // Prorated everyday-spend allowance: monthly × periodDays / daysInMonth(start).
  const daysInStartMonth = getDaysInMonth(parseISO(periodStart));
  const allowancePence =
    everydaySpendPence > 0 ? Math.round((everydaySpendPence * periodDays) / daysInStartMonth) : 0;
  const allowanceRow =
    allowancePence > 0
      ? {
          date: periodEnd, // attributed to the end of the period
          label: 'Everyday spending',
          amountPence: allowancePence,
          kind: 'allowance',
          direction: 'out',
          isAllowance: true,
        }
      : null;

  // Timeline: outgoings sorted by date, with the synthetic allowance placed
  // last. (Income never falls inside a period — see incomeEvents above.)
  const dated = [...outgoings];
  dated.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return (a.label || '').localeCompare(b.label || '');
  });
  const ordered = allowanceRow ? [...dated, allowanceRow] : dated;

  const outgoingsOut = outgoings.concat(allowanceRow ? [allowanceRow] : []);

  // Running projected balance (skipped when the balance anchor is missing).
  let timeline = ordered.map((r) => ({ ...r }));
  let projectedEndBalancePence = null;
  let belowBufferDate = null;
  let negativeDate = null;

  // Mid-period balance refresh (M3): the manual anchor already reflects any
  // outgoing dated strictly BEFORE `balanceAsOf`, so counting those again would
  // double-count them. For the CURRENT period only (offset 0) we exclude such
  // rows from the running projection and flag them `beforeBalance` so the UI can
  // dim them without affecting the projected end / safe-extra. Navigated
  // (past/future) periods keep the plain behaviour.
  const excludeBefore = offset === 0 && balanceAsOf ? balanceAsOf : null;

  if (!needsBalance) {
    let running = currentBalancePence;
    timeline = ordered.map((row) => {
      const beforeBalance =
        excludeBefore != null && row.direction === 'out' && row.date < excludeBefore;
      if (!beforeBalance) {
        running += row.direction === 'in' ? row.amountPence : -row.amountPence;
        if (negativeDate === null && running < 0) negativeDate = row.date;
        if (belowBufferDate === null && running < safetyBufferPence) belowBufferDate = row.date;
      }
      return { ...row, runningBalancePence: running, beforeBalance };
    });
    projectedEndBalancePence = running;
  } else if (excludeBefore != null) {
    // No balance anchor yet, but still expose the flag for consistent rendering.
    timeline = ordered.map((row) => ({
      ...row,
      beforeBalance: row.direction === 'out' && row.date < excludeBefore,
    }));
  }

  const safeExtraPence = needsBalance
    ? null
    : Math.max(0, projectedEndBalancePence - safetyBufferPence);

  return {
    offset,
    needsIncome: false,
    needsBalance,
    hasPeriod: true,
    periodStart,
    periodEnd,
    periodDays,
    incomeEvents,
    outgoings: outgoingsOut,
    timeline,
    openingBalancePence: needsBalance ? null : currentBalancePence,
    projectedEndBalancePence,
    belowBufferDate,
    negativeDate,
    safetyBufferPence,
    safeExtraPence,
    recommendation: buildRecommendation(debts, strategy, safeExtraPence ?? 0, needsBalance, nowStr),
    canGoPrev,
    canGoNext,
  };
}

export default buildPlan;

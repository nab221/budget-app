/**
 * Mutation event bus.
 *
 * Every repository/settings/backup mutation dispatches a `db:mutated`
 * CustomEvent on `window`. This is the port of the old app's `triggerSync`
 * pattern with every trace of cloud/localStorage sync removed — it is now a
 * pure "the database changed, re-read it" signal that `useLiveData` listens to.
 */

import Dexie from 'dexie';

export const DB_MUTATED_EVENT = 'db:mutated';

/**
 * Notify listeners that the database changed. Safe to call in non-browser
 * (test) environments where `window` may be undefined.
 *
 * ── Deferral inside an open transaction (BUG-1) ────────────────────────────
 * When a mutation happens INSIDE an explicit `db.transaction('rw', …)` block
 * (e.g. `confirmBillPayment`, which writes the ledger row and bumps the bill's
 * due date atomically), dispatching the event synchronously is unsafe:
 * `useLiveData`'s listener re-runs its query on the SAME synchronous stack,
 * still inside Dexie's transaction zone (PSD). Any store the query reads that
 * is not part of the transaction's scope throws `NotFoundError`, which
 * `useLiveData` swallows into its error state — leaving the screen stuck on
 * "Loading…" (a blank page) even though the write itself succeeded.
 *
 * So when a transaction is active we defer the dispatch to its `complete`
 * event: listeners then re-read AFTER the transaction has committed and its
 * zone has closed. On abort/rollback nothing fires (correct — no change
 * happened). Outside a transaction the dispatch stays synchronous, matching the
 * previous behaviour for the common single-write path.
 */
export function dispatchMutation() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  const fire = () => window.dispatchEvent(new CustomEvent(DB_MUTATED_EVENT));

  const tx = Dexie.currentTransaction;
  if (tx) {
    tx.on('complete', fire);
  } else {
    fire();
  }
}

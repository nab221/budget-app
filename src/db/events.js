/**
 * Mutation event bus.
 *
 * Every repository/settings/backup mutation dispatches a `db:mutated`
 * CustomEvent on `window`. This is the port of the old app's `triggerSync`
 * pattern with every trace of cloud/localStorage sync removed — it is now a
 * pure "the database changed, re-read it" signal that `useLiveData` listens to.
 */

export const DB_MUTATED_EVENT = 'db:mutated';

/**
 * Notify listeners that the database changed. Safe to call in non-browser
 * (test) environments where `window` may be undefined.
 */
export function dispatchMutation() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(DB_MUTATED_EVENT));
  }
}

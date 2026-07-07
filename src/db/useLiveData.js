import { useCallback, useEffect, useRef, useState } from 'react';
import { DB_MUTATED_EVENT } from './events.js';

/**
 * Run an async query against the database and keep its result live.
 *
 * The query re-runs on mount, whenever `deps` change, and whenever any
 * repository dispatches a `db:mutated` event. Out-of-order async results are
 * dropped (only the latest run may commit state), so rapid mutations settle on
 * the correct final value.
 *
 * @template T
 * @param {() => Promise<T>} queryFn - async function returning the data.
 * @param {any[]} [deps] - dependency list; the query re-runs when these change.
 * @returns {{ data: T | undefined, loading: boolean, error: Error | null }}
 */
export function useLiveData(queryFn, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  // Monotonic run counter so a slow earlier query can't overwrite a newer one.
  const runIdRef = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableQuery = useCallback(queryFn, deps);

  useEffect(() => {
    let cancelled = false;
    const runId = ++runIdRef.current;

    const run = async () => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const data = await stableQuery();
        if (!cancelled && runId === runIdRef.current) {
          setState({ data, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled && runId === runIdRef.current) {
          setState({ data: undefined, loading: false, error });
        }
      }
    };

    run();

    const onMutated = () => run();
    if (typeof window !== 'undefined') {
      window.addEventListener(DB_MUTATED_EVENT, onMutated);
    }
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener(DB_MUTATED_EVENT, onMutated);
      }
    };
  }, [stableQuery]);

  return state;
}

export default useLiveData;

import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useLiveData } from './useLiveData.js';
import { categoriesRepo } from './repositories.js';
import { seedDefaultCategories } from './seed.js';
import { dispatchMutation } from './events.js';

beforeEach(resetDb);
afterEach(cleanup);

describe('useLiveData', () => {
  it('loads then resolves data', async () => {
    await seedDefaultCategories();
    const { result } = renderHook(() => useLiveData(() => categoriesRepo.getAll(), []));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(10);
    expect(result.current.error).toBe(null);
  });

  it('re-runs the query when db:mutated fires', async () => {
    const { result } = renderHook(() => useLiveData(() => categoriesRepo.getAll(), []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(0);

    // Mutate via the repository (which dispatches db:mutated itself).
    await act(async () => {
      await categoriesRepo.add({ name: 'Salary', kind: 'income' });
    });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });

  it('reacts to a bare db:mutated dispatch', async () => {
    let calls = 0;
    const { result } = renderHook(() =>
      useLiveData(async () => {
        calls += 1;
        return calls;
      }, [])
    );
    await waitFor(() => expect(result.current.data).toBe(1));

    act(() => {
      dispatchMutation();
    });
    await waitFor(() => expect(result.current.data).toBe(2));
  });

  it('a slow earlier run cannot overwrite a newer one (M2 stale race)', async () => {
    // First run resolves slowly (value 1); the mutation-triggered second run
    // resolves fast (value 2). The final state must reflect the LATER run.
    let call = 0;
    const query = () => {
      call += 1;
      const n = call;
      return new Promise((res) => setTimeout(() => res(n), n === 1 ? 60 : 5));
    };
    const { result } = renderHook(() => useLiveData(query, []));

    // Kick off the fast second run while the first is still in flight.
    act(() => {
      dispatchMutation();
    });

    await waitFor(() => expect(result.current.data).toBe(2));
    // Let the slow first run resolve — it must NOT clobber the newer value.
    await new Promise((r) => setTimeout(r, 80));
    expect(result.current.data).toBe(2);
  });
});

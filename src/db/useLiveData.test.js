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
});

import Placeholder from './Placeholder.jsx';
import { useLiveData } from '../db/useLiveData.js';
import { categoriesRepo } from '../db/repositories.js';

export default function Settings() {
  // Trivial live read to prove the data layer + useLiveData hook are wired.
  // The real Settings UI lands in Phase 2.
  const { data: categories, loading } = useLiveData(() => categoriesRepo.getAll(), []);

  return (
    <>
      <Placeholder title="Settings" phase={2} />
      <p className="placeholder__note">
        {loading ? 'Loading categories…' : `${categories?.length ?? 0} categories seeded.`}
      </p>
    </>
  );
}

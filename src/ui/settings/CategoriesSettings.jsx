import { useState } from 'react';
import { useLiveData } from '../../db/useLiveData.js';
import { categoriesRepo } from '../../db/repositories.js';
import EmptyState from '../components/EmptyState.jsx';
import { findCategoryUsage, usageBlockMessage } from './categoryUsage.js';

const KINDS = [
  { key: 'income', label: 'Income' },
  { key: 'spending', label: 'Spending' },
];

export default function CategoriesSettings() {
  const { data: categories, loading } = useLiveData(() => categoriesRepo.getAll(), []);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState('spending');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState(null);
  // Per-category "can't delete" message keyed by id.
  const [blocked, setBlocked] = useState({});

  const add = async (e) => {
    e.preventDefault();
    setError(null);
    const name = newName.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }
    await categoriesRepo.add({ name, kind: newKind });
    setNewName('');
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditName(c.name);
  };
  const saveEdit = async (id) => {
    const name = editName.trim();
    if (name) await categoriesRepo.update(id, { name });
    setEditingId(null);
  };

  const tryDelete = async (c) => {
    const usage = await findCategoryUsage(c.id);
    const msg = usageBlockMessage(usage);
    if (msg) {
      setBlocked((b) => ({ ...b, [c.id]: msg }));
      return;
    }
    await categoriesRepo.delete(c.id);
    setBlocked((b) => {
      const next = { ...b };
      delete next[c.id];
      return next;
    });
  };

  const byKind = (kind) => (categories ?? []).filter((c) => c.kind === kind);

  return (
    <section className="settings-group">
      <h3>Categories</h3>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="cat-groups">
          {KINDS.map(({ key, label }) => {
            const list = byKind(key);
            return (
              <div key={key} className="cat-group">
                <h4>{label}</h4>
                {list.length === 0 ? (
                  <EmptyState hint={`No ${label.toLowerCase()} categories.`} />
                ) : (
                  <ul className="cat-list">
                    {list.map((c) => (
                      <li key={c.id} className="cat-item">
                        {editingId === c.id ? (
                          <>
                            <input
                              className="input input--sm"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn btn--sm btn--primary"
                              onClick={() => saveEdit(c.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn--sm"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="cat-item__name">{c.name}</span>
                            <button type="button" className="btn btn--sm" onClick={() => startEdit(c)}>
                              Rename
                            </button>
                            <button
                              type="button"
                              className="btn btn--sm btn--danger"
                              onClick={() => tryDelete(c)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {blocked[c.id] && <span className="cat-item__blocked">{blocked[c.id]}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <form className="cat-add form-row" onSubmit={add}>
        <input
          className="input"
          type="text"
          value={newName}
          placeholder="New category name"
          onChange={(e) => setNewName(e.target.value)}
        />
        <select className="input" value={newKind} onChange={(e) => setNewKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn--primary">
          Add category
        </button>
      </form>
      {error && <p className="form__error">{error}</p>}
    </section>
  );
}

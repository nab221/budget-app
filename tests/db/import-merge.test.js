import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = {
  categories: [],
  income: [],
  oneOffExpenses: [],
  categoryMappings: []
};

function resetMockState() {
  mockState.categories = [];
  mockState.income = [];
  mockState.oneOffExpenses = [];
  mockState.categoryMappings = [];
}

function upsertById(target, incomingRows) {
  for (const row of incomingRows) {
    const index = target.findIndex(existing => existing.id === row.id);
    if (index >= 0) {
      target[index] = { ...target[index], ...row };
    } else {
      target.push({ ...row });
    }
  }
}

function createBulkTable(name, key) {
  return {
    name,
    async clear() {
      mockState[key] = [];
    },
    async bulkPut(records) {
      upsertById(mockState[key], records);
    }
  };
}

const findBestMatch = vi.fn();

vi.mock('../../src/utils/string-similarity.js', () => ({
  findBestMatch
}));

vi.mock('../../src/db/schema.js', () => {
  const categoriesTable = createBulkTable('categories', 'categories');
  const incomeTable = createBulkTable('income', 'income');
  const oneOffExpensesTable = createBulkTable('oneOffExpenses', 'oneOffExpenses');
  const categoryMappingsTable = {
    name: 'categoryMappings',
    async clear() {
      mockState.categoryMappings = [];
    },
    async bulkPut(records) {
      upsertById(mockState.categoryMappings, records);
    }
  };

  return {
    db: {
      verno: 18,
      tables: [categoriesTable, incomeTable, oneOffExpensesTable, categoryMappingsTable],
      transaction: async (...args) => {
        const callback = args[args.length - 1];
        return callback();
      },
      categories: {
        async toArray() {
          return mockState.categories.map(category => ({ ...category }));
        },
        async add(category) {
          mockState.categories.push({ ...category });
          return category.id;
        },
        toCollection() {
          return {
            async modify(modifier) {
              mockState.categories = mockState.categories.map(category => {
                const clone = { ...category };
                modifier(clone);
                return clone;
              });
            }
          };
        },
        where(field) {
          return {
            equals(value) {
              return {
                async count() {
                  return mockState.categories.filter(category => category[field] === value).length;
                }
              };
            }
          };
        }
      },
      categoryMappings: {
        async put(mapping) {
          const existingIndex = mockState.categoryMappings.findIndex(existing => existing.id === mapping.id);
          if (existingIndex >= 0) {
            mockState.categoryMappings[existingIndex] = { ...mockState.categoryMappings[existingIndex], ...mapping };
          } else {
            mockState.categoryMappings.push({ ...mapping });
          }
        }
      }
    }
  };
});

const { importBackupData } = await import('../../src/db/backup.js');

describe('importBackupData merge mode', () => {
  beforeEach(() => {
    resetMockState();
    findBestMatch.mockReset();
  });

  it('remaps exact, case-insensitive, and fuzzy category IDs into local IDs', async () => {
    mockState.categories = [
      { id: 1, name: 'Salary', group: 'income' },
      { id: 2, name: 'Groceries', group: 'expenses' }
    ];

    findBestMatch.mockImplementation((incomingName, candidates) => {
      if (incomingName === 'Grocery') {
        return { target: 'groceries', rating: 0.91 };
      }
      return { target: candidates[0] ?? null, rating: 0 };
    });

    const backupData = {
      version: 1,
      schema_version: 18,
      categories: [
        { id: 100, name: 'Salary', group: 'income' },
        { id: 101, name: 'groceries', group: 'expenses' },
        { id: 102, name: 'Grocery', group: 'expenses' }
      ],
      income: [
        { id: 'income-1', date: '2026-03-01', source: 'Payroll', amount: 250000, categoryId: 100 }
      ],
      oneOffExpenses: [
        { id: 'expense-1', date: '2026-03-02', note: 'Food shop', amount: 7000, categoryId: 101 },
        { id: 'expense-2', date: '2026-03-03', note: 'Top-up', amount: 1500, categoryId: 102 }
      ]
    };

    await importBackupData(backupData, { mode: 'merge', restoreSettings: false });

    expect(mockState.income).toHaveLength(1);
    expect(mockState.income[0].categoryId).toBe(1);

    expect(mockState.oneOffExpenses).toHaveLength(2);
    expect(mockState.oneOffExpenses[0].categoryId).toBe(2);
    expect(mockState.oneOffExpenses[1].categoryId).toBe(2);

    expect(findBestMatch).toHaveBeenCalledWith('Grocery', ['Groceries']);
  });

  it('scopes fuzzy matching to incoming category group to avoid cross-group matches', async () => {
    mockState.categories = [
      { id: 10, name: 'Gift', group: 'income' },
      { id: 11, name: 'Gifts', group: 'expenses' }
    ];

    findBestMatch.mockImplementation((incomingName, candidates) => {
      if (incomingName === 'Gift') {
        const normalizedCandidates = candidates.map(candidate => candidate.toLowerCase());
        if (normalizedCandidates.includes('gifts')) {
          return { target: 'gifts', rating: 0.92 };
        }
      }
      return { target: null, rating: 0 };
    });

    const backupData = {
      version: 1,
      schema_version: 18,
      categories: [
        { id: 200, name: 'Gift', group: 'expenses' }
      ],
      oneOffExpenses: [
        { id: 'expense-3', date: '2026-03-05', note: 'Birthday', amount: 1200, categoryId: 200 }
      ]
    };

    await importBackupData(backupData, { mode: 'merge', restoreSettings: false });

    expect(findBestMatch).toHaveBeenCalledWith('Gift', ['Gifts']);
    expect(mockState.oneOffExpenses).toHaveLength(1);
    expect(mockState.oneOffExpenses[0].categoryId).toBe(11);
    expect(mockState.categories).toHaveLength(2);
  });
});

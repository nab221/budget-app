// @vitest-environment jsdom

/**
 * income-sources.test.js
 *
 * Phase 44: Income Tab Cards — Wave 0 failing test stubs.
 *
 * These tests define the contracts that Plans 02–04 must satisfy.
 * INCOME-01 and INCOME-02 FAIL until the card grid and openIncomeModal are implemented.
 * INCOME-03, INCOME-04, INCOME-05 PASS (existing confirmIncome/adjustIncome behavior verified).
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock render.js
// ---------------------------------------------------------------------------

vi.mock('./render.js', () => {
  const modalUI = {
    elements: { overlay: null, title: null, body: null, footer: null, close: null },
    init: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
  };
  return {
    modalUI,
    safeHTML: (strings, ...values) =>
      strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? String(values[i]) : ''), ''),
    sanitize: (str) => str,
  };
});

// ---------------------------------------------------------------------------
// Mock repository.js
// ---------------------------------------------------------------------------

vi.mock('../db/repository.js', () => ({
  incomeSourceRepository: {
    get: vi.fn(async () => null),
    getActive: vi.fn(async () => []),
    validateAndAdd: vi.fn(async () => 1),
    validateAndUpdate: vi.fn(async () => 1),
    delete: vi.fn(async () => 1),
  },
  incomeRepository: {
    add: vi.fn(async () => 1),
    getAll: vi.fn(async () => []),
    update: vi.fn(async () => 1),   // INCOME-08: edit confirmed entry
    delete: vi.fn(async () => {}),  // INCOME-09: unconfirm entry
  },
}));

// ---------------------------------------------------------------------------
// Mock utils
// ---------------------------------------------------------------------------

vi.mock('../utils/haptics.js', () => ({ triggerHaptic: vi.fn() }));
vi.mock('./notifications.js', () => ({
  notificationUI: { error: vi.fn(), success: vi.fn() }
}));

vi.mock('../utils/income.js', () => ({
  getUpcomingIncomeEvents: vi.fn(() => []),
}));

// ---------------------------------------------------------------------------
// Dynamic imports (after all vi.mock calls)
// ---------------------------------------------------------------------------

const { incomeSources } = await import('./income-sources.js');
const { modalUI } = await import('./render.js');
const { incomeSourceRepository, incomeRepository } = await import('../db/repository.js');

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="' + incomeSources.CONTAINER_ID + '"></div>';
});

afterEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// INCOME-01: _renderSourceCards
// ---------------------------------------------------------------------------

describe('INCOME-01: _renderSourceCards', () => {
  it('renders a .card.clickable-card div per active source inside .grid3', async () => {
    incomeSourceRepository.getActive.mockResolvedValueOnce([
      { id: 1, name: 'Salary', monthlyAmount: 300000, payDateRule: 'nth-of-month', payDateDay: 25, isActive: true }
    ]);
    await incomeSources.render();
    const container = document.getElementById(incomeSources.CONTAINER_ID);
    expect(container.querySelector('.grid3')).not.toBeNull();
    expect(container.querySelectorAll('.card.clickable-card').length).toBe(1);
  });

  it('renders empty state message when no active sources', async () => {
    incomeSourceRepository.getActive.mockResolvedValueOnce([]);
    await incomeSources.render();
    const container = document.getElementById(incomeSources.CONTAINER_ID);
    expect(container.querySelector('.grid3')).toBeNull();
    expect(container.innerHTML).toContain('No income sources configured');
  });
});

// ---------------------------------------------------------------------------
// INCOME-02: openIncomeModal
// ---------------------------------------------------------------------------

describe('INCOME-02: openIncomeModal', () => {
  it('calls modalUI.show() with title containing the source name', async () => {
    incomeSourceRepository.get.mockResolvedValueOnce(
      { id: 1, name: 'Salary', monthlyAmount: 300000, payDateRule: 'nth-of-month', payDateDay: 25 }
    );
    await incomeSources.openIncomeModal(1);
    expect(modalUI.show).toHaveBeenCalled();
    const [title] = modalUI.show.mock.calls[0];
    expect(title).toContain('Salary');
  });

  it('returns early without calling modalUI.show() when source not found', async () => {
    incomeSourceRepository.get.mockResolvedValueOnce(null);
    await incomeSources.openIncomeModal(99);
    expect(modalUI.show).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// INCOME-03: confirmIncome amount in pounds
// ---------------------------------------------------------------------------

describe('INCOME-03: confirmIncome amount in pounds', () => {
  it('calls incomeRepository.add() with amount in pounds (not pence)', async () => {
    const event = { sourceName: 'Salary', adjustedDate: '2026-03-25', amount: 300000 }; // 300000 pence = £3000
    await incomeSources.confirmIncome(event);
    expect(incomeRepository.add).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3000, date: '2026-03-25', source: 'Salary' })
    );
  });
});

// ---------------------------------------------------------------------------
// INCOME-04: date override saved correctly
// ---------------------------------------------------------------------------

describe('INCOME-04: date override saved correctly', () => {
  it('confirmIncome writes the adjustedDate as the date field', async () => {
    const event = { sourceName: 'Salary', adjustedDate: '2026-03-28', amount: 300000 };
    await incomeSources.confirmIncome(event);
    expect(incomeRepository.add).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-03-28' })
    );
  });
});

// ---------------------------------------------------------------------------
// INCOME-05: adjustIncome uses override amount
// ---------------------------------------------------------------------------

describe('INCOME-05: adjustIncome uses override amount', () => {
  it('adjustIncome passes overrideAmountPounds directly to incomeRepository.add(), not event.amount', async () => {
    const event = { sourceName: 'Salary', adjustedDate: '2026-03-25', amount: 300000 }; // 300000 pence
    const overridePounds = 2500.00; // different from event.amount/100 = 3000
    await incomeSources.adjustIncome(event, overridePounds);
    expect(incomeRepository.add).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2500.00 })
    );
  });
});

// ---------------------------------------------------------------------------
// INCOME-06: card Edit/Delete button delegation
// ---------------------------------------------------------------------------

describe('INCOME-06: card edit/delete buttons work without triggering openIncomeModal', () => {
  it('clicking edit-source button on a card calls incomeSourceRepository.get, not openIncomeModal', async () => {
    incomeSourceRepository.getActive.mockResolvedValueOnce([
      { id: 7, name: 'Bonus', monthlyAmount: 50000, payDateRule: 'nth-of-month', payDateDay: 28, isActive: true }
    ]);
    incomeSourceRepository.get.mockResolvedValueOnce(
      { id: 7, name: 'Bonus', monthlyAmount: 50000, payDateRule: 'nth-of-month', payDateDay: 28, isActive: true }
    );
    const openSpy = vi.spyOn(incomeSources, 'openIncomeModal');
    await incomeSources.render();
    const container = document.getElementById(incomeSources.CONTAINER_ID);
    const editBtn = container.querySelector('[data-action="edit-source"][data-id="7"]');
    expect(editBtn).not.toBeNull();
    editBtn.click();
    await Promise.resolve(); // flush microtasks
    expect(incomeSourceRepository.get).toHaveBeenCalledWith(7);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('clicking delete-source button on a card calls window.confirm', async () => {
    incomeSourceRepository.getActive.mockResolvedValueOnce([
      { id: 7, name: 'Bonus', monthlyAmount: 50000, payDateRule: 'nth-of-month', payDateDay: 28, isActive: true }
    ]);
    window.confirm = vi.fn(() => false); // cancel — no actual delete
    await incomeSources.render();
    const container = document.getElementById(incomeSources.CONTAINER_ID);
    const deleteBtn = container.querySelector('[data-action="delete-source"][data-id="7"]');
    expect(deleteBtn).not.toBeNull();
    deleteBtn.click();
    await Promise.resolve();
    expect(window.confirm).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// INCOME-07: confirmed entry shows amount + date
// ---------------------------------------------------------------------------

describe('INCOME-07: confirmed entry status shows saved amount and date', () => {
  it('status span for a confirmed entry contains the formatted amount', async () => {
    const { getUpcomingIncomeEvents } = await import('../utils/income.js');
    getUpcomingIncomeEvents.mockReturnValue([
      { sourceName: 'Salary', nominalDate: '2026-03-25', adjustedDate: '2026-03-25', amount: 245000 }
    ]);
    incomeSourceRepository.get.mockResolvedValue(
      { id: 1, name: 'Salary', monthlyAmount: 300000, payDateRule: 'nth-of-month', payDateDay: 25 }
    );
    incomeRepository.getAll.mockResolvedValueOnce([
      { id: 99, source: 'Salary', date: '2026-03-25', amount: 245000 }
    ]);
    // Seed DOM with status span
    document.body.innerHTML += `<span id="income-entry-status-1-2026-03-25"></span>`;
    await incomeSources._renderIncomeEntryStatuses(1);
    const span = document.getElementById('income-entry-status-1-2026-03-25');
    expect(span.innerHTML).toMatch(/2,450|£2,450/);
    expect(span.innerHTML).toMatch(/25 Mar|Mar 25|2026-03-25/);
  });
});

// ---------------------------------------------------------------------------
// INCOME-08: edit confirmed entry calls incomeRepository.update
// ---------------------------------------------------------------------------

describe('INCOME-08: editing a confirmed income entry calls incomeRepository.update', () => {
  it('window.saveEditedIncomeEntry calls incomeRepository.update with the record id', async () => {
    incomeSourceRepository.get.mockResolvedValue(
      { id: 1, name: 'Salary', monthlyAmount: 300000, payDateRule: 'nth-of-month', payDateDay: 25 }
    );
    incomeRepository.getAll.mockResolvedValueOnce([
      { id: 99, source: 'Salary', date: '2026-03-25', amount: 245000 }
    ]);
    // Set up DOM inputs that saveEditedIncomeEntry reads
    document.body.innerHTML += `
      <span id="income-entry-status-1-2026-03-25"></span>
      <input id="income-edit-date-1-99" value="2026-03-26" />
      <input id="income-edit-amount-1-99" value="2500.00" />
    `;
    incomeSources._registerGlobalHandlers();
    await window.saveEditedIncomeEntry(1, '2026-03-25', 99);
    expect(incomeRepository.update).toHaveBeenCalledWith(99, expect.objectContaining({ date: '2026-03-26' }));
  });
});

// ---------------------------------------------------------------------------
// INCOME-09: unconfirm calls incomeRepository.delete
// ---------------------------------------------------------------------------

describe('INCOME-09: unconfirming a confirmed entry calls incomeRepository.delete', () => {
  it('window.unconfirmIncomeEntry calls window.confirm then incomeRepository.delete', async () => {
    window.confirm = vi.fn(() => true);
    incomeSourceRepository.get.mockResolvedValue(
      { id: 1, name: 'Salary', monthlyAmount: 300000, payDateRule: 'nth-of-month', payDateDay: 25 }
    );
    incomeSources._registerGlobalHandlers();
    await window.unconfirmIncomeEntry(1, '2026-03-25', 99);
    expect(window.confirm).toHaveBeenCalled();
    expect(incomeRepository.delete).toHaveBeenCalledWith(99);
  });

  it('window.unconfirmIncomeEntry does NOT call incomeRepository.delete when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false);
    incomeSourceRepository.get.mockResolvedValue(
      { id: 1, name: 'Salary', monthlyAmount: 300000, payDateRule: 'nth-of-month', payDateDay: 25 }
    );
    incomeSources._registerGlobalHandlers();
    await window.unconfirmIncomeEntry(1, '2026-03-25', 99);
    expect(incomeRepository.delete).not.toHaveBeenCalled();
  });
});

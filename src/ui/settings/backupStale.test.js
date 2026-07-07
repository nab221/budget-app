import { describe, it, expect } from 'vitest';
import { isExportStale } from './BackupSettings.jsx';

describe('isExportStale', () => {
  const now = new Date('2026-07-07T12:00:00Z');

  it('is stale when never exported', () => {
    expect(isExportStale(null, now)).toBe(true);
    expect(isExportStale(undefined, now)).toBe(true);
  });

  it('is fresh within 14 days', () => {
    expect(isExportStale('2026-07-01T12:00:00Z', now)).toBe(false);
  });

  it('is stale beyond 14 days', () => {
    expect(isExportStale('2026-06-01T12:00:00Z', now)).toBe(true);
  });

  it('treats an unparseable date as stale', () => {
    expect(isExportStale('not-a-date', now)).toBe(true);
  });
});

import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { getSetting, setSetting, settings, SETTINGS_DEFAULTS } from './settings.js';

beforeEach(resetDb);

describe('settings defaults', () => {
  it('returns documented defaults when unset', async () => {
    expect(await getSetting('safetyBufferPence')).toBe(20000);
    expect(await getSetting('everydaySpendPence')).toBe(0);
    expect(await getSetting('payoffStrategy')).toBe('avalanche');
    expect(await getSetting('payoffExtraPence')).toBe(0);
    expect(await getSetting('theme')).toBe('system');
    expect(await getSetting('privacyMode')).toBe(false);
    expect(await getSetting('currentBalancePence')).toBe(null);
    expect(await getSetting('balanceAsOf')).toBe(null);
    expect(await getSetting('lastExportAt')).toBe(null);
  });

  it('exposes the defaults table', () => {
    expect(SETTINGS_DEFAULTS.safetyBufferPence).toBe(20000);
  });
});

describe('set/get round-trip', () => {
  it('persists raw values and dispatches db:mutated', async () => {
    let fired = 0;
    const handler = () => { fired += 1; };
    window.addEventListener('db:mutated', handler);
    await setSetting('theme', 'dark');
    window.removeEventListener('db:mutated', handler);
    expect(fired).toBe(1);
    expect(await getSetting('theme')).toBe('dark');
  });

  it('pence stored raw; pounds convenience bridges', async () => {
    await settings.setSafetyBufferPounds(300);
    expect(await settings.getSafetyBufferPence()).toBe(30000);
    expect(await settings.getSafetyBufferPounds()).toBeCloseTo(300, 5);

    await settings.setCurrentBalancePounds(1250.75);
    expect(await settings.getCurrentBalancePence()).toBe(125075);
    expect(await settings.getCurrentBalancePounds()).toBeCloseTo(1250.75, 5);
  });

  it('currentBalancePounds returns null while unset', async () => {
    expect(await settings.getCurrentBalancePounds()).toBe(null);
  });
});

import { useState } from 'react';
import { useLiveData } from '../../db/useLiveData.js';
import { settings, getAllSettings } from '../../db/settings.js';
import CurrencyInput, { parseCurrencyInput } from '../components/CurrencyInput.jsx';

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Safety buffer, everyday-spend allowance, theme, and privacy blur.
 * Theme + privacy are applied globally by App.jsx (which watches these same
 * settings); here we only persist the choice.
 */
export default function PreferencesSettings() {
  const { data, loading } = useLiveData(() => getAllSettings(), []);
  const [savedFlash, setSavedFlash] = useState(null);

  if (loading || !data) return <section className="settings-group"><h3>Preferences</h3><p className="muted">Loading…</p></section>;

  const flash = (msg) => {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(null), 1500);
  };

  const saveBuffer = async (pounds) => {
    await settings.setSafetyBufferPounds(pounds ?? 0);
    flash('Safety buffer saved');
  };
  const saveAllowance = async (pounds) => {
    await settings.setEverydaySpendPounds(pounds ?? 0);
    flash('Allowance saved');
  };

  return (
    <section className="settings-group">
      <h3>Preferences</h3>

      <div className="form-row">
        <div className="field">
          <label>Safety buffer</label>
          <CurrencyInput
            value={data.safetyBufferPence / 100}
            onChange={() => {}}
            onBlur={(e) => saveBuffer(parseCurrencyInput(e.target.value))}
          />
          <span className="field__hint">Minimum balance to keep before spare money is offered.</span>
        </div>

        <div className="field">
          <label>Everyday spending allowance (per month)</label>
          <CurrencyInput
            value={data.everydaySpendPence / 100}
            onChange={() => {}}
            onBlur={(e) => saveAllowance(parseCurrencyInput(e.target.value))}
          />
          <span className="field__hint">Prorated into each pay period.</span>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Theme</label>
          <select
            className="input"
            value={data.theme}
            onChange={(e) => settings.setTheme(e.target.value)}
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Privacy</label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={!!data.privacyMode}
              onChange={(e) => settings.setPrivacyMode(e.target.checked)}
            />
            Blur money values (hover to reveal)
          </label>
        </div>
      </div>

      {savedFlash && <p className="settings-flash">{savedFlash}</p>}
    </section>
  );
}

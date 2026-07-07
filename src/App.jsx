import { useEffect, useState } from 'react';
import Dashboard from './ui/Dashboard.jsx';
import MoneyInOut from './ui/MoneyInOut.jsx';
import Debts from './ui/Debts.jsx';
import Payoff from './ui/Payoff.jsx';
import Childcare from './ui/Childcare.jsx';
import Settings from './ui/Settings.jsx';
import { useLiveData } from './db/useLiveData.js';
import { settings } from './db/settings.js';
import { applyTheme, applyPrivacy } from './ui/theme.js';
import ErrorBoundary from './ui/components/ErrorBoundary.jsx';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', Component: Dashboard },
  { id: 'money', label: 'Money In & Out', Component: MoneyInOut },
  { id: 'debts', label: 'Debts', Component: Debts },
  { id: 'payoff', label: 'Payoff', Component: Payoff },
  { id: 'childcare', label: 'Childcare', Component: Childcare },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Apply theme + privacy globally, reacting live to Settings changes.
  const { data: prefs } = useLiveData(
    async () => ({
      theme: await settings.getTheme(),
      privacyMode: await settings.getPrivacyMode(),
    }),
    []
  );
  useEffect(() => {
    if (!prefs) return;
    applyTheme(prefs.theme);
    applyPrivacy(prefs.privacyMode);
  }, [prefs]);

  const active = activeTab === 'settings'
    ? { id: 'settings', label: 'Settings', Component: Settings }
    : TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const ActiveComponent = active.Component;

  return (
    <div className="app">
      <header className="topnav">
        <span className="topnav__brand">Budget App</span>
        <nav className="topnav__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`topnav__tab${activeTab === tab.id ? ' is-active' : ''}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className={`topnav__settings${activeTab === 'settings' ? ' is-active' : ''}`}
          aria-label="Settings"
          aria-current={activeTab === 'settings' ? 'page' : undefined}
          onClick={() => setActiveTab('settings')}
        >
          &#9881;
        </button>
      </header>

      <main className="container">
        <ErrorBoundary resetKey={active.id}>
          <ActiveComponent />
        </ErrorBoundary>
      </main>
    </div>
  );
}

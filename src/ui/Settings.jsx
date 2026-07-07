import CategoriesSettings from './settings/CategoriesSettings.jsx';
import PreferencesSettings from './settings/PreferencesSettings.jsx';
import BackupSettings from './settings/BackupSettings.jsx';
import DangerZone from './settings/DangerZone.jsx';

export default function Settings() {
  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Settings</h2>
      </header>
      <CategoriesSettings />
      <PreferencesSettings />
      <BackupSettings />
      <DangerZone />
    </div>
  );
}

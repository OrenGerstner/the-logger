import { useNavigation } from '@/navigation/NavigationContext';
import { useSettings } from '@/store/settingsStore';
import { handRepo } from '@/db/handRepo';
import { sessionRepo } from '@/db/sessionRepo';
import { stackSnapshotRepo } from '@/db/stackSnapshotRepo';
import { exportHandsCSV, exportSnapshotsCSV, downloadCSV } from '@/utils/csvExport';
import styles from './Settings.module.css';

export function Settings() {
  const { goBack } = useNavigation();
  const { settings, updateSettings } = useSettings();

  async function handleExportAll() {
    const sessions = await sessionRepo.getAll();
    const allHands = await Promise.all(sessions.map((s) => handRepo.getBySession(s.id)));
    const allSnapshots = await Promise.all(
      sessions.map((s) => stackSnapshotRepo.getBySession(s.id))
    );
    const hands = allHands.flat();
    const snapshots = allSnapshots.flat();
    const csv = exportHandsCSV(sessions, hands);
    downloadCSV(csv, `logger-all-sessions-${Date.now()}.csv`);
    if (snapshots.length > 0) {
      const snapCsv = exportSnapshotsCSV(snapshots);
      downloadCSV(snapCsv, `logger-snapshots-${Date.now()}.csv`);
    }
  }

  function Toggle({ on, onToggle }: { on: boolean; onToggle(): void }) {
    return (
      <div className={`toggle ${on ? 'on' : ''}`} onClick={onToggle}>
        <div className="toggle-knob" />
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="bar">
        <button className={styles.back} onClick={goBack}>← Back</button>
        <span>Settings</span>
        <span />
      </div>

      <div className="label">Theme</div>
      <div className="btn-row">
        <button
          className={`btn ${settings.theme === 'dark' ? 'info' : ''}`}
          onClick={() => updateSettings({ theme: 'dark' })}
        >Dark</button>
        <button
          className={`btn ${settings.theme === 'light' ? 'info' : ''}`}
          onClick={() => updateSettings({ theme: 'light' })}
        >Light</button>
      </div>

      <div className="label">Show recommendation</div>
      <div className="btn-row">
        <button
          className={`btn ${settings.showRecommendation === 'before' ? 'info' : ''}`}
          onClick={() => updateSettings({ showRecommendation: 'before' })}
        >Before I act</button>
        <button
          className={`btn ${settings.showRecommendation === 'after' ? 'info' : ''}`}
          onClick={() => updateSettings({ showRecommendation: 'after' })}
        >After I act</button>
      </div>

      <div className={styles.rows}>
        <div className="row">
          <span className={styles.settingLabel}>
            Preflop focus mode
            <span className="label"> skip postflop screens</span>
          </span>
          <Toggle
            on={settings.preflopFocusMode}
            onToggle={() => updateSettings({ preflopFocusMode: !settings.preflopFocusMode })}
          />
        </div>
        <div className="row">
          <span className={styles.settingLabel}>
            Focus on RFI only
            <span className="label"> hide rec for other scenarios</span>
          </span>
          <Toggle
            on={settings.focusRFI}
            onToggle={() => updateSettings({ focusRFI: !settings.focusRFI })}
          />
        </div>
        <div className="row">
          <span className={styles.settingLabel}>
            Show chart after I fold
            <span className="label"> preflop only</span>
          </span>
          <Toggle
            on={settings.showChartAfterFold}
            onToggle={() => updateSettings({ showChartAfterFold: !settings.showChartAfterFold })}
          />
        </div>
        <div className="row">
          <span className={styles.settingLabel}>Hide hole cards postflop</span>
          <Toggle
            on={settings.hideHoleCardsPostflop}
            onToggle={() => updateSettings({ hideHoleCardsPostflop: !settings.hideHoleCardsPostflop })}
          />
        </div>
        <div className="row">
          <span className={styles.settingLabel}>Flag chart deviations</span>
          <Toggle
            on={settings.flagDeviations}
            onToggle={() => updateSettings({ flagDeviations: !settings.flagDeviations })}
          />
        </div>
        <div className="row">
          <span className={styles.settingLabel}>Currency</span>
          <span className="label">{settings.currency} USD</span>
        </div>
        <div className="row">
          <span className={styles.settingLabel}>Default table size</span>
          <span className="label">{settings.defaultTableSize}-handed</span>
        </div>
      </div>

      <div className="note" style={{ marginTop: 4, fontSize: 10 }}>
        Clearing site data in your browser deletes all session data.
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button className="btn" onClick={handleExportAll}>↓ Export all data (CSV)</button>
      </div>
    </div>
  );
}

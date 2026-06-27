import { useState } from 'react';
import { useNavigation } from '@/navigation/NavigationContext';
import { useSession } from '@/store/SessionContext';
import { useSettings } from '@/store/settingsStore';
import { useTableState } from '@/store/tableStateStore';
import type { Stakes } from '@/domain/types';
import styles from './NewSession.module.css';

const PRESET_STAKES: { label: string; stakes: Stakes }[] = [
  { label: '$1 / $2', stakes: { smallBlind: 1, bigBlind: 2 } },
  { label: '$1 / $3', stakes: { smallBlind: 1, bigBlind: 3 } },
  { label: '$2 / $5', stakes: { smallBlind: 2, bigBlind: 5 } },
  { label: '$5 / $10', stakes: { smallBlind: 5, bigBlind: 10 } },
];

export function NewSession() {
  const { navigate } = useNavigation();
  const { createSession } = useSession();
  const { settings } = useSettings();
  const { initForSession } = useTableState();

  const [venue, setVenue] = useState('');
  const [stakes, setStakes] = useState<Stakes>(PRESET_STAKES[0].stakes);
  const [customStakes, setCustomStakes] = useState(false);
  const [customSB, setCustomSB] = useState('');
  const [customBB, setCustomBB] = useState('');
  const [tableSize, setTableSize] = useState<6 | 8 | 9>(settings.defaultTableSize);
  const [buyIn, setBuyIn] = useState('');

  async function handleStart() {
    const finalStakes = customStakes
      ? { smallBlind: parseFloat(customSB) || 0, bigBlind: parseFloat(customBB) || 0 }
      : stakes;

    const buyInAmount = parseFloat(buyIn) || null;
    const now = new Date().toISOString();

    await createSession({
      createdAt: now,
      gameType: 'cash',
      venue: venue || undefined,
      stakes: finalStakes,
      currency: settings.currency,
      startingTableSize: tableSize,
      buyIns: buyInAmount ? [{ amount: buyInAmount, at: now }] : [],
      startingStack: buyInAmount,
      cashOut: null,
      timerStartedAt: now,
    });

    initForSession(tableSize);
    navigate({ name: 'tableSetup' });
  }

  return (
    <div className="screen">
      <div className="bar">
        <span>New session</span>
      </div>

      <div className="label">Game type</div>
      <div className="btn-row">
        <button className="btn info">Cash</button>
        <button className="btn" style={{ opacity: 0.5 }} disabled>Tournament</button>
      </div>

      <div className="label">Venue</div>
      <input
        className="field"
        placeholder="Casino name (optional)"
        value={venue}
        onChange={(e) => setVenue(e.target.value)}
      />

      <div className="label">Stakes</div>
      <div className={styles.stakesList}>
        {PRESET_STAKES.map((p) => (
          <button
            key={p.label}
            className={`chip ${!customStakes && stakes === p.stakes ? 'selected' : ''}`}
            onClick={() => { setStakes(p.stakes); setCustomStakes(false); }}
          >
            {p.label}
          </button>
        ))}
        <button
          className={`chip ${customStakes ? 'selected' : ''}`}
          onClick={() => setCustomStakes(true)}
        >Custom</button>
      </div>
      {customStakes && (
        <div className={styles.customStakes}>
          <input className="field" placeholder="SB" value={customSB} onChange={(e) => setCustomSB(e.target.value)} type="number" inputMode="decimal" />
          <span className={styles.slash}>/</span>
          <input className="field" placeholder="BB" value={customBB} onChange={(e) => setCustomBB(e.target.value)} type="number" inputMode="decimal" />
        </div>
      )}

      <div className="label">Table size</div>
      <div className="btn-row">
        {([6, 8, 9] as const).map((n) => (
          <button
            key={n}
            className={`btn ${tableSize === n ? 'info' : ''}`}
            onClick={() => setTableSize(n)}
          >
            {n === 6 ? '6-max' : n === 8 ? '8' : '9'}
          </button>
        ))}
      </div>

      <div className="label">Buy-in (optional)</div>
      <input
        className="field"
        placeholder={`${settings.currency}0`}
        value={buyIn}
        onChange={(e) => setBuyIn(e.target.value)}
        type="number"
        inputMode="decimal"
      />

      <div style={{ marginTop: 'auto' }}>
        <button className="btn go" onClick={handleStart}>▶ Start session</button>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { useNavigation } from '@/navigation/NavigationContext';
import { getMaxLevel } from '@/domain/tournamentStructure';
import { getTemplates, saveTemplate, deleteTemplate } from '@/store/tournamentTemplates';
import { setPendingStructure } from '@/store/pendingStructure';
import { getAnthropicKey } from '@/store/anthropicKeyStore';
import { parsePdfFile } from '@/utils/pdfStructureParser';
import { parseImageWithAI } from '@/utils/aiStructureParser';
import type { TournamentStructure, TournamentLevelRow } from '@/domain/types';
import styles from './StructureEditor.module.css';

type LevelRow = { id: string; level: string; sb: string; bb: string; ante: string; minutes: string };

let _uid = 0;
function freshRow(level = ''): LevelRow {
  return { id: String(_uid++), level, sb: '', bb: '', ante: '0', minutes: '' };
}

function rowsToStructure(name: string, rows: LevelRow[]): TournamentStructure {
  const levelRows: TournamentLevelRow[] = rows
    .filter((r) => r.sb && r.bb)
    .map((r, i) => ({
      kind: 'level' as const,
      level: parseInt(r.level) || i + 1,
      sb: parseInt(r.sb.replace(/,/g, '')) || 0,
      bb: parseInt(r.bb.replace(/,/g, '')) || 0,
      ante: parseInt(r.ante.replace(/,/g, '')) || 0,
      ...(r.minutes ? { minutes: parseInt(r.minutes) } : {}),
    }));
  return { name: name.trim() || 'Tournament', rows: levelRows };
}

export function StructureEditor() {
  const { goBack, navigate } = useNavigation();
  const [name, setName] = useState('');
  const [rows, setRows] = useState<LevelRow[]>([freshRow('1')]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [templates, setTemplates] = useState(getTemplates);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const hasValidRows = rows.some((r) => r.sb && r.bb);

  function applyParsed(parsed: LevelRow[], structureName?: string) {
    if (parsed.length === 0) {
      setStatus('err');
      setStatusMsg('No levels found. Check the file or enter levels manually below.');
      return;
    }
    setRows(parsed);
    if (structureName) setName(structureName);
    setStatus('ok');
    setStatusMsg(`Found ${parsed.length} levels. Review below and tap "Use this structure" when ready.`);
  }

  async function handlePdfUpload(file: File) {
    setStatus('loading');
    setStatusMsg('Reading PDF…');
    try {
      const parsed = await parsePdfFile(file);
      applyParsed(parsed);
    } catch (e) {
      setStatus('err');
      setStatusMsg(e instanceof Error ? e.message : 'Could not read PDF. Try uploading a photo instead.');
    }
  }

  async function handleImageUpload(file: File) {
    const apiKey = getAnthropicKey();
    if (!apiKey) {
      setStatus('err');
      setStatusMsg('No API key set. Add your Anthropic API key in Settings to use AI photo parsing.');
      return;
    }
    setStatus('loading');
    setStatusMsg('Analyzing image with AI…');
    try {
      const parsed = await parseImageWithAI(file, apiKey);
      applyParsed(parsed);
    } catch (e) {
      setStatus('err');
      setStatusMsg(e instanceof Error ? e.message : 'AI parsing failed. Enter levels manually below.');
    }
  }

  function updateRow(id: string, field: keyof LevelRow, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    const lastLevel = rows.length > 0 ? parseInt(rows[rows.length - 1].level) || 0 : 0;
    setRows((prev) => [...prev, freshRow(String(lastLevel + 1))]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function handleUseStructure() {
    const structure = rowsToStructure(name, rows);
    setPendingStructure(structure);
    goBack();
  }

  function handleSaveTemplate() {
    const structure = rowsToStructure(name, rows);
    saveTemplate(structure.name, structure);
    setTemplates(getTemplates());
    setStatus('ok');
    setStatusMsg('Template saved.');
  }

  function handleUseTemplate(structure: TournamentStructure) {
    setPendingStructure(structure);
    goBack();
  }

  function handleDeleteTemplate(id: string) {
    deleteTemplate(id);
    setTemplates(getTemplates());
  }

  const hasApiKey = !!getAnthropicKey();

  return (
    <div className="screen">
      <div className="bar">
        <button className={styles.back} onClick={goBack}>← Back</button>
        <span>Tournament structure</span>
        <span />
      </div>

      {templates.length > 0 && (
        <>
          <div className="label">Saved templates</div>
          <div className={styles.templateList}>
            {templates.map((t) => (
              <div key={t.id} className={styles.templateRow}>
                <button className={styles.templateName} onClick={() => handleUseTemplate(t.structure)}>
                  {t.name}
                  <span className="label"> · {getMaxLevel(t.structure)} levels</span>
                </button>
                <button className={styles.deleteBtn} onClick={() => handleDeleteTemplate(t.id)}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="label">Import from file</div>
      <div className={styles.importRow}>
        <button className="btn" onClick={() => pdfInputRef.current?.click()}>
          📄 Upload PDF
        </button>
        <button
          className="btn"
          onClick={() => {
            if (!hasApiKey) {
              setStatus('err');
              setStatusMsg('Add your Anthropic API key in Settings to enable AI photo parsing.');
            } else {
              imgInputRef.current?.click();
            }
          }}
        >
          📷 Use photo
        </button>
        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.target.value = ''; }}
        />
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }}
        />
      </div>

      {!hasApiKey && (
        <div className="note" style={{ marginBottom: 6 }}>
          Photo parsing uses Claude AI.{' '}
          <button className={styles.linkBtn} onClick={() => navigate({ name: 'settings' })}>
            Add API key in Settings
          </button>{' '}
          to enable it.
        </div>
      )}

      {status !== 'idle' && (
        <div className={status === 'err' ? styles.statusErr : status === 'ok' ? styles.statusOk : styles.statusInfo}>
          {status === 'loading' && <span className={styles.spinner}>⏳ </span>}
          {statusMsg}
        </div>
      )}

      <div className="label" style={{ marginTop: 8 }}>Structure name</div>
      <input
        className="field"
        placeholder="e.g. WSOP Event 86"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="label">Levels</div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Lvl</th>
              <th className={styles.th}>SB</th>
              <th className={styles.th}>BB</th>
              <th className={styles.th}>Ante</th>
              <th className={styles.th}>Min</th>
              <th className={styles.th} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={styles.td}>
                  <input className={styles.cell} value={row.level} onChange={(e) => updateRow(row.id, 'level', e.target.value)} inputMode="numeric" />
                </td>
                <td className={styles.td}>
                  <input className={styles.cell} value={row.sb} onChange={(e) => updateRow(row.id, 'sb', e.target.value)} inputMode="numeric" placeholder="0" />
                </td>
                <td className={styles.td}>
                  <input className={styles.cell} value={row.bb} onChange={(e) => updateRow(row.id, 'bb', e.target.value)} inputMode="numeric" placeholder="0" />
                </td>
                <td className={styles.td}>
                  <input className={styles.cell} value={row.ante} onChange={(e) => updateRow(row.id, 'ante', e.target.value)} inputMode="numeric" placeholder="0" />
                </td>
                <td className={styles.td}>
                  <input className={styles.cell} value={row.minutes} onChange={(e) => updateRow(row.id, 'minutes', e.target.value)} inputMode="numeric" placeholder="—" />
                </td>
                <td className={styles.td}>
                  <button className={styles.removeBtn} onClick={() => removeRow(row.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className={styles.addRow} onClick={addRow}>+ Add level</button>

      <div style={{ marginTop: 'auto' }}>
        <button className="btn go" onClick={handleUseStructure} disabled={!hasValidRows}>
          ✓ Use this structure
        </button>
        <button className="btn" onClick={handleSaveTemplate} disabled={!hasValidRows}>
          Save as template
        </button>
      </div>
    </div>
  );
}

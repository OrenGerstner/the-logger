import { useState } from 'react';
import { useNavigation } from '@/navigation/NavigationContext';
import { parseStructureJSON, getLevelRow, getMaxLevel } from '@/domain/tournamentStructure';
import { getTemplates, saveTemplate, deleteTemplate } from '@/store/tournamentTemplates';
import { setPendingStructure } from '@/store/pendingStructure';
import type { TournamentStructure } from '@/domain/types';
import styles from './StructureEditor.module.css';

export function StructureEditor() {
  const { goBack } = useNavigation();
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<TournamentStructure | null>(null);
  const [parseError, setParseError] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState(getTemplates);

  function handleParse() {
    setParseError('');
    try {
      const s = parseStructureJSON(pasteText.trim());
      setParsed(s);
      setTemplateName(s.name ?? '');
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON');
      setParsed(null);
    }
  }

  function handleUseStructure(structure: TournamentStructure) {
    setPendingStructure(structure);
    goBack();
  }

  function handleSaveTemplate() {
    if (!parsed) return;
    const name = templateName.trim() || parsed.name || 'Unnamed';
    saveTemplate(name, parsed);
    setTemplates(getTemplates());
    setPasteText('');
    setParsed(null);
  }

  function handleDeleteTemplate(id: string) {
    deleteTemplate(id);
    setTemplates(getTemplates());
  }

  const maxLevel = parsed ? getMaxLevel(parsed) : 0;
  const level1 = parsed ? getLevelRow(parsed, 1) : null;

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
                <button className={styles.templateName} onClick={() => handleUseStructure(t.structure)}>
                  {t.name}
                  <span className="label"> · {getMaxLevel(t.structure)} levels</span>
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDeleteTemplate(t.id)}
                  title="Delete template"
                >✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="label">Paste structure JSON</div>
      <div className="note" style={{ marginBottom: 6 }}>
        Paste a normalized structure (JSON) — e.g. from an AI-assisted prep. The WSOP example format works.
      </div>
      <textarea
        className={styles.textarea}
        placeholder={'{\n  "name": "My Tournament",\n  "rows": [\n    { "kind": "level", "level": 1, "sb": 100, "bb": 200, "ante": 200 },\n    ...\n  ]\n}'}
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        rows={8}
      />
      {parseError && <div className={styles.error}>{parseError}</div>}
      <button className="btn info" onClick={handleParse} disabled={!pasteText.trim()}>
        Parse structure
      </button>

      {parsed && (
        <div className={styles.parsedCard}>
          <div className={styles.parsedName}>{parsed.name || 'Unnamed'}</div>
          {parsed.venue && <div className="label">{parsed.venue}</div>}
          <div className="label">
            {maxLevel} levels
            {level1 && ` · starts ${level1.sb.toLocaleString()}/${level1.bb.toLocaleString()}`}
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn go" onClick={() => handleUseStructure(parsed)}>
              ✓ Use this structure
            </button>
          </div>
          <div className={styles.saveName}>
            <input
              className="field"
              placeholder="Template name (to save for reuse)"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <button className="btn" onClick={handleSaveTemplate}>Save template</button>
          </div>
        </div>
      )}
    </div>
  );
}

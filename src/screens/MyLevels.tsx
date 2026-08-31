/**
 * My Levels — custom levels stored in localStorage.
 * Play / edit / duplicate / delete / export-import.
 */
import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { LevelData } from '../game/engine/types';
import { BackHeader, GameButton } from '../components/ui';

function download(level: LevelData) {
  const blob = new Blob([JSON.stringify(level, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${level.id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function MyLevels() {
  const navigate = useGameStore((s) => s.navigate);
  const customLevels = useGameStore((s) => s.customLevels);
  const addCustomLevel = useGameStore((s) => s.addCustomLevel);
  const removeCustomLevel = useGameStore((s) => s.removeCustomLevel);
  const selectLevel = useGameStore((s) => s.selectLevel);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const entries = Object.values(customLevels).sort((a, b) => a.name.localeCompare(b.name));

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as LevelData;
        if (!data.id || !Array.isArray(data.map)) throw new Error('bad format');
        addCustomLevel(data);
        setImportMsg(`Imported "${data.name}"`);
      } catch {
        setImportMsg('Import failed: not a valid level file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="screen">
      <BackHeader title="My Levels" onBack={() => navigate('menu')} />
      <div className="mylevels-bar">
        <GameButton onClick={() => navigate('editor')}>+ New Level</GameButton>
        <label className="file-import">
          <input type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          📂 Import JSON
        </label>
        {importMsg && <span className="import-msg">{importMsg}</span>}
      </div>
      {entries.length === 0 ? (
        <p className="empty-note">No custom levels yet. Build one in the Editor!</p>
      ) : (
        <div className="level-grid custom">
          {entries.map((l) => (
            <div className="level-card custom-card" key={l.id}>
              <div className="custom-info">
                <span className="level-name">{l.name}</span>
                <small>{l.map[0].length}×{l.map.length}</small>
              </div>
              <div className="custom-actions">
                <button aria-label={`Play ${l.name}`} onClick={() => selectLevel(l.id)}>▶</button>
                <button aria-label={`Edit ${l.name}`} onClick={() => { useGameStore.setState({ activeLevelId: l.id }); navigate('editor'); }}>✎</button>
                <button aria-label={`Duplicate ${l.name}`} onClick={() => addCustomLevel({ ...l, id: `${l.id}-copy-${Date.now()}`, name: `${l.name} (copy)` })}>⧉</button>
                <button aria-label={`Export ${l.name}`} onClick={() => download(l)}>⇩</button>
                <button aria-label={`Delete ${l.name}`} className="danger" onClick={() => removeCustomLevel(l.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

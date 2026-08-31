/**
 * In-game level editor — paint tiles, resize, configure, test, save,
 * export/import JSON. Fully offline; levels live in localStorage.
 */
import { useMemo, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { LevelData } from '../game/engine/types';
import { buildState } from '../game/engine/level';
import { TILE_LEGEND } from '../game/levels';
import { BackHeader, GameButton } from '../components/ui';

const PALETTE = ['#', '.', 'P', 'G', 'g', 'W', 'F', '^', 'Z', 'D', 'O', 'T', 'X', 'J', 'K', 'B', 'H', 'E', 'L', 'M'];

function blank(w: number, h: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : '.';
    rows.push(row);
  }
  return rows;
}

export function EditorScreen() {
  const navigate = useGameStore((s) => s.navigate);
  const activeLevelId = useGameStore((s) => s.activeLevelId);
  const customLevels = useGameStore((s) => s.customLevels);
  const addCustomLevel = useGameStore((s) => s.addCustomLevel);
  const selectLevel = useGameStore((s) => s.selectLevel);

  const existing = customLevels[activeLevelId];
  const [name, setName] = useState(existing?.name ?? 'My Level');
  const [w, setW] = useState(existing?.map[0].length ?? 12);
  const [h, setH] = useState(existing?.map.length ?? 8);
  const [grid, setGrid] = useState<string[]>(existing?.map ?? blank(12, 8));
  const [brush, setBrush] = useState('#');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dragging = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);

  const changeSize = (nw: number, nh: number) => {
    setW(nw);
    setH(nh);
    setGrid((g) => {
      const out: string[] = [];
      for (let y = 0; y < nh; y++) {
        let row = '';
        for (let x = 0; x < nw; x++) {
          row += y >= g.length || x >= g[y].length ? (x === 0 || y === 0 || x === nw - 1 || y === nh - 1 ? '#' : '.') : g[y][x];
        }
        out.push(row);
      }
      return out;
    });
  };

  const paint = (x: number, y: number) => {
    setGrid((g) => {
      const next = [...g];
      const chars = next[y].split('');
      chars[x] = brush;
      next[y] = chars.join('');
      return next;
    });
  };

  const levelData = useMemo<LevelData>(() => ({
    id: existing?.id ?? `custom-${Date.now()}`,
    world: 7,
    index: 1,
    name,
    map: grid,
    mechanics: ['custom'],
    par: 30,
  }), [existing, name, grid]);

  const validate = (data: LevelData): string | null => {
    try {
      buildState(data);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  };

  const withPar = (d: LevelData): LevelData => ({ ...d, par: d.par ?? 30 });

  const test = () => {
    const err = validate(levelData);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    addCustomLevel(withPar(levelData));
    selectLevel(levelData.id);
  };

  const save = () => {
    const err = validate(levelData);
    if (err) {
      setError(err);
      return;
    }
    addCustomLevel(withPar(levelData));
    setToast('Saved to My Levels ✔');
    window.setTimeout(() => setToast(null), 2500);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(levelData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${levelData.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as LevelData;
        if (!Array.isArray(data.map) || !data.map.length) throw new Error('bad');
        setName(data.name ?? 'Imported');
        setW(data.map[0].length);
        setH(data.map.length);
        setGrid(data.map);
        setError(null);
      } catch {
        setError('Import failed: not a valid level file');
      }
    };
    reader.readAsText(file);
  };

  const show = (ch: string) => TILE_LEGEND[ch]?.ch ?? ch;

  return (
    <div className="screen editor-screen">
      <BackHeader
        title="Level Editor"
        onBack={() => navigate('mylevels')}
        right={
          <div className="editor-top-actions">
            <GameButton variant="secondary" onClick={save}>💾 Save</GameButton>
            <GameButton onClick={test}>▶ Test</GameButton>
          </div>
        }
      />
      <div className="editor-layout">
        <aside className="editor-palette">
          <h3>Brush</h3>
          <div className="palette-grid">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={`palette-btn ${brush === c ? 'active' : ''}`}
                title={`${TILE_LEGEND[c]?.name ?? c} (${c})`}
                onClick={() => setBrush(c)}
              >
                {show(c)}
              </button>
            ))}
          </div>
          <div className="editor-config">
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            </label>
            <label>
              Width
              <input type="number" min={5} max={40} value={w} onChange={(e) => changeSize(Math.max(5, Math.min(40, Number(e.target.value))), h)} />
            </label>
            <label>
              Height
              <input type="number" min={4} max={30} value={h} onChange={(e) => changeSize(w, Math.max(4, Math.min(30, Number(e.target.value))))} />
            </label>
          </div>
          <div className="editor-io">
            <GameButton variant="ghost" onClick={exportJson}>⇩ Export JSON</GameButton>
            <GameButton variant="ghost" onClick={() => importRef.current?.click()}>⇧ Import JSON</GameButton>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
            />
          </div>
          {error && <p className="editor-error">⚠ {error}</p>}
          {toast && <p className="editor-toast">{toast}</p>}
        </aside>

        <div
          className="editor-canvas-wrap"
          onPointerDown={(e) => {
            dragging.current = true;
            const r = (e.target as HTMLElement).getBoundingClientRect();
            const x = Math.floor((e.clientX - r.left) / (r.width / w));
            const y = Math.floor((e.clientY - r.top) / (r.height / h));
            if (x >= 0 && y >= 0 && x < w && y < h) paint(x, y);
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return;
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = Math.floor((e.clientX - r.left) / (r.width / w));
            const y = Math.floor((e.clientY - r.top) / (r.height / h));
            if (x >= 0 && y >= 0 && x < w && y < h) paint(x, y);
          }}
          onPointerUp={() => { dragging.current = false; }}
          onPointerLeave={() => { dragging.current = false; }}
        >
          <div
            className="editor-grid"
            style={{ gridTemplateColumns: `repeat(${w}, 1fr)` }}
          >
            {grid.flatMap((row, y) =>
              row.split('').map((c, x) => (
                <div
                  key={`${x}-${y}`}
                  className={`editor-cell tile-${c === '#' ? 'wall' : c === '.' ? 'empty' : c}`}
                  style={{ '--tile-color': TILE_LEGEND[c]?.color ?? '#3a2f56' } as React.CSSProperties}
                  title={`${x},${y}`}
                >
                  {c === '.' ? '' : show(c)}
                </div>
              )),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Level select — grid of levels for the selected world (first world by default).
 */
import { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { WORLDS, levelsForWorld } from '../game/levels';
import { BackHeader, StarRow, clickSfx } from '../components/ui';

export function LevelSelect() {
  const navigate = useGameStore((s) => s.navigate);
  const selectLevel = useGameStore((s) => s.selectLevel);
  const selectedWorld = useGameStore((s) => s.selectedWorld);
  const unlocked = useGameStore((s) => s.unlockedWorlds);
  const progress = useGameStore((s) => s.progress);
  const [world, setWorld] = useState(selectedWorld);

  const levels = useMemo(() => levelsForWorld(world), [world]);
  const meta = WORLDS.find((w) => w.id === world)!;
  const lockedWorld = !unlocked.includes(world);

  return (
    <div className="screen">
      <BackHeader
        title={meta.name}
        onBack={() => navigate('worlds')}
        right={
          <div className="world-tabs" role="tablist" aria-label="Worlds">
            {WORLDS.map((w) => (
              <button
                key={w.id}
                role="tab"
                aria-selected={w.id === world}
                className={`world-tab ${w.id === world ? 'active' : ''} ${!unlocked.includes(w.id) ? 'locked' : ''}`}
                title={`${w.name}${unlocked.includes(w.id) ? '' : ' (locked)'}`}
                onClick={() => {
                  if (unlocked.includes(w.id)) {
                    clickSfx();
                    setWorld(w.id);
                  }
                }}
              >
                {unlocked.includes(w.id) ? w.icon : '🔒'}
              </button>
            ))}
          </div>
        }
      />
      <p className="screen-subtitle">{meta.tagline}</p>
      {lockedWorld ? (
        <p className="locked-note">Complete the previous world to unlock this one.</p>
      ) : (
        <div className="level-grid">
          {levels.map((l) => {
            const p = progress[l.id];
            const unlockedLevel = !p?.completed && l.index > 1 ? !!progress[levels[l.index - 2]?.id]?.completed : true;
            const locked = !unlockedLevel && !p?.completed;
            return (
              <button
                key={l.id}
                className={`level-card ${locked ? 'locked' : ''} ${p?.completed ? 'done' : ''}`}
                disabled={locked}
                aria-label={`Level ${l.index}: ${l.name}${p ? `, ${p.stars} stars` : ''}`}
                onClick={() => selectLevel(l.id)}
              >
                <span className="level-num">{l.index}</span>
                <span className="level-name">{l.name}</span>
                <StarRow count={p?.stars ?? 0} size={13} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

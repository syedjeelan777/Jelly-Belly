/**
 * World select — 6 handcrafted worlds with progress + locks.
 */
import { useGameStore, worldProgressCount } from '../store/gameStore';
import { WORLDS } from '../game/levels';
import { BackHeader, GameButton } from '../components/ui';

export function WorldSelect() {
  const navigate = useGameStore((s) => s.navigate);
  const selectWorld = useGameStore((s) => s.selectWorld);
  const unlocked = useGameStore((s) => s.unlockedWorlds);
  const progress = useGameStore((s) => s.progress);

  const allDone = Object.values(progress).filter((p) => p.completed).length;

  return (
    <div className="screen">
      <BackHeader title="Choose a World" onBack={() => navigate('menu')} />
      <div className="world-grid">
        {WORLDS.map((w) => {
          const locked = !unlocked.includes(w.id);
          const stat = worldProgressCount(w.id);
          return (
            <button
              key={w.id}
              className={`world-card ${locked ? 'locked' : ''}`}
              disabled={locked}
              onClick={() => selectWorld(w.id)}
              style={{ '--accent': w.accent } as React.CSSProperties}
            >
              <div className="world-icon">{locked ? '🔒' : w.icon}</div>
              <h2>{w.name}</h2>
              <p className="world-tag">{w.tagline}</p>
              <div className="world-progress">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${(stat.done / stat.total) * 100}%` }} />
                </div>
                <span>{stat.done}/{stat.total}</span>
              </div>
              {stat.completed && <span className="world-complete">✓ COMPLETED</span>}
            </button>
          );
        })}
      </div>
      {allDone > 0 && (
        <div className="world-total">
          <GameButton variant="secondary" onClick={() => navigate('stats')}>📊 Statistics</GameButton>
        </div>
      )}
    </div>
  );
}

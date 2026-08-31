/**
 * Statistics screen.
 */
import { useGameStore, totalStats } from '../store/gameStore';
import { WORLDS } from '../game/levels';
import { BackHeader, StarRow } from '../components/ui';

export function Stats() {
  const navigate = useGameStore((s) => s.navigate);
  const stats = useGameStore((s) => s.statistics);
  const progress = useGameStore((s) => s.progress);
  const worlds = useGameStore((s) => s.worlds);
  const t = totalStats();

  const fmtTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="screen">
      <BackHeader title="Statistics" onBack={() => navigate('menu')} />
      <div className="stats-grid">
        <div className="stat-card"><span>Levels completed</span><b>{t.completed}/{t.total}</b></div>
        <div className="stat-card"><span>Stars earned</span><b>{t.stars}/{t.maxStars}</b></div>
        <div className="stat-card"><span>Total moves</span><b>{stats.totalMoves.toLocaleString()}</b></div>
        <div className="stat-card"><span>Play time</span><b>{fmtTime(stats.totalPlaySeconds)}</b></div>
        <div className="stat-card"><span>Games started</span><b>{stats.gamesStarted}</b></div>
        <div className="stat-card"><span>Jellies squished</span><b>{stats.jellyDestroyed}</b></div>
      </div>
      <section className="stats-section">
        <h2>Worlds</h2>
        <ul className="world-stats">
          {WORLDS.map((w) => {
            const list = Array.from({ length: 10 }, (_, i) => progress[`w${w.id}-${String(i + 1).padStart(2, '0')}`]).filter(Boolean);
            const stars = list.reduce((a, p) => a + p!.stars, 0);
            return (
              <li key={w.id} style={{ '--accent': w.accent } as React.CSSProperties}>
                <span className="world-stats-icon">{w.icon}</span>
                <span className="world-stats-name">{w.name}</span>
                <StarRow count={Math.min(3, Math.round(stars / Math.max(1, list.length)))} size={15} />
                <span className="world-stats-count">{list.length}/10 {worlds[w.id]?.completed ? '✓' : ''}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

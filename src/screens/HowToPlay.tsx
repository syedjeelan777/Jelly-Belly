/**
 * How to play — concise interactive-style guide with icons.
 */
import { useGameStore } from '../store/gameStore';
import { BackHeader, GameButton } from '../components/ui';

const RULES = [
  { icon: '👣', title: 'Move', text: 'WASD or arrow keys. Walk into jellies to push them.' },
  { icon: '🩷', title: 'Sticky jellies', text: 'Pink jellies follow behind you when you walk away. Pull them around!', color: '#ff7b9c' },
  { icon: '🟡', title: 'Bouncy jellies', text: 'They hop two cells when pushed. Give them a landing spot.', color: '#ffd166' },
  { icon: '🟣', title: 'Heavy jellies', text: 'Steady, fireproof, and perfect for holding pressure plates.', color: '#b9a7ff' },
  { icon: '🟢', title: 'Elastic jellies', text: 'They stretch when you pull them — but refuse to stretch through walls.', color: '#7dffb2' },
  { icon: '🔵', title: 'Slippery jellies', text: 'They slide far when pushed. Use walls and water to stop them.', color: '#b0e7ff' },
  { icon: '🩷', title: 'Magnetic jellies', text: 'Magnets pin them in place. Sometimes that is helpful, sometimes not.', color: '#ff9de2' },
  { icon: '🟩', title: 'Goals', text: 'Reach the exit, or fill the glowing pads with jellies. Sometimes both!', color: '#7dffb2' },
  { icon: '🚪', title: 'Doors & switches', text: 'Plates open doors while something stands on them. Toggles latch doors open.' },
  { icon: '🔥', title: 'Hazards', text: 'Fire, spikes, lasers and crushers destroy jellies — and you. Time your moves!' },
];

export function HowToPlay() {
  const navigate = useGameStore((s) => s.navigate);
  return (
    <div className="screen">
      <BackHeader title="How To Play" onBack={() => navigate('menu')} />
      <div className="rules-grid">
        {RULES.map((r) => (
          <div className="rule-card" key={r.title} style={{ '--accent': r.color ?? '#7fd4ff' } as React.CSSProperties}>
            <div className="rule-icon">{r.icon}</div>
            <div>
              <h3>{r.title}</h3>
              <p>{r.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="howto-cta">
        <GameButton onClick={() => navigate('worlds')}>▶ Play now</GameButton>
      </div>
    </div>
  );
}

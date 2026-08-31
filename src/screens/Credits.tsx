/**
 * Credits.
 */
import { useGameStore } from '../store/gameStore';
import { BackHeader } from '../components/ui';

export function Credits() {
  const navigate = useGameStore((s) => s.navigate);
  return (
    <div className="screen">
      <BackHeader title="Credits" onBack={() => navigate('menu')} />
      <div className="credits-wrap">
        <div className="credits-blob" aria-hidden="true">◕‿◕</div>
        <h2>STICKYVERSE</h2>
        <p className="credits-sub">A sticky, squishy puzzle adventure</p>
        <div className="credits-block">
          <h3>Design & Code</h3>
          <p>Built with React, TypeScript, Vite and a custom Canvas engine.</p>
        </div>
        <div className="credits-block">
          <h3>Art</h3>
          <p>All graphics are procedurally drawn — no imported assets, no copyright concerns.</p>
        </div>
        <div className="credits-block">
          <h3>Audio</h3>
          <p>Original music and effects synthesized live with the Web Audio API.</p>
        </div>
        <div className="credits-block">
          <h3>Inspiration</h3>
          <p>Broadly inspired by classic grid-puzzle and jiggly-jelly games. This is an original game with original characters, art, music and levels.</p>
        </div>
        <p className="credits-thanks">Thank you for playing! 🍮</p>
      </div>
    </div>
  );
}

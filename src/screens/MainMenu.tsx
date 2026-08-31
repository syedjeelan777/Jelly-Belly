/**
 * Main menu — animated background jellies, logo, navigation.
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { GameButton } from '../components/ui';
import { audio } from '../game/audio/audio';

export function MainMenu() {
  const navigate = useGameStore((s) => s.navigate);
  const selectLevel = useGameStore((s) => s.selectLevel);
  const getContinue = useGameStore((s) => s.getContinueLevel);
  const progress = useGameStore((s) => s.progress);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    audio.ensure();
    audio.setMusic('menu');
  }, []);

  // floaty jelly background
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    const blobs = Array.from({ length: 9 }, (_, i) => ({
      x: (i * 47) % 100,
      y: (i * 31) % 100,
      r: 14 + (i % 4) * 9,
      hue: ['#7fd4ff', '#ff7b9c', '#ffd166', '#7dffb2', '#b9a7ff'][i % 5],
      sp: 0.4 + (i % 3) * 0.25,
      ph: i * 1.3,
    }));
    const fit = () => {
      c.width = c.clientWidth * devicePixelRatio;
      c.height = c.clientHeight * devicePixelRatio;
    };
    fit();
    window.addEventListener('resize', fit);
    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const b of blobs) {
        const x = ((b.x + Math.sin(t * b.sp + b.ph) * 6) / 100) * c.width;
        const y = ((b.y + Math.cos(t * b.sp * 0.8 + b.ph) * 8) / 100) * c.height;
        const r = b.r * devicePixelRatio * (1 + 0.08 * Math.sin(t * 2 + b.ph));
        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.2, x, y, r * 1.2);
        grad.addColorStop(0, 'rgba(255,255,255,0.35)');
        grad.addColorStop(0.4, b.hue + '55');
        grad.addColorStop(1, b.hue + '22');
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 1.06, 0, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
    };
  }, []);

  const hasSave = Object.keys(progress).length > 0;
  const continueLevel = getContinue();

  return (
    <div className="screen menu-screen">
      <canvas ref={ref} className="menu-bg" aria-hidden="true" />
      <div className="menu-content">
        <div className="logo-wrap">
          <div className="logo-blob" aria-hidden="true">
            <span className="logo-face">◕‿◕</span>
          </div>
          <h1 className="logo-title">STICKY<span>VERSE</span></h1>
          <p className="logo-sub">a squishy puzzle adventure</p>
        </div>
        <nav className="menu-nav" aria-label="Main menu">
          <GameButton className="menu-btn" onClick={() => navigate('worlds')}>▶&nbsp; Play</GameButton>
          <GameButton
            className="menu-btn"
            variant="secondary"
            disabled={!hasSave}
            onClick={() => continueLevel && selectLevel(continueLevel.id)}
          >
            Continue{hasSave && continueLevel ? ` — ${continueLevel.name}` : ''}
          </GameButton>
          <GameButton className="menu-btn" variant="secondary" onClick={() => navigate('worlds')}>World Select</GameButton>
          <GameButton className="menu-btn" variant="secondary" onClick={() => navigate('levels')}>Level Select</GameButton>
          <GameButton className="menu-btn" variant="ghost" onClick={() => navigate('mylevels')}>My Levels</GameButton>
          <GameButton className="menu-btn" variant="ghost" onClick={() => navigate('howto')}>How To Play</GameButton>
          <GameButton className="menu-btn" variant="ghost" onClick={() => navigate('stats')}>Statistics</GameButton>
          <GameButton className="menu-btn" variant="ghost" onClick={() => navigate('settings')}>Settings</GameButton>
          <GameButton className="menu-btn" variant="ghost" onClick={() => navigate('credits')}>Credits</GameButton>
        </nav>
        <p className="menu-hint">WASD / Arrows to move · Z undo · R restart · ESC pause</p>
      </div>
    </div>
  );
}

/**
 * Headless UI smoke test — mounts the React app in happy-dom, walks every
 * screen and verifies key elements render without exceptions.
 */
import { Window } from 'happy-dom';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const win = new Window();
const originalWindow = (globalThis as Record<string, unknown>).window as Window;
try { Object.defineProperty(globalThis, 'window', { value: win, configurable: true }); } catch { /* ignore */ }
try { Object.defineProperty(globalThis, 'document', { value: win.document, configurable: true }); } catch { /* ignore */ }
try { Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true }); } catch { /* ignore */ }
try { Object.defineProperty(globalThis, 'HTMLCanvasElement', { value: win.HTMLCanvasElement, configurable: true }); } catch { /* ignore */ }
try { Object.defineProperty(globalThis, 'ResizeObserver', { value: class { observe() {} unobserve() {} disconnect() {} }, configurable: true }); } catch { /* ignore */ }
try { Object.defineProperty(globalThis, 'requestAnimationFrame', { value: (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number, configurable: true }); } catch { /* ignore */ }
try { Object.defineProperty(globalThis, 'cancelAnimationFrame', { value: (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>), configurable: true }); } catch { /* ignore */ }
try { Object.defineProperty(globalThis, 'matchMedia', { value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), configurable: true }); } catch { /* ignore */ }
void originalWindow;

const { default: App } = await import('../src/App');
const { useGameStore } = await import('../src/store/gameStore');
const { clearSave } = await import('../src/data/save');

let failures = 0;
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name} ${extra}`); }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

console.log('SMOKE: UI screens');
clearSave();
useGameStore.setState({
  progress: {}, worlds: {}, statistics: { levelsCompleted: 0, totalMoves: 0, starsEarned: 0, totalPlaySeconds: 0, gamesStarted: 0, jellyDestroyed: 0 },
  customLevels: {}, lastLevelId: null, unlockedWorlds: [1], screen: 'menu', activeLevelId: 'w1-01', modal: null, completion: null,
});

const hostEl = win.document.createElement('div');
hostEl.id = 'root';
win.document.body.appendChild(hostEl);
const host = hostEl as unknown as Element;
const root: Root = createRoot(host);
const errors: Error[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
  if (a[0] instanceof Error || String(a[0]).includes('Error')) errors.push(a[0] instanceof Error ? a[0] : new Error(String(a[0])));
  origErr(...a);
};

root.render(createElement(App));
await sleep(120);

const text = () => host.textContent ?? '';
const store = useGameStore.getState;

check('main menu renders logo', text().includes('STICKYVERSE'));
check('main menu shows continue', text().includes('Continue'));
check('main menu has playback hint', text().includes('WASD'));

store().navigate('worlds');
await sleep(60);
check('world select shows 6 worlds', (host.querySelectorAll('.world-card')?.length ?? 0) === 6);
check('world 6 initially locked', host.querySelector('.world-card.locked') !== null);

store().selectWorld(1);
await sleep(60);
check('level select grid', (host.querySelectorAll('.level-card')?.length ?? 0) === 10);

store().selectLevel('w1-01');
await sleep(250);
check('game screen canvas mounted', host.querySelector('.game-canvas') !== null);
check('game HUD shows moves', text().includes('Moves'));
check('tutorial tip visible', text().includes('Use WASD'));

// simulate a completed level through the real app store
const rec = useGameStore.getState();
rec.recordCompletion('w1-01', 7, 4200, 0);
useGameStore.setState({ modal: 'complete' });
await sleep(120);
check('level complete modal', text().includes('LEVEL COMPLETE'));
check('stars animate in', (host.querySelectorAll('.star.earned').length) === 3);
check('next level button', text().includes('Next Level'));
useGameStore.setState({ modal: null });

// pause via modal state
store().setModal('pause');
await sleep(60);
check('pause menu shows', text().includes('Paused') && text().includes('Resume'));
store().setModal(null);

// settings
store().navigate('settings');
await sleep(60);
check('settings render sliders', host.querySelectorAll('input[type="range"]').length === 3);
check('settings shows controls', text().includes('Undo'));
// toggle gameplay setting
const toggles = host.querySelectorAll('.toggle');
check('settings toggles', toggles.length >= 3);
(toggles[0] as unknown as HTMLElement)?.click?.();
await sleep(40);
check('toggle updates store', useGameStore.getState().settings.showMoveCounter === false);

store().navigate('howto');
await sleep(60);
check('how-to rules', (host.querySelectorAll('.rule-card')?.length ?? 0) >= 6);

store().navigate('credits');
await sleep(60);
check('credits render', text().includes('Thank you for playing'));

store().navigate('stats');
await sleep(60);
check('stats render', text().includes('Levels completed'));

store().navigate('mylevels');
await sleep(60);
check('my levels empty note', text().includes('No custom levels yet'));

store().navigate('editor');
await sleep(60);
check('editor palette', (host.querySelectorAll('.palette-btn')?.length ?? 0) === 20);

console.error = origErr;
console.log(failures === 0 && errors.length === 0 ? '\nALL UI CHECKS PASSED' : `\n${failures} failures, ${errors.length} console errors`);
for (const e of errors.slice(0, 10)) console.error(' CONSOLE ERROR:', e.message);
process.exit(failures === 0 && errors.length === 0 ? 0 : 1);

/**
 * Gameplay screen — canvas board, HUD, pause/dead/complete overlays,
 * desktop keyboard + mobile D-pad + gamepad input.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getLevelById, getNextLevel } from '../game/levels';
import { GameController } from '../game/controller';
import { InputManager, type InputFrame } from '../game/input/input';
import { objectiveInfo } from '../game/engine/logic';
import {
  DPad, FullscreenButton, GameButton, IconButton, Modal, StarRow, clickSfx,
} from '../components/ui';
import { audio } from '../game/audio/audio';

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(pointer: coarse)');
    const h = () => setCoarse(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return coarse;
}

export function GameScreen() {
  const activeLevelId = useGameStore((s) => s.activeLevelId);
  const progress = useGameStore((s) => s.progress);
  const settings = useGameStore((s) => s.settings);
  const completion = useGameStore((s) => s.completion);
  const modal = useGameStore((s) => s.modal);
  const selectLevel = useGameStore((s) => s.selectLevel);
  const navigate = useGameStore((s) => s.navigate);
  const setModal = useGameStore((s) => s.setModal);
  const recordCompletion = useGameStore((s) => s.recordCompletion);

  const level = useMemo(() => {
    const builtin = getLevelById(activeLevelId);
    if (builtin) return builtin;
    const custom = useGameStore.getState().customLevels[activeLevelId];
    return custom;
  }, [activeLevelId]);

  const levelRef = useRef(level);
  levelRef.current = level;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const [moves, setMoves] = useState(0);
  const debugQuery = new URLSearchParams(window.location.search).has('debug');
  const [debug, setDebug] = useState(false);
  const [fps, setFps] = useState(0);
  void debugQuery;
  const [objective, setObjective] = useState('reach exit');
  const [ready, setReady] = useState(false);
  const coarse = useCoarsePointer();
  const [tipVisible, setTipVisible] = useState(true);
  const pauseKeyRef = useRef(false);

  /* ------------------------------ controller ------------------------------ */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !levelRef.current) return;
    const ctrl = new GameController(canvas, levelRef.current, {
      onComplete: (movesCount, timeMs, destroyed) => {
        setMoves(movesCount);
        recordCompletion(levelRef.current!.id, movesCount, timeMs, destroyed);
        useGameStore.setState({ modal: 'complete', completion: useGameStore.getState().completion });
        setModal('complete');
      },
      onDead: () => {
        setModal('dead');
      },
      onState: () => {
        const s = ctrl.state;
        setMoves(s.moveCount);
        const o = objectiveInfo(s);
        setObjective(`${o.label} ${o.done}/${o.total}`);
      },
    });
    ctrl.reducedMotion = settings.reducedMotion;
    ctrl.screenShake = settings.screenShake;
    ctrl.debug = debug;
    controllerRef.current = ctrl;
    setMoves(0);
    setObjective(objectiveInfo(ctrl.state).label);
    setReady(true);
    setTipVisible(!!levelRef.current.tip && settings.showTutorials && !progress[levelRef.current.id]?.completed);
    audio.ensure();
    audio.setMusic('game');
    const stop = ctrl.initLoop();

    // fit canvas to container
    const fit = () => {
      const w = wrapRef.current?.clientWidth ?? 800;
      const h = wrapRef.current?.clientHeight ?? 600;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctrl.resize(canvas.width, canvas.height);
    };
    fit();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(fit);
      if (wrapRef.current) ro.observe(wrapRef.current);
    }

    return () => {
      stop();
      ro?.disconnect();
      controllerRef.current = null;
      audio.setMusic('menu');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLevelId]);

  /* -------------------------------- input --------------------------------- */

  const restartLevel = useCallback((forced = false) => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    const skip = forced || !settings.confirmRestart;
    if (!skip) {
      setModal('confirm');
      return;
    }
    ctrl.restart();
    setModal(null);
    setMoves(0);
  }, [settings.confirmRestart, setModal]);

  const togglePause = useCallback(() => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    const cur = useGameStore.getState().modal;
    if (cur === 'pause') {
      ctrl.setPaused(false);
      setModal(null);
      audio.sfx('ui');
    } else if (cur === null) {
      ctrl.setPaused(true);
      setModal('pause');
      audio.sfx('ui');
    }
  }, [setModal]);

  useEffect(() => {
    const im = new InputManager();
    const ctrl = () => controllerRef.current;
    im.onInput((f: InputFrame) => {
      if (!ctrl()) return;
      if (f.pause) {
        pauseKeyRef.current = true;
        togglePause();
        return;
      }
      void pauseKeyRef;
      if (useGameStore.getState().modal !== null) {
        const m = useGameStore.getState().modal;
        if (f.undo && m !== 'complete') {
          useGameStore.getState().setModal(null);
          ctrl()?.setPaused(false);
          ctrl()?.undo();
        } else if (f.restart && (m === 'dead' || m === 'confirm')) {
          restartLevel(m === 'confirm' ? true : true);
          useGameStore.getState().setModal(null);
          ctrl()?.setPaused(false);
        }
        return;
      }
      if (f.dir) ctrl()!.press(f.dir);
      if (f.undo) ctrl()!.undo();
      if (f.restart) restartLevel();
    });

    // hold-to-repeat
    let raf = 0;
    let lastHold: string | null = null;
    const poll = () => {
      const held = im.heldDir();
      const key = held ? `${held}` : null;
      if (held && key !== lastHold) {
        lastHold = key;
        if (useGameStore.getState().modal === null) ctrl()?.hold(held);
      }
      const gp = im.pollGamepad();
      if (gp) {
        if (gp.dir) {
          if (useGameStore.getState().modal === null) ctrl()?.press(gp.dir);
        }
        if (gp.undo) ctrl()?.undo();
        if (gp.restart) restartLevel();
        if (gp.pause) togglePause();
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => {
      im.dispose();
      cancelAnimationFrame(raf);
    };
  }, [restartLevel, togglePause]);

  // F3 toggles the dev overlay (only active in DEV or with ?debug)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        setDebug((d: boolean) => {
          const next = !d;
          if (controllerRef.current) controllerRef.current.debug = next;
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // sample FPS from the controller
  useEffect(() => {
    const id = window.setInterval(() => {
      setFps(controllerRef.current?.fps ?? 0);
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  /* ------------------------------- handlers -------------------------------- */

  const onDir = useCallback((d: 'up' | 'down' | 'left' | 'right') => {
    controllerRef.current?.press(d);
  }, []);
  const onRelease = useCallback(() => {
    controllerRef.current?.hold(null);
  }, []);

  const next = getNextLevel(level);

  if (!level) {
    return (
      <div className="screen center-screen">
        <p>This level could not be loaded.</p>
        <GameButton onClick={() => navigate('levels')}>Level Select</GameButton>
      </div>
    );
  }

  const completed = completion && useGameStore.getState().modal === 'complete';

  return (
    <div className="screen game-screen">
      <header className="game-hud">
        <IconButton title="Level Select" onClick={() => { useGameStore.setState({ modal: null }); navigate('levels'); }}>☰</IconButton>
        <div className="hud-title">
          <span className="hud-world">World {level.world}</span>
          <strong>{level.name}</strong>
        </div>
        {settings.showMoveCounter && (
          <div className="hud-moves" aria-live="polite">Moves <b>{moves}</b></div>
        )}
        <div className="hud-objective">{objective}</div>
        <IconButton title="Undo (Z)" onClick={() => controllerRef.current?.undo()}>↶ Undo</IconButton>
        <IconButton title="Restart (R)" onClick={() => restartLevel()}>↻</IconButton>
        <IconButton title="Pause (Esc)" onClick={togglePause}>Ⅱ</IconButton>
        <FullscreenButton />
      </header>

      {debug && (
        <div className="debug-panel" role="status" aria-label="Debug controls">
          <span className="dbg-title">DEBUG</span>
          <span>FPS <b>{fps}</b></span>
          <span>Moves <b>{moves}</b></span>
          <button onClick={() => controllerRef.current?.debugSkip()}>SKIP</button>
          <button onClick={() => useGameStore.getState().resetProgress()}>RESET SAVE</button>
          <button onClick={() => controllerRef.current?.restart()}>RELOAD</button>
          <button onClick={() => { setDebug(false); if (controllerRef.current) controllerRef.current.debug = false; }}>HIDE</button>
        </div>
      )}

      <div className="game-canvas-wrap" ref={wrapRef} onClick={(e) => {
        // tap to resume audio (autoplay policy)
        audio.ensure();
        void e;
      }}>
        <canvas ref={canvasRef} className="game-canvas" />
        {ready && tipVisible && level.tip && (
          <div className="tip-banner" role="status">
            <span className="tip-text">💡 {level.tip}</span>
            <button className="tip-close" onClick={() => setTipVisible(false)} aria-label="Dismiss tip">✕</button>
          </div>
        )}
        {coarse && !modal && (
          <DPad onDir={onDir} onRelease={onRelease} />
        )}
      </div>

      {modal === 'pause' && (
        <Modal onClose={() => { controllerRef.current?.setPaused(false); setModal(null); }}>
          <h2 className="modal-title">Paused</h2>
          <div className="modal-buttons">
            <GameButton onClick={() => { controllerRef.current?.setPaused(false); setModal(null); }}>▶ Resume</GameButton>
            <GameButton variant="secondary" onClick={() => restartLevel(true)}>↻ Restart</GameButton>
            <GameButton variant="secondary" onClick={() => navigate('settings')}>⚙ Settings</GameButton>
            <GameButton variant="secondary" onClick={() => { useGameStore.setState({ modal: null }); navigate('levels'); }}>▦ Level Select</GameButton>
            <GameButton variant="ghost" onClick={() => { useGameStore.setState({ modal: null }); navigate('menu'); }}>🏠 Main Menu</GameButton>
          </div>
        </Modal>
      )}

      {modal === 'confirm' && (
        <Modal onClose={() => { controllerRef.current?.setPaused(false); setModal(null); }}>
          <h2 className="modal-title">Restart level?</h2>
          <p className="modal-copy">You will lose your current progress in this level.</p>
          <div className="modal-buttons">
            <GameButton onClick={() => restartLevel(true)}>↻ Restart</GameButton>
            <GameButton variant="ghost" onClick={() => { controllerRef.current?.setPaused(false); setModal(null); }}>Cancel</GameButton>
          </div>
        </Modal>
      )}

      {modal === 'dead' && (
        <Modal onClose={() => { controllerRef.current?.setPaused(false); setModal(null); }}>
          <h2 className="modal-title dead">Squished!</h2>
          <p className="modal-copy">Ouch… time to try that again.</p>
          <div className="modal-buttons">
            <GameButton onClick={() => restartLevel(true)}>↻ Retry (R)</GameButton>
            <GameButton variant="secondary" onClick={() => { controllerRef.current?.setPaused(false); controllerRef.current?.undo(); setModal(null); }}>↶ Undo</GameButton>
            <GameButton variant="ghost" onClick={() => { useGameStore.setState({ modal: null }); navigate('levels'); }}>Level Select</GameButton>
          </div>
        </Modal>
      )}

      {modal === 'complete' && completed && completion && (
        <Modal className="complete-modal">
          <h2 className="modal-title complete">LEVEL COMPLETE!</h2>
          <StarRow count={completion.stars} size={44} animate />
          <div className="complete-stats">
            <div><span>Moves</span><b>{completion.moves}</b></div>
            <div><span>Time</span><b>{(completion.timeMs / 1000).toFixed(1)}s</b></div>
            <div><span>Best</span><b>{progress[level.id]?.bestMoves ?? completion.moves}</b></div>
          </div>
          {completion.improved && <p className="improved-note">✨ New best!</p>}
          <div className="modal-buttons">
            {next ? (
              <GameButton onClick={() => { clickSfx(); selectLevel(next.id); }}>▶ Next Level</GameButton>
            ) : (
              <GameButton onClick={() => { clickSfx(); navigate('menu'); }}>🏠 Main Menu</GameButton>
            )}
            <GameButton variant="secondary" onClick={() => { controllerRef.current?.restart(); useGameStore.setState({ modal: null }); }}>↻ Replay</GameButton>
            <GameButton variant="ghost" onClick={() => { useGameStore.setState({ modal: null }); navigate('levels'); }}>Level Select</GameButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

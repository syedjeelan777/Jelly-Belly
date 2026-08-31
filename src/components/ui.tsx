/**
 * Shared UI primitives — game-y buttons, panels, modals, sliders, stars.
 */
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../game/audio/audio';

export function clickSfx(): void {
  audio.ensure();
  audio.sfx('ui');
}

interface BtnProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  title?: string;
  ariaLabel?: string;
}

export function GameButton({ children, onClick, variant = 'primary', className = '', disabled, autoFocus, title, ariaLabel }: BtnProps) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      disabled={disabled}
      autoFocus={autoFocus}
      title={title}
      aria-label={ariaLabel}
      onClick={() => {
        clickSfx();
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
      }}
    >
      {children}
    </button>
  );
}

export function IconButton({ children, onClick, title, className = '' }: { children: ReactNode; onClick?: () => void; title: string; className?: string }) {
  return (
    <button
      className={`icon-btn ${className}`}
      title={title}
      aria-label={title}
      onClick={() => {
        clickSfx();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function Modal({ children, onClose, className = '' }: { children: ReactNode; onClose?: () => void; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${className}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export function Slider({
  label, value, onChange, min = 0, max = 1, step = 0.05, format,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; format?: (v: number) => string;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <label className="slider-row">
      <span className="slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => { setDragging(false); clickSfx(); }}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${((value - min) / (max - min)) * 100}%`, '--active': dragging ? '#ffd166' : '#7fd4ff' } as React.CSSProperties}
      />
      <span className="slider-value">{format ? format(value) : `${Math.round(value * 100)}%`}</span>
    </label>
  );
}

export function ToggleRow({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <div className="toggle-row">
      <div className="toggle-text">
        <span>{label}</span>
        {description && <small>{description}</small>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle ${checked ? 'on' : ''}`}
        onClick={() => { clickSfx(); onChange(!checked); }}
      >
        <span className="knob" />
      </button>
    </div>
  );
}

export function StarRow({ count, size = 26, animate = false, delay = 120 }: { count: number; size?: number; animate?: boolean; delay?: number }) {
  const [shown, setShown] = useState(animate ? 0 : count);
  useEffect(() => {
    if (!animate) return;
    setShown(0);
    const timers: number[] = [];
    for (let i = 1; i <= count; i++) {
      timers.push(window.setTimeout(() => setShown(i), delay * i));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [count, animate, delay]);
  return (
    <span className="star-row" aria-label={`${count} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`star ${i <= shown ? 'lit' : ''} ${i <= count ? 'earned' : ''} ${animate && i <= shown ? 'pop' : ''}`} style={{ fontSize: size }}>
          ★
        </span>
      ))}
    </span>
  );
}

export function BackHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <header className="screen-header">
      <IconButton title="Back" onClick={onBack}>←</IconButton>
      <h1>{title}</h1>
      <div className="header-right">{right}</div>
    </header>
  );
}

export function FullscreenButton({ className = '' }: { className?: string }) {
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  return (
    <IconButton
      title={fs ? 'Exit fullscreen' : 'Fullscreen'}
      className={className}
      onClick={() => {
        try {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen();
        } catch {
          /* graceful: fullscreen unsupported */
        }
      }}
    >
      {fs ? '⤢' : '⛶'}
    </IconButton>
  );
}

/** Touch-safe virtual D-pad. */
export function DPad({ onDir, onRelease }: { onDir: (d: 'up' | 'down' | 'left' | 'right') => void; onRelease: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const dirFor = (el: EventTarget | null): 'up' | 'down' | 'left' | 'right' | null => {
    const t = (el as HTMLElement)?.dataset?.dir as 'up' | 'down' | 'left' | 'right' | undefined;
    return t ?? null;
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      const d = dirFor(e.target);
      if (d) {
        setActive(d);
        onDir(d);
      }
    };
    const move = (e: PointerEvent) => {
      const d = dirFor(e.target);
      if (d !== active) {
        setActive(d);
        onDir(d ?? 'up');
      }
    };
    const up = (e: PointerEvent) => {
      e.preventDefault();
      setActive(null);
      onRelease();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [onDir, onRelease, active]);
  return (
    <div className="dpad" ref={ref} aria-label="Directional pad">
      <button className={`dpad-btn up ${active === 'up' ? 'active' : ''}`} data-dir="up" aria-label="Move up">▲</button>
      <button className={`dpad-btn left ${active === 'left' ? 'active' : ''}`} data-dir="left" aria-label="Move left">◀</button>
      <button className={`dpad-btn right ${active === 'right' ? 'active' : ''}`} data-dir="right" aria-label="Move right">▶</button>
      <button className={`dpad-btn down ${active === 'down' ? 'active' : ''}`} data-dir="down" aria-label="Move down">▼</button>
    </div>
  );
}

export function Footer({ children }: { children: ReactNode }) {
  return <footer className="screen-footer">{children}</footer>;
}

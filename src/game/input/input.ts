/**
 * Centralized input manager: keyboard + gamepad.
 * - Ignores key repeat.
 * - Prevents default page scrolling on game keys.
 * - Maps gamepad dpad/buttons; protects against duplicate events.
 */
import type { Dir } from '../engine/types';

export interface InputFrame {
  dir: Dir | null;
  undo: boolean;
  restart: boolean;
  pause: boolean;
}

type KeyHandler = (f: InputFrame) => void;

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

export class InputManager {
  private down = new Set<string>();
  private gamepadPrev = new Set<string>();
  private handler: KeyHandler | null = null;
  private attached = false;

  private onKeyDown = (e: KeyboardEvent) => {
    const dir = KEY_DIRS[e.code];
    if (dir || ['KeyR', 'KeyZ', 'Escape', 'Enter'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    if (dir) this.down.add(e.code);
    this.push({ dir: dir ?? null, undo: e.code === 'KeyZ', restart: e.code === 'KeyR', pause: e.code === 'Escape' });
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };

  private onBlur = () => {
    this.down.clear();
  };

  onInput(handler: KeyHandler): void {
    this.handler = handler;
    if (!this.attached) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.onBlur);
      this.attached = true;
    }
  }

  /** Current held direction (for movement repeat). */
  heldDir(): Dir | null {
    for (const code of KEY_DIRS_DESC) {
      if (this.down.has(code)) return KEY_DIRS[code];
    }
    return null;
  }

  private push(f: InputFrame): void {
    this.handler?.(f);
  }

  /** Poll gamepad (called each frame), returns newly pressed frame. */
  pollGamepad(): InputFrame | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    const pad = pads && pads[0];
    if (!pad) {
      this.gamepadPrev.clear();
      return null;
    }
    const pressed = new Set<string>();
    const b = pad.buttons;
    const axes = pad.axes;
    if (b[12]?.pressed || (axes[0] ?? 0) < -0.5) pressed.add('left');
    if (b[13]?.pressed || (axes[0] ?? 0) > 0.5) pressed.add('right');
    if (b[14]?.pressed || (axes[1] ?? 0) < -0.5) pressed.add('up');
    if (b[15]?.pressed || (axes[1] ?? 0) > 0.5) pressed.add('down');
    if (b[0]?.pressed) pressed.add('confirm');
    if (b[1]?.pressed) pressed.add('back');
    if (b[2]?.pressed || b[3]?.pressed) pressed.add('undo');
    if (b[8]?.pressed || b[9]?.pressed) pressed.add('pause');

    let dir: Dir | null = null;
    if (pressed.has('up')) dir = 'up';
    else if (pressed.has('down')) dir = 'down';
    else if (pressed.has('left')) dir = 'left';
    else if (pressed.has('right')) dir = 'right';

    const frame: InputFrame = {
      dir,
      undo: pressed.has('undo') && !this.gamepadPrev.has('undo'),
      restart: pressed.has('back') && !this.gamepadPrev.has('back'),
      pause: pressed.has('pause') && !this.gamepadPrev.has('pause'),
    };
    this.gamepadPrev = pressed;
    if (frame.dir || frame.undo || frame.restart || frame.pause) return frame;
    return null;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.attached = false;
    this.handler = null;
  }
}

const KEY_DIRS_DESC = Object.keys(KEY_DIRS);

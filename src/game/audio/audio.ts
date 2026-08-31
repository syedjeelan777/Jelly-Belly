/**
 * STICKYVERSE audio — 100% synthesized with WebAudio (no external assets).
 * Music is an original procedural chiptune-ish sequencer; SFX are small
 * envelope-sculpted oscillators/noise. Every call is safe: if the browser
 * blocks audio (autoplay policy, no AudioContext), the game keeps running.
 */

export type MusicTrack = 'menu' | 'game' | 'victory' | 'off';

interface Tone {
  f: number;
  d: number; // duration in beats
  t?: number; // 0..1 time offset (default 0)
  type?: OscillatorType;
  g?: number; // gain
}

type SfxName =
  | 'move' | 'push' | 'bump' | 'stick' | 'hop' | 'slide' | 'switch-on' | 'switch-off'
  | 'door-open' | 'door-close' | 'jelly-burn' | 'jelly-crush' | 'laser' | 'crusher'
  | 'complete' | 'undo' | 'restart' | 'death' | 'ui' | 'go' | 'plate' | 'drift';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private schedulerId: number | null = null;
  private nextBeat = 0;
  private beat = 0;
  private track: MusicTrack = 'off';
  private volumes = { master: 0.8, music: 0.55, sfx: 0.8 };
  enabled = true;

  /** Create/resume context. Must be called after a user gesture ideally. */
  ensure(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.master);
        // pre-render 1s of white noise
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.applyVolumes();
      // a track may have been requested before the context existed
      if (this.track !== 'off' && this.schedulerId === null) this.setMusic(this.track);
    } catch {
      this.enabled = false;
    }
  }

  applyVolumes(): void {
    if (!this.ctx || !this.master || !this.musicGain || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.volumes.music * 0.5, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
  }

  setVolumes(v: { master: number; music: number; sfx: number }): void {
    this.volumes = v;
    this.applyVolumes();
  }

  /* ------------------------------ helpers --------------------------------- */

  private env(dest: AudioNode, t: number, peak: number, a: number, d: number): GainNode {
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    gain.connect(dest);
    return gain;
  }

  private osc(t: number, f: number, type: OscillatorType, dur: number, gain: number, dest?: AudioNode, detune = 0): void {
    if (!this.ctx || !this.sfxGain) return;
    const out: AudioNode = dest ?? this.sfxGain;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    const g = this.env(out, t, gain, 0.004, dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(t: number, dur: number, gain: number, filterFreq: number, type: BiquadFilterType = 'lowpass', dest?: AudioNode): void {
    if (!this.ctx || !this.noiseBuf || !this.sfxGain) return;
    const out: AudioNode = dest ?? this.sfxGain;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.env(out, t, gain, 0.003, dur);
    src.connect(f);
    f.connect(g);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /* --------------------------------- SFX ---------------------------------- */

  sfx(name: SfxName): void {
    if (!this.ctx || !this.enabled || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const sfx = this.sfxGain;
    switch (name) {
      case 'move': this.osc(t, 220 + Math.random() * 30, 'sine', 0.06, 0.10); break;
      case 'push': this.osc(t, 150, 'triangle', 0.09, 0.14); break;
      case 'bump': this.osc(t, 110, 'sine', 0.07, 0.16); this.noise(t, 0.05, 0.05, 500); break;
      case 'stick': this.osc(t, 880, 'sine', 0.05, 0.07); this.osc(t + 0.02, 1320, 'sine', 0.06, 0.05); break;
      case 'hop': {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(180, t);
        o.frequency.exponentialRampToValueAtTime(520, t + 0.18);
        const g = this.env(sfx, t, 0.16, 0.01, 0.2);
        o.connect(g); o.start(t); o.stop(t + 0.25);
        break;
      }
      case 'slide': this.noise(t, 0.22, 0.1, 1400, 'bandpass'); break;
      case 'switch-on': this.osc(t, 520, 'square', 0.05, 0.08); this.osc(t + 0.05, 780, 'square', 0.07, 0.08); break;
      case 'switch-off': this.osc(t, 780, 'square', 0.05, 0.08); this.osc(t + 0.05, 420, 'square', 0.07, 0.08); break;
      case 'door-open': this.osc(t, 90, 'sawtooth', 0.28, 0.1, undefined, -60); this.noise(t, 0.25, 0.04, 900); break;
      case 'door-close': this.osc(t, 70, 'sawtooth', 0.24, 0.1, undefined, 40); this.noise(t, 0.2, 0.04, 700); break;
      case 'jelly-burn': this.noise(t, 0.25, 0.16, 2800, 'highpass'); this.osc(t, 400, 'sawtooth', 0.2, 0.06, undefined, -200); break;
      case 'jelly-crush': this.noise(t, 0.15, 0.2, 400); this.osc(t, 80, 'sine', 0.2, 0.2); break;
      case 'laser': this.osc(t, 1400, 'sawtooth', 0.14, 0.07, undefined, -100); break;
      case 'crusher': this.noise(t, 0.12, 0.16, 300); break;
      case 'complete': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => this.osc(t + i * 0.09, f, 'triangle', 0.22, 0.1, undefined, 0));
        break;
      }
      case 'undo': this.osc(t, 600, 'sine', 0.06, 0.09); this.osc(t + 0.05, 400, 'sine', 0.08, 0.09); break;
      case 'restart': this.noise(t, 0.2, 0.1, 1200, 'bandpass'); break;
      case 'death': this.osc(t, 300, 'sawtooth', 0.3, 0.12, undefined, -350); this.noise(t, 0.2, 0.08, 600); break;
      case 'ui': this.osc(t, 720, 'sine', 0.045, 0.07); break;
      case 'go': {
        const notes = [392, 523.25, 659.25];
        notes.forEach((f, i) => this.osc(t + i * 0.08, f, 'triangle', 0.16, 0.09));
        break;
      }
      case 'plate': this.osc(t, 240, 'sine', 0.1, 0.1); this.osc(t + 0.04, 320, 'sine', 0.12, 0.09); break;
      case 'drift': this.noise(t, 0.12, 0.05, 900, 'bandpass'); break;
    }
  }

  /* -------------------------------- music --------------------------------- */

  setMusic(track: MusicTrack): void {
    if (this.track === track && this.schedulerId !== null) return;
    this.track = track;
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (track === 'off') return;
    // Start the scheduler now; schedule() no-ops until the AudioContext exists.
    this.beat = 0;
    this.nextBeat = this.ctx ? this.ctx.currentTime + 0.1 : 0;
    this.schedulerId = window.setInterval(() => {
      if (!this.ctx || !this.musicGain) return;
      const now = this.ctx.currentTime;
      if (this.nextBeat === 0 || this.nextBeat < now - 0.5) this.nextBeat = now + 0.1;
      this.schedule();
    }, 80);
  }

  private schedule(): void {
    if (!this.ctx || !this.musicGain) return;
    const bpm = this.track === 'menu' ? 96 : this.track === 'victory' ? 120 : 108;
    const spb = 60 / bpm;
    while (this.nextBeat < this.ctx.currentTime + 0.35) {
      if (this.beat < 64) this.playBeat(this.beat, this.nextBeat, spb);
      this.nextBeat += spb;
      this.beat++;
    }
  }

  /** Original 8-bar loop per track (bass, lead, hats) — seed varies by track. */
  private playBeat(b: number, t: number, spb: number): void {
    if (!this.musicGain) return;
    const melody: Record<string, number[]> = {
      menu: [0, 4, 7, 4, 0, 4, 9, 7, 0, 4, 7, 4, 2, 5, 9, 11],
      game: [0, 0, 7, 5, 0, 3, 7, 10, 0, 0, 7, 5, 2, 4, 9, 7],
      victory: [0, 4, 7, 12, 9, 7, 4, 2, 0, 4, 7, 12, 14, 12, 9, 7],
    };
    const base = 220; // A3-ish
    const semi = (n: number) => base * Math.pow(2, n / 12);
    const step = b % 16;
    const m = melody[this.track] ?? melody.menu;

    // bass on quarter notes
    if (b % 2 === 0) {
      const root = this.track === 'menu' ? 55 : this.track === 'victory' ? 65.4 : 61.7;
      const roots = [root, root, root * 1.5, root * 1.335];
      this.tone(t, roots[(b >> 1) % 4], 'triangle', 0.5, 0.16, this.musicGain);
    }
    // lead melody on beat 0 and 8 of each bar, sparse
    if (b % 8 === 0) this.tone(t, semi(m[step]), 'square', spb * 1.6, 0.055, this.musicGain);
    if (b % 8 === 4) this.tone(t, semi(m[(step + 4) % 16]), 'square', spb * 1.4, 0.045, this.musicGain);
    // hats every beat
    if (this.ctx && this.noiseBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6000;
      const g = this.musicGain;
      const gain = this.ctx.createGain();
      const vol = b % 4 === 2 ? 0.02 : 0.008;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(f); f.connect(gain); gain.connect(g);
      src.start(t);
      src.stop(t + 0.05);
    }
  }

  private tone(t: number, f: number, type: OscillatorType, dur: number, gain: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

export const audio = new AudioEngine();

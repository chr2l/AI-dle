// Background music (plan de polish IP-13), synthesized like the sound effects:
// a soft pad, a bass and an arpeggio over a four-chord loop, with a key, tempo
// and timbre per country of the week. Quiet by design, switched in Réglages,
// silent while the app is in the background. Real recorded tracks can replace
// it later without touching the rest of the game.
import type { CountryId } from '../core';
import { settings } from './settings';

interface Theme {
  /** Root note (MIDI). */
  root: number;
  bpm: number;
  /** Chord roots in scale degrees (semitones from root) and their quality. */
  chords: [number, 'maj' | 'min'][];
  arp: OscillatorType;
  /** Arpeggio notes per beat (2 = eighths). */
  density: number;
}

const POP: [number, 'maj' | 'min'][] = [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']];
const DREAM: [number, 'maj' | 'min'][] = [[0, 'maj'], [5, 'maj'], [9, 'min'], [7, 'maj']];
const DARK: [number, 'maj' | 'min'][] = [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']];

export const THEMES: Record<CountryId, Theme> = {
  melodia: { root: 60, bpm: 92, chords: POP, arp: 'triangle', density: 2 },
  tropicalia: { root: 62, bpm: 104, chords: POP, arp: 'sine', density: 2 },
  gourmandie: { root: 65, bpm: 84, chords: DREAM, arp: 'triangle', density: 2 },
  bitopia: { root: 57, bpm: 112, chords: DARK, arp: 'square', density: 4 },
  givrebourg: { root: 64, bpm: 72, chords: DREAM, arp: 'sine', density: 2 },
  desolande: { root: 55, bpm: 66, chords: DARK, arp: 'triangle', density: 1 },
  nuagelande: { root: 67, bpm: 76, chords: DREAM, arp: 'sine', density: 2 },
  infernia: { root: 52, bpm: 96, chords: DARK, arp: 'sawtooth', density: 2 },
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const triad = (root: number, q: 'maj' | 'min') => [root, root + (q === 'maj' ? 4 : 3), root + 7];

export class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private timer = 0;
  private nextAt = 0;
  private step = 0;
  private theme: Theme = THEMES.melodia;

  setCountry(id: CountryId) {
    this.theme = THEMES[id] ?? THEMES.melodia;
  }

  /** Starts if allowed (needs a user gesture first on Android/Chrome). */
  start() {
    if (!settings.music || document.hidden) return;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.timer) return;
      if (!this.out) {
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.045;
        this.out.connect(this.ctx.destination);
      }
      this.nextAt = this.ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 200);
    } catch {
      /* no audio */
    }
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    void this.ctx?.suspend().catch(() => {});
  }

  /** Schedules the notes of the next second (look-ahead keeps timing steady). */
  private schedule() {
    const ctx = this.ctx!;
    const t = this.theme;
    const beat = 60 / t.bpm;
    while (this.nextAt < ctx.currentTime + 1) {
      const bar = Math.floor(this.step / 4) % t.chords.length;
      const [deg, q] = t.chords[bar];
      const notes = triad(t.root + deg, q);
      const at = this.nextAt;
      if (this.step % 4 === 0) {
        for (const n of notes) this.note(hz(n - 12), at, beat * 4, 'sine', 0.35, 0.6);
        this.note(hz(t.root + deg - 24), at, beat * 2, 'triangle', 0.6, 0.02);
      }
      if (this.step % 4 === 2) this.note(hz(t.root + deg - 24), at, beat * 1.5, 'triangle', 0.45, 0.02);
      for (let k = 0; k < t.density; k++) {
        // Wandering but repeatable arpeggio: up the chord, then an octave sparkle.
        const i = (this.step * t.density + k) % 6;
        const n = i < 3 ? notes[i] : notes[5 - i] + 12;
        if ((this.step + k) % 7 !== 6) this.note(hz(n), at + (k * beat) / t.density, beat / t.density, t.arp, t.arp === 'square' || t.arp === 'sawtooth' ? 0.12 : 0.25, 0.01);
      }
      this.step++;
      this.nextAt += beat;
    }
  }

  private note(freq: number, at: number, len: number, type: OscillatorType, gain: number, attack: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(g).connect(this.out!);
    osc.start(at);
    osc.stop(at + len + 0.05);
  }
}

export const music = new Music();

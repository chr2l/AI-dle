// Game feel: synthesized sounds (no audio files), light haptics, coins flying
// to the counter, confetti bursts. Everything degrades silently when the
// platform lacks the feature.
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const MUTE_KEY = 'idleport.mute';
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* not persisted */
  }
  return muted;
}

type Note = [freq: number, at: number, len: number, type?: OscillatorType, gain?: number];

const SOUNDS: Record<'tap' | 'coin' | 'success' | 'error' | 'levelup' | 'whoosh', Note[]> = {
  tap: [[520, 0, 0.05, 'triangle', 0.12]],
  coin: [[988, 0, 0.07, 'square', 0.06], [1319, 0.06, 0.12, 'square', 0.06]],
  success: [[523, 0, 0.09, 'triangle'], [659, 0.08, 0.09, 'triangle'], [784, 0.16, 0.16, 'triangle']],
  error: [[180, 0, 0.12, 'sawtooth', 0.08], [140, 0.1, 0.14, 'sawtooth', 0.08]],
  levelup: [[523, 0, 0.1, 'square', 0.07], [659, 0.1, 0.1, 'square', 0.07], [784, 0.2, 0.1, 'square', 0.07], [1047, 0.3, 0.3, 'square', 0.07]],
  whoosh: [[300, 0, 0.18, 'sine', 0.08]],
};

export function sound(name: keyof typeof SOUNDS) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    for (const [freq, at, len, type = 'triangle', gain = 0.1] of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0 + at);
      if (name === 'whoosh') osc.frequency.exponentialRampToValueAtTime(900, t0 + at + len);
      g.gain.setValueAtTime(gain, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + len + 0.02);
    }
  } catch {
    /* no audio */
  }
}

export function haptic(kind: 'light' | 'success' | 'error' = 'light') {
  try {
    if (kind === 'light') void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    else void Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Error }).catch(() => {});
  } catch {
    /* no haptics */
  }
}

/** Coins (or another icon) flying from a point to an element, which then bounces. */
export function flyTo(layer: HTMLElement, from: { x: number; y: number }, to: HTMLElement | null, icon = '🪙', count = 6) {
  if (!to) return;
  const r = to.getBoundingClientRect();
  const tx = r.left + r.width / 2;
  const ty = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'fly';
    el.textContent = icon;
    const sx = from.x + (Math.random() - 0.5) * 60;
    const sy = from.y + (Math.random() - 0.5) * 30;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    layer.append(el);
    const delay = i * 45;
    el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 0 },
        { transform: `translate(-50%,-50%) translate(${(Math.random() - 0.5) * 40}px, -30px) scale(1.1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(-50%,-50%) translate(${tx - sx}px, ${ty - sy}px) scale(0.6)`, opacity: 0.9 },
      ],
      { duration: 650, delay, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' },
    ).onfinish = () => {
      el.remove();
      to.classList.remove('bump');
      void to.offsetWidth;
      to.classList.add('bump');
    };
  }
}

const CONFETTI = ['#ffd23f', '#ff6fb5', '#3fa7ff', '#2ec4a6', '#ff7a59', '#c86bfa'];

export function confetti(layer: HTMLElement, from: { x: number; y: number }, count = 26) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i');
    el.className = 'confetti';
    el.style.left = `${from.x}px`;
    el.style.top = `${from.y}px`;
    el.style.background = CONFETTI[i % CONFETTI.length];
    layer.append(el);
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 120;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 60;
    el.animate(
      [
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${dx * 1.1}px, ${dy + 140}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' },
    ).onfinish = () => el.remove();
  }
}

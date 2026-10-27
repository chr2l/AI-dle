// Player preferences (Réglages): sound, vibrations, animations, text size,
// frame rate. Stored apart from the game save so a fresh start or an
// imported game keeps them.
const KEY = 'idleport.settings';
/** Mute flag from before the settings screen existed. */
const OLD_MUTE_KEY = 'idleport.mute';

export interface Settings {
  sound: boolean;
  /** Background music (music.ts). */
  music: boolean;
  haptics: boolean;
  /** auto = follow the phone's « reduce animations » setting. */
  motion: 'auto' | 'reduced' | 'full';
  text: 'normal' | 'large';
  fps: 30 | 60;
  /** Reminders (local notifications) on, and the kinds the player turned off. */
  notif: boolean;
  notifOff: string[];
  /** The « be told when a plane lands? » question was asked. */
  notifAsked: boolean;
  /** Anonymous statistics (telemetry.ts): not asked yet, accepted or refused. */
  analytics: 'unknown' | 'yes' | 'no';
  installId?: string;
}

const DEFAULTS: Settings = { sound: true, music: true, haptics: true, motion: 'auto', text: 'normal', fps: 30, notif: true, notifOff: [], notifAsked: false, analytics: 'unknown' };

function read(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') return { ...DEFAULTS, ...raw };
    return { ...DEFAULTS, sound: localStorage.getItem(OLD_MUTE_KEY) !== '1' };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = read();

const listeners: ((s: Settings) => void)[] = [];

/** Calls `fn` now and after every change. */
export function onSettings(fn: (s: Settings) => void) {
  listeners.push(fn);
  fn(settings);
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settings[key] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* kept for this session only */
  }
  for (const fn of listeners) fn(settings);
}

export function reducedMotion(): boolean {
  if (settings.motion !== 'auto') return settings.motion === 'reduced';
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Reflects the settings on the document (CSS hooks: .calm, data-text). */
export function applySettings(root = document.documentElement) {
  root.classList.toggle('calm', reducedMotion());
  root.dataset.text = settings.text;
}

// Where the game is kept on the phone. The WebView's localStorage can be
// wiped by Android (storage cleanup, WebView updates), so on device every
// save is also written to native storage (@capacitor/preferences), with the
// previous one as a backup. At launch the most advanced readable copy wins.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import * as G from '../core';
import type { GameState } from '../core';

const native = Capacitor.isNativePlatform();
/** Last JSON written natively: becomes the native backup at the next write. */
let lastNative: string | null = null;
/** Set before a reload that replaces the game, so no autosave overwrites it. */
let frozen = false;

const local = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export async function loadGame(now: number): Promise<GameState | null> {
  const candidates = [local(G.SAVE_KEY), local(G.BACKUP_KEY)];
  if (native) {
    try {
      const [main, bak] = await Promise.all([Preferences.get({ key: G.SAVE_KEY }), Preferences.get({ key: G.BACKUP_KEY })]);
      lastNative = main.value;
      candidates.push(main.value, bak.value);
    } catch {
      /* native storage unavailable: localStorage only */
    }
  }
  return G.pickSave(candidates, now);
}

export function saveGame(state: GameState) {
  if (frozen) return;
  let json: string;
  try {
    json = G.save(state);
  } catch {
    json = G.serialize(state);
  }
  if (!native || json === lastNative) return;
  const prev = lastNative;
  lastNative = json;
  void (async () => {
    try {
      if (prev) await Preferences.set({ key: G.BACKUP_KEY, value: prev });
      await Preferences.set({ key: G.SAVE_KEY, value: json });
    } catch {
      /* kept in localStorage */
    }
  })();
}

/** Replaces the whole game (imported code or fresh start), then restarts the app. */
export async function replaceGame(state: GameState | null, uiKeys: string[] = []) {
  frozen = true;
  const json = state ? G.serialize(state) : null;
  try {
    for (const k of [G.SAVE_KEY, G.BACKUP_KEY, ...uiKeys]) localStorage.removeItem(k);
    if (json) localStorage.setItem(G.SAVE_KEY, json);
  } catch {
    /* native copy below */
  }
  if (native) {
    try {
      await Preferences.remove({ key: G.BACKUP_KEY });
      if (json) await Preferences.set({ key: G.SAVE_KEY, value: json });
      else await Preferences.remove({ key: G.SAVE_KEY });
    } catch {
      /* best effort */
    }
  }
  location.reload();
}

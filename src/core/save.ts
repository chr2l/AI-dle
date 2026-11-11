// Versioned local save (GDD §16).
import { SAVE_VERSION, createInitialState, emptyStats } from './state';
import type { GameState } from './types';
import { cityFromFloors, ensureCity } from './cityGame';

export const SAVE_KEY = 'idleport.save';
/** Previous good save, kept in case the latest write is cut short. */
export const BACKUP_KEY = 'idleport.save.bak';

/** Minimal storage interface so the save works with localStorage, Capacitor or tests. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Upgrades older saves step by step. Add a case for each new SAVE_VERSION. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => void> = {
  // 1 → 2: the tower becomes a flat airport; every floor gets its room around the terminal.
  1: (raw) => {
    raw.city = cityFromFloors(Array.isArray(raw.floors) ? raw.floors.length : 0);
  },
};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Parses a save, migrates it and fills fields added since. Returns null if unreadable. */
export function deserialize(json: string, now: number): GameState | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || typeof raw.version !== 'number') return null;
  if (raw.version > SAVE_VERSION) return null;
  for (let v = raw.version; v < SAVE_VERSION; v++) MIGRATIONS[v]?.(raw);

  const base = createInitialState(now, typeof raw.seed === 'number' ? raw.seed : undefined);
  const state = { ...base, ...raw, version: SAVE_VERSION } as GameState;
  state.stats = { ...emptyStats(), ...state.stats };
  state.resources = { ...base.resources, ...state.resources };
  state.timers = { ...base.timers, ...state.timers };
  ensureCity(state);
  return state;
}

const readable = (json: string | null): json is string => {
  if (!json) return false;
  try {
    return typeof JSON.parse(json)?.version === 'number';
  } catch {
    return false;
  }
};

/** Writes the save; the previous one, if readable, becomes the backup. Returns the JSON written. */
export function save(state: GameState, storage: SaveStorage = localStorage): string {
  const json = serialize(state);
  const prev = storage.getItem(SAVE_KEY);
  if (prev !== json && readable(prev)) storage.setItem(BACKUP_KEY, prev);
  storage.setItem(SAVE_KEY, json);
  return json;
}

/** The most advanced readable save among candidates (latest lastTick), or null. */
export function pickSave(candidates: (string | null | undefined)[], now: number): GameState | null {
  let best: GameState | null = null;
  for (const json of candidates) {
    const state = json ? deserialize(json, now) : null;
    if (state && (!best || state.lastTick > best.lastTick)) best = state;
  }
  return best;
}

/** Loads the save, falling back to the backup when the save is unreadable. */
export function load(now: number, storage: SaveStorage = localStorage): GameState | null {
  return pickSave([storage.getItem(SAVE_KEY), storage.getItem(BACKUP_KEY)], now);
}

// --- Save codes: copy a game to another phone or keep it somewhere safe ------

const CODE_PREFIX = 'IDLEPORT1.';
const RAW_PREFIX = 'IDLEPORT0.';

const toBase64 = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Compressed text code of the game (plain base64 where compression is missing). */
export async function exportCode(state: GameState): Promise<string> {
  const bytes = new TextEncoder().encode(serialize(state));
  if (typeof CompressionStream === 'undefined') return RAW_PREFIX + toBase64(bytes);
  return CODE_PREFIX + toBase64(await pipe(bytes, new CompressionStream('deflate-raw')));
}

/** Reads a save code; null if it is not one or it is damaged. */
export async function importCode(code: string, now: number): Promise<GameState | null> {
  const text = code.replace(/\s+/g, '');
  try {
    if (text.startsWith(RAW_PREFIX)) return deserialize(new TextDecoder().decode(fromBase64(text.slice(RAW_PREFIX.length))), now);
    if (!text.startsWith(CODE_PREFIX) || typeof DecompressionStream === 'undefined') return null;
    const bytes = await pipe(fromBase64(text.slice(CODE_PREFIX.length)), new DecompressionStream('deflate-raw'));
    return deserialize(new TextDecoder().decode(bytes), now);
  } catch {
    return null;
  }
}

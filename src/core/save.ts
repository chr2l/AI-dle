// Versioned local save (GDD §16).
import { SAVE_VERSION, createInitialState, emptyStats } from './state';
import type { GameState } from './types';

export const SAVE_KEY = 'idleport.save';

/** Minimal storage interface so the save works with localStorage, Capacitor or tests. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Upgrades older saves step by step. Add a case for each new SAVE_VERSION. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => void> = {};

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
  return state;
}

export function save(state: GameState, storage: SaveStorage = localStorage) {
  storage.setItem(SAVE_KEY, serialize(state));
}

export function load(now: number, storage: SaveStorage = localStorage): GameState | null {
  const json = storage.getItem(SAVE_KEY);
  return json ? deserialize(json, now) : null;
}

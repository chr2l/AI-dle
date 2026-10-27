// Demo airport for store screenshots and automatic UI captures (?demo=1):
// a mid-game state built with the real engine actions, never saved.
import { CATEGORY_IDS } from './data/shops';
import { destinationsFor } from './destinations';
import { buildFloor, buyPlane, finishBuild, openShop, recruit, assignCrew, restock, sendFlight } from './engine';
import { mulberry32 } from './rng';
import { createInitialState } from './state';
import type { GameState } from './types';

export function demoState(now: number): GameState {
  const rng = mulberry32(42);
  const s = createInitialState(now, 42);
  s.level = 9;
  s.coins = 1e7;
  s.miles = 240;
  s.missionIndex = 15;
  for (let i = 0; i < 8; i++) {
    buildFloor(s, now);
    finishBuild(s, now);
    openShop(s, i, CATEGORY_IDS[i % CATEGORY_IDS.length], rng);
    if (i % 3) restock(s, i, 1, now - 3600_000);
  }
  buyPlane(s, 'libellule', rng);
  buyPlane(s, 'albatros', rng);
  for (let k = 0; k < 3; k++) {
    const m = recruit(s, 'coins', now, rng);
    if (m.ok) assignCrew(s, m.value.uid, s.planes[k % s.planes.length].uid);
  }
  s.discovered = [...new Set([...s.discovered, 'melodia', 'tropicalia'] as const)];
  s.lounge.passengers = 40;
  const dest = destinationsFor(s.seed, 'melodia', now)[0];
  if (dest) sendFlight(s, s.planes[1].uid, dest, now - 60_000);
  s.coins = 2_480_000;
  s.lastTick = now;
  return s;
}

// Top-level loop and onboarding missions.
import { MISSIONS, type MissionDef } from './data/missions';
import { type Result, type TickResult, finishBuild, restockExpress, tick } from './engine';
import { rushCost } from './formulas';
import type { Rng } from './rng';
import type { GameState } from './types';
import { spawnVisitors } from './visitors';

/** One frame of the game: simulation then hall visitors. */
export function update(state: GameState, now: number, rng: Rng = Math.random): TickResult {
  const result = tick(state, now);
  spawnVisitors(state, now, rng);
  return result;
}

export function currentMission(state: GameState): { def: MissionDef; progress: number; done: boolean } | undefined {
  const def = MISSIONS[state.missionIndex];
  if (!def) return undefined;
  const progress = Math.min(def.goal, def.progress(state));
  return { def, progress, done: progress >= def.goal };
}

export function claimMission(state: GameState): Result<MissionDef> {
  const mission = currentMission(state);
  if (!mission) return { ok: false, error: 'Toutes les missions sont terminées.' };
  if (!mission.done) return { ok: false, error: 'Mission pas encore accomplie.' };
  state.miles += mission.def.miles;
  if (mission.def.coins) {
    state.coins += mission.def.coins;
    state.stats.totalCoins += mission.def.coins;
  }
  state.missionIndex++;
  return { ok: true, value: mission.def };
}

export type RushTarget =
  | { kind: 'build' }
  | { kind: 'research' }
  | { kind: 'fusion' }
  | { kind: 'restock'; floor: number }
  | { kind: 'flight'; planeUid: string }
  | { kind: 'repair'; planeUid: string };

/** End timestamp of what the player wants to speed up, if it is running. */
function rushEnd(state: GameState, target: RushTarget): number | undefined {
  switch (target.kind) {
    case 'build':
      return state.floors.find((f) => f.buildEndsAt !== undefined)?.buildEndsAt;
    case 'research':
      return state.researching?.endsAt;
    case 'fusion':
      return state.fusion?.endsAt;
    case 'restock':
      return state.floors[target.floor]?.shop?.restock?.endsAt;
    case 'flight':
      return state.planes.find((p) => p.uid === target.planeUid)?.flight?.endsAt;
    case 'repair':
      return state.planes.find((p) => p.uid === target.planeUid)?.repairEndsAt;
  }
}

export function rushPrice(state: GameState, target: RushTarget, now: number): number | undefined {
  const end = rushEnd(state, target);
  return end === undefined || end <= now ? undefined : rushCost((end - now) / 1000);
}

/** Finishes a timer right away for Miles (1 ✈️ per started 10 min). */
export function rush(state: GameState, target: RushTarget, now: number): Result {
  const price = rushPrice(state, target, now);
  if (price === undefined) return { ok: false, error: 'Rien à accélérer.' };
  if (state.miles < price) return { ok: false, error: 'Pas assez de Miles.' };
  state.miles -= price;
  switch (target.kind) {
    case 'build':
      return finishBuild(state, now);
    case 'restock':
      return restockExpress(state, target.floor, 0, now);
    case 'research':
      state.researching!.endsAt = now;
      break;
    case 'fusion':
      state.fusion!.endsAt = now;
      break;
    case 'flight':
      state.planes.find((p) => p.uid === target.planeUid)!.flight!.endsAt = now;
      break;
    case 'repair':
      state.planes.find((p) => p.uid === target.planeUid)!.repairEndsAt = now;
      break;
  }
  tick(state, now);
  return { ok: true, value: undefined };
}

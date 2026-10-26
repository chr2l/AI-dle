// Top-level loop and onboarding missions.
import { MISSIONS, type MissionDef } from './data/missions';
import { type Result, type TickResult, tick } from './engine';
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

// Franchise (prestige, GDD §14): sell the airport, open a new one, keep Alliance stars.
import { type Result } from './engine';
import { FRANCHISE_LEVEL, allianceStars } from './formulas';
import { createInitialState } from './state';
import type { GameState } from './types';

/** Stars the player would gain by opening a franchise now. */
export function pendingStars(state: GameState): number {
  return Math.max(0, allianceStars(state.stats.totalCoins) - state.prestige.stars);
}

export function canFranchise(state: GameState): Result<number> {
  if (state.level < FRANCHISE_LEVEL) return { ok: false, error: `La Franchise se débloque au niveau ${FRANCHISE_LEVEL}.` };
  const stars = pendingStars(state);
  if (stars < 1) return { ok: false, error: 'Pas encore assez de pièces gagnées pour une nouvelle étoile.' };
  return { ok: true, value: stars };
}

/**
 * Starts over in a new city. Kept: Alliance stars, Miles, legendary crew,
 * Carnet VIP, album, achievements, lifetime stats, daily streak and quests,
 * colors, onboarding progress. Everything else restarts.
 */
export function franchise(state: GameState, now: number): Result<GameState> {
  const check = canFranchise(state);
  if (!check.ok) return check;
  const next = createInitialState(now, state.seed + 1);
  const legends = state.crew.filter((c) => c.rarity === 'L').map((c) => ({ ...c, planeUid: undefined }));
  Object.assign(next, {
    miles: state.miles,
    crew: legends,
    carnet: state.carnet,
    album: state.album,
    achievements: state.achievements,
    stats: state.stats,
    daily: state.daily,
    quests: state.quests,
    missionIndex: state.missionIndex,
    cooldowns: state.cooldowns,
    facadeColor: state.facadeColor,
    lobbyColor: state.lobbyColor,
    prestige: { stars: state.prestige.stars + check.value, count: state.prestige.count + 1, runStartedAt: now },
  } satisfies Partial<GameState>);
  return { ok: true, value: next };
}

// Seasonal reward track (GDD §19).
import { syncSeason } from './calendar';
import { SEASON_TRACK, type SeasonReward } from './data/seasons';
import { type Result, rollCrewMember } from './engine';
import { MAX_CREW } from './formulas';
import type { Rng } from './rng';
import type { GameState } from './types';

const fail = (error: string): Result<never> => ({ ok: false, error });

export function seasonView(state: GameState, now: number) {
  const season = syncSeason(state, now);
  if (!season) return undefined;
  return {
    season,
    points: state.season.points,
    track: SEASON_TRACK.map((step, i) => ({
      ...step,
      reached: state.season.points >= step.points,
      claimed: state.season.claimed.includes(i),
    })),
  };
}

export function claimSeasonReward(state: GameState, index: number, now: number, rng: Rng = Math.random): Result<SeasonReward> {
  const season = syncSeason(state, now);
  if (!season) return fail('Aucun événement saisonnier en cours.');
  const step = SEASON_TRACK[index];
  if (!step) return fail('Palier inconnu.');
  if (state.season.claimed.includes(index)) return fail('Déjà récupéré.');
  if (state.season.points < step.points) return fail('Pas encore assez de points.');
  const reward = step.reward;
  switch (reward.kind) {
    case 'miles':
      state.miles += reward.amount;
      break;
    case 'coins': {
      const coins = reward.perLevel * state.level;
      state.coins += coins;
      state.stats.totalCoins += coins;
      break;
    }
    case 'recruit':
      if (state.crew.length < MAX_CREW) {
        state.crew.push(rollCrewMember(rng, reward.premium ? 'premium' : 'standard'));
        state.stats.recruits++;
      } else state.miles += reward.premium ? 30 : 5;
      break;
    case 'shop':
      state.plans.push(season.def.shopId);
      break;
    case 'trophy':
      state.miles += reward.miles;
      state.season.trophies.push(`${season.def.id}-${season.year}`);
      break;
  }
  state.season.claimed.push(index);
  return { ok: true, value: reward };
}


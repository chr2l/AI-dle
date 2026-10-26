// Seasonal calendar (GDD §19): which themed event runs at a given time.
import { SEASONS, type SeasonDef } from './data/seasons';
import type { CountryId, GameState } from './types';

export interface ActiveSeason {
  def: SeasonDef;
  /** Year the season started in (Noël runs over New Year). */
  year: number;
  startsAt: number;
  endsAt: number;
}

const at = (year: number, [month, day]: [number, number], endOfDay = false) =>
  Date.UTC(year, month - 1, day) + (endOfDay ? 24 * 3600 * 1000 : 0);

function windowFor(def: SeasonDef, year: number): [number, number] {
  const wraps = def.end[0] < def.start[0];
  return [at(year, def.start), at(wraps ? year + 1 : year, def.end, true)];
}

export function activeSeason(now: number): ActiveSeason | undefined {
  const year = new Date(now).getUTCFullYear();
  for (const def of SEASONS) {
    for (const y of [year - 1, year]) {
      const [startsAt, endsAt] = windowFor(def, y);
      if (now >= startsAt && now < endsAt) return { def, year: y, startsAt, endsAt };
    }
  }
  return undefined;
}

/** Next season to come, for the "coming soon" banner. */
export function nextSeason(now: number): ActiveSeason {
  const year = new Date(now).getUTCFullYear();
  const upcoming = [year, year + 1].flatMap((y) =>
    SEASONS.map((def) => {
      const [startsAt, endsAt] = windowFor(def, y);
      return { def, year: y, startsAt, endsAt };
    }),
  );
  return upcoming.filter((s) => s.startsAt > now).sort((a, b) => a.startsAt - b.startsAt)[0];
}

/** Resets the seasonal progress when a new season (or a new edition) starts. */
export function syncSeason(state: GameState, now: number): ActiveSeason | undefined {
  const season = activeSeason(now);
  const id = season?.def.id ?? null;
  const year = season?.year ?? 0;
  if (state.season.id !== id || state.season.year !== year) {
    state.season = { ...state.season, id, year, points: 0, claimed: [] };
  }
  return season;
}

/** Points earned per collected flight: 2 × ring, doubled towards the season's country. */
export function seasonFlightPoints(now: number, ring: number, countryId: CountryId): number {
  const season = activeSeason(now);
  if (!season) return 0;
  return 2 * ring * (season.def.country === countryId ? 2 : 1);
}

export function addSeasonPoints(state: GameState, points: number, now: number) {
  if (points <= 0 || !syncSeason(state, now)) return;
  state.season.points += points;
}

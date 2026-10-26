import { COUNTRIES, COUNTRY_BY_ID, RING_DISTANCES } from './data/countries';
import { DESTINATIONS_PER_COUNTRY, DESTINATION_WINDOW_MS, FEATURED, MODIFIER_INFO, MYSTERY_CHANCE, WEEK_MS } from './formulas';
import { hashString, mulberry32, pick, pickWeighted } from './rng';
import type { CountryId, Destination, DestinationModifier } from './types';

const ROLLED_MODIFIERS = (Object.keys(MODIFIER_INFO) as DestinationModifier[]).filter((m) => m !== 'mystere');

/**
 * The 3 destinations a country offers right now. Deterministic for a given
 * (player seed, country, 4 h window), so they survive reloads.
 */
export function destinationsFor(seed: number, countryId: CountryId, now: number): Destination[] {
  const country = COUNTRY_BY_ID[countryId];
  const window = Math.floor(now / DESTINATION_WINDOW_MS);
  const rng = mulberry32(hashString(`${seed}:${countryId}:${window}`));
  const [min, max] = RING_DISTANCES[country.ring];
  const names = new Set<string>();
  const out: Destination[] = [];
  for (let i = 0; i < DESTINATIONS_PER_COUNTRY; i++) {
    let name = '';
    for (let tries = 0; tries < 10 && (!name || names.has(name)); tries++) {
      name = pick(rng, country.prefixes) + pick(rng, country.suffixes);
    }
    names.add(name);
    const distance = Math.round((min + rng() * (max - min)) / 10) * 10;
    const modifier: DestinationModifier =
      rng() < MYSTERY_CHANCE ? 'mystere' : pickWeighted(rng, ROLLED_MODIFIERS, (m) => MODIFIER_INFO[m].weight);
    out.push({ id: `${countryId}-${window}-${i}`, countryId, name, distance, modifier });
  }
  return out;
}

/** Milliseconds until the destinations are regenerated. */
export function msUntilNewDestinations(now: number): number {
  return DESTINATION_WINDOW_MS - (now % DESTINATION_WINDOW_MS);
}

/** Country of the week, the same for every player (weeks start on Monday 00:00 UTC). */
export function featuredCountry(now: number): CountryId {
  const week = Math.floor((now - 4 * 24 * 3600 * 1000) / WEEK_MS); // 1970-01-01 was a Thursday
  return COUNTRIES[((week % COUNTRIES.length) + COUNTRIES.length) % COUNTRIES.length].id;
}

export function featuredMult(countryId: CountryId, now: number): { coins: number; resource: number; vipChance: number } {
  return featuredCountry(now) === countryId ? FEATURED : { coins: 1, resource: 1, vipChance: 1 };
}

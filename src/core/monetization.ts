// Every ad / in-app purchase goes through here (GDD §13).
// Current version: no SDK plugged in, every rewarded ad succeeds immediately.
import type { GameState } from './types';

export type AdSlot =
  | 'skip_build'
  | 'restock_express'
  | 'tailwind'
  | 'double_collect'
  | 'free_recruit'
  | 'reroll_shop'
  | 'offline_x2'
  | 'repair';

/** Minimum delay between two ads on the same slot (the other limits live in the engine: once per flight, per floor…). */
export const AD_COOLDOWN_MS: Partial<Record<AdSlot, number>> = {
  skip_build: 10 * 60 * 1000,
  restock_express: 5 * 60 * 1000,
  repair: 10 * 60 * 1000,
};
export const MAX_ADS_PER_DAY = 30;
const DAY_MS = 24 * 3600 * 1000;

export function adsLeftToday(state: GameState, now: number): number {
  const sameDay = state.cooldowns.ads_day === Math.floor(now / DAY_MS);
  return MAX_ADS_PER_DAY - (sameDay ? state.cooldowns.ads_count ?? 0 : 0);
}

export function adAvailable(state: GameState, slot: AdSlot, now: number): boolean {
  return adsLeftToday(state, now) > 0 && now >= (state.cooldowns[`ad:${slot}`] ?? 0);
}

/** Call after a rewarded ad was watched, before granting its reward. */
export function recordAd(state: GameState, slot: AdSlot, now: number) {
  const day = Math.floor(now / DAY_MS);
  if (state.cooldowns.ads_day !== day) {
    state.cooldowns.ads_day = day;
    state.cooldowns.ads_count = 0;
  }
  state.cooldowns.ads_count = (state.cooldowns.ads_count ?? 0) + 1;
  const cooldown = AD_COOLDOWN_MS[slot];
  if (cooldown) state.cooldowns[`ad:${slot}`] = now + cooldown;
}

/** Shows a rewarded ad and resolves true when the reward must be granted. */
export async function showRewardedAd(_slot: AdSlot): Promise<boolean> {
  return true;
}

export interface IapPack {
  id: string;
  name: string;
  /** Display price in euros, until the store gives localized prices. */
  priceEur: number;
  miles?: number;
  coins?: number;
}

export const IAP_PACKS: IapPack[] = [
  { id: 'miles_small', name: 'Poignée de Miles', priceEur: 1.99, miles: 60 },
  { id: 'miles_medium', name: 'Sac de Miles', priceEur: 4.99, miles: 170 },
  { id: 'miles_big', name: 'Valise de Miles', priceEur: 9.99, miles: 380 },
  { id: 'miles_huge', name: 'Soute de Miles', priceEur: 19.99, miles: 850 },
  { id: 'starter', name: 'Pack de départ (une fois)', priceEur: 2.99, miles: 100, coins: 20000 },
];

/** Buys an in-app pack and resolves true when the content must be granted. */
export async function purchase(_packId: string): Promise<boolean> {
  return true;
}

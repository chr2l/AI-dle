// Every ad / in-app purchase goes through here (GDD §13).
// Current version: no SDK plugged in, every rewarded ad succeeds immediately.
import type { GameState } from './types';

/** Pass Commandant: rewards of ads without the daily limit, +10 % shop income, forever. */
export const PASS_ID = 'pass';
export const PASS_INCOME_PCT = 0.1;
/** Ad boost: shop sales earn ×2 for 4 h per ad, up to 12 h stacked. */
export const BOOST_HOURS = 4;
export const BOOST_MAX_HOURS = 12;

export type AdSlot =
  | 'skip_build'
  | 'restock_express'
  | 'tailwind'
  | 'double_collect'
  | 'free_recruit'
  | 'reroll_shop'
  | 'offline_x2'
  | 'repair'
  | 'free_box'
  | 'boost';

/** Minimum delay between two ads on the same slot (the other limits live in the engine: once per flight, per floor…). */
export const AD_COOLDOWN_MS: Partial<Record<AdSlot, number>> = {
  skip_build: 10 * 60 * 1000,
  restock_express: 5 * 60 * 1000,
  repair: 10 * 60 * 1000,
};
export const MAX_ADS_PER_DAY = 30;
const DAY_MS = 24 * 3600 * 1000;

export function adsLeftToday(state: GameState, now: number): number {
  if (state.purchases?.includes(PASS_ID)) return Infinity;
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
  /** Can be bought only once. */
  once?: boolean;
}

export const IAP_PACKS: IapPack[] = [
  { id: 'miles_small', name: 'Poignée de Miles', priceEur: 1.99, miles: 60 },
  { id: 'miles_medium', name: 'Sac de Miles', priceEur: 4.99, miles: 170 },
  { id: 'miles_big', name: 'Valise de Miles', priceEur: 9.99, miles: 380 },
  { id: 'miles_huge', name: 'Soute de Miles', priceEur: 19.99, miles: 850 },
  { id: 'starter', name: 'Pack de départ', priceEur: 2.99, miles: 100, coins: 20000, once: true },
  { id: PASS_ID, name: 'Pass Commandant', priceEur: 7.99, once: true },
];

/** Starter pack is offered from this level (never at the very first launch). */
export const STARTER_LEVEL = 5;

/** Packs the shop shows now: one-time packs disappear once bought. */
export function shopPacks(state: GameState): IapPack[] {
  return IAP_PACKS.filter((p) => !(p.once && state.purchases.includes(p.id)) && !(p.id === 'starter' && state.level < STARTER_LEVEL && !state.prestige.count));
}

/** Grants a pack after the store confirmed the payment. */
export function grantPack(state: GameState, packId: string): { ok: true; value: IapPack } | { ok: false; error: string } {
  const pack = IAP_PACKS.find((p) => p.id === packId);
  if (!pack) return { ok: false, error: 'Offre inconnue.' };
  if (pack.once && state.purchases.includes(pack.id)) return { ok: false, error: 'Déjà acheté.' };
  state.miles += pack.miles ?? 0;
  state.coins += pack.coins ?? 0;
  if (pack.once) state.purchases.push(pack.id);
  return { ok: true, value: pack };
}

/** Rewarded ad « Boost ×2 »: shop sales earn double for 4 more hours (12 h max). */
export function adBoost(state: GameState, now: number): { ok: true; value: number } | { ok: false; error: string } {
  if (!adAvailable(state, 'boost', now)) return { ok: false, error: 'Plus de pub disponible aujourd’hui.' };
  const until = Math.max(now, state.boosts.coinsX2Until ?? 0);
  if (until - now > (BOOST_MAX_HOURS - BOOST_HOURS) * 3600_000) return { ok: false, error: `Boost déjà au maximum (${BOOST_MAX_HOURS} h).` };
  recordAd(state, 'boost', now);
  state.boosts.coinsX2Until = until + BOOST_HOURS * 3600_000;
  return { ok: true, value: state.boosts.coinsX2Until };
}

/** Buys an in-app pack and resolves true when the content must be granted. */
export async function purchase(_packId: string): Promise<boolean> {
  return true;
}

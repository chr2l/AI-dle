// Gambling on shop rarity (GDD §22): plan boxes and the rarity bet on a fresh floor.
// Odds are always shown to the player, boxes are never sold for real money directly,
// and a pity timer guarantees a legendary every PITY_BOXES boxes.
import { RARITY_INFO, SHOPS, SHOP_BY_ID, type ShopDef } from './data/shops';
import { type Payment, type Result, recordAlbum } from './engine';
import { type Rng, pickWeighted } from './rng';
import type { GameState, Rarity, ShopCategory } from './types';

const fail = (error: string): Result<never> => ({ ok: false, error });

export const RARITIES: Rarity[] = ['C', 'R', 'E', 'L'];

export type BoxId = 'bronze' | 'argent' | 'or';

export interface BoxDef {
  id: BoxId;
  name: string;
  emoji: string;
  /** Odds by rarity, in %. */
  odds: Record<Rarity, number>;
}

export const BOXES: BoxDef[] = [
  { id: 'bronze', name: 'Caisse de chantier', emoji: '📦', odds: { C: 55, R: 32, E: 11, L: 2 } },
  { id: 'argent', name: 'Coffre d’architecte', emoji: '🧰', odds: { C: 0, R: 65, E: 30, L: 5 } },
  { id: 'or', name: 'Malle du magnat', emoji: '💼', odds: { C: 0, R: 0, E: 80, L: 20 } },
];
export const BOX_BY_ID = Object.fromEntries(BOXES.map((b) => [b.id, b])) as Record<BoxId, BoxDef>;

export const bronzeBoxCoins = (level: number) => 250 * level * level;
export const BOX_MILES: Record<BoxId, number> = { bronze: 5, argent: 15, or: 40 };
/** A legendary is guaranteed on the 30th box without one. */
export const PITY_BOXES = 30;
/** One free bronze box per ad every 6 h. */
export const FREE_BOX_COOLDOWN_MS = 6 * 3600 * 1000;

/** Shops a box or a bet can give: neutral and discovered countries, every rarity (no fusion or seasonal shops). */
export function gamblePool(state: GameState, category?: ShopCategory): ShopDef[] {
  return SHOPS.filter(
    (d) =>
      !d.fusionOnly &&
      (!category || d.category === category) &&
      d.elements.every((e) => e === 'neutre' || state.discovered.includes(e)),
  );
}

/** Coins for the bronze box, Miles for the others. */
export function boxCost(state: GameState, boxId: BoxId): { coins?: number; miles?: number } {
  return boxId === 'bronze' ? { coins: bronzeBoxCoins(state.level), miles: BOX_MILES.bronze } : { miles: BOX_MILES[boxId] };
}

/**
 * Effective odds shown to the player: a rarity with no shop in the pool gives
 * its share to the next rarity down (or up when there is none below).
 */
export function boxOdds(state: GameState, boxId: BoxId): { rarity: Rarity; chance: number; shops: ShopDef[] }[] {
  const pool = gamblePool(state);
  const shopsOf = (r: Rarity) => pool.filter((d) => d.rarity === r);
  const odds: Record<Rarity, number> = { ...BOX_BY_ID[boxId].odds };
  for (let i = RARITIES.length - 1; i >= 0; i--) {
    const r = RARITIES[i];
    if (odds[r] === 0 || shopsOf(r).length > 0) continue;
    const below = RARITIES.slice(0, i).reverse().find((x) => shopsOf(x).length > 0);
    const above = RARITIES.slice(i + 1).find((x) => shopsOf(x).length > 0);
    const target = below ?? above;
    if (target) odds[target] += odds[r];
    odds[r] = 0;
  }
  return RARITIES.filter((r) => odds[r] > 0).map((r) => ({ rarity: r, chance: odds[r] / 100, shops: shopsOf(r) }));
}

export function freeBoxReadyAt(state: GameState): number {
  return state.cooldowns.free_box ?? 0;
}

/** Opens a box: the shop won becomes a plan (place it on a floor or use it as a star). */
export function openBox(
  state: GameState,
  boxId: BoxId,
  payment: Payment,
  now: number,
  rng: Rng = Math.random,
): Result<{ defId: string; rarity: Rarity; duplicate: boolean; pity: boolean }> {
  if (!BOX_BY_ID[boxId]) return fail('Boîte inconnue.');
  const cost = boxCost(state, boxId);
  if (payment === 'ad') {
    if (boxId !== 'bronze') return fail('Seule la caisse de chantier s’ouvre avec une pub.');
    if (now < freeBoxReadyAt(state)) return fail('Caisse gratuite pas encore prête.');
    state.cooldowns.free_box = now + FREE_BOX_COOLDOWN_MS;
  } else if (payment === 'coins') {
    if (cost.coins === undefined) return fail('Cette boîte se paie en Miles.');
    if (state.coins < cost.coins) return fail('Pas assez de pièces.');
    state.coins -= cost.coins;
  } else {
    if (state.miles < cost.miles!) return fail('Pas assez de Miles.');
    state.miles -= cost.miles!;
  }

  const odds = boxOdds(state, boxId);
  const legendary = odds.find((o) => o.rarity === 'L');
  const pity = state.gamble.pity + 1 >= PITY_BOXES && !!legendary;
  const tier = pity ? legendary! : pickWeighted(rng, odds, (o) => o.chance);
  const def = tier.shops[Math.floor(rng() * tier.shops.length)];
  const duplicate = state.album.includes(def.id);

  state.gamble.pity = def.rarity === 'L' ? 0 : state.gamble.pity + 1;
  state.plans.push(def.id);
  recordAlbum(state, def.id);
  state.stats.boxesOpened++;
  return { ok: true, value: { defId: def.id, rarity: def.rarity, duplicate, pity } };
}

// --- Rarity bet on a fresh floor -------------------------------------------------

/** Chance to climb one rarity with the safe stake. The risky stake multiplies it by 1.5. */
export const BET_CHANCE: Record<Rarity, number> = { C: 0.4, R: 0.25, E: 0.1, L: 0 };
export const RISKY_BET_MULT = 1.5;
export const betCost = (level: number, rarity: Rarity) => 200 * level * level * RARITY_INFO[rarity].rank;

function freshShop(state: GameState, floorIndex: number) {
  const shop = state.floors[floorIndex]?.shop;
  if (!shop || shop.level > 1 || shop.stock > 0 || shop.restock) return undefined;
  return shop;
}

const neighbour = (rarity: Rarity, step: 1 | -1): Rarity | undefined => RARITIES[RARITIES.indexOf(rarity) + step];

export interface RarityBetView {
  from: Rarity;
  to: Rarity;
  chance: number;
  cost: number;
  /** Undefined when the shop cannot lose a rarity (commons). */
  riskyChance?: number;
}

/** What a bet on this floor would look like, or undefined if the floor cannot bet. */
export function rarityBetView(state: GameState, floorIndex: number): RarityBetView | undefined {
  const shop = freshShop(state, floorIndex);
  if (!shop) return undefined;
  const def = SHOP_BY_ID[shop.defId];
  const to = neighbour(def.rarity, 1);
  if (!to || !gamblePool(state, def.category).some((d) => d.rarity === to)) return undefined;
  const chance = BET_CHANCE[def.rarity];
  const canDrop = gamblePool(state, def.category).some((d) => d.rarity === neighbour(def.rarity, -1));
  return {
    from: def.rarity,
    to,
    chance,
    cost: betCost(state.level, def.rarity),
    riskyChance: canDrop ? Math.min(1, chance * RISKY_BET_MULT) : undefined,
  };
}

/**
 * Bets on a fresh shop (level 1, never stocked) to climb one rarity in the same category.
 * 'sure': paid in coins, a loss keeps the shop. 'risquee': free and 1.5× the chance, a loss drops one rarity.
 */
export function rarityBet(
  state: GameState,
  floorIndex: number,
  stake: 'sure' | 'risquee',
  rng: Rng = Math.random,
): Result<{ won: boolean; defId: string; from: Rarity; to: Rarity }> {
  const view = rarityBetView(state, floorIndex);
  if (!view) return fail('Pari impossible sur cet étage (magasin déjà en activité ou rareté maximale).');
  const shop = state.floors[floorIndex].shop!;
  const category = SHOP_BY_ID[shop.defId].category;
  let chance = view.chance;
  if (stake === 'sure') {
    if (state.coins < view.cost) return fail('Pas assez de pièces.');
    state.coins -= view.cost;
  } else {
    if (view.riskyChance === undefined) return fail('Mise risquée impossible sur un magasin commun.');
    chance = view.riskyChance;
  }
  const won = rng() < chance;
  const target = won ? view.to : stake === 'risquee' ? neighbour(view.from, -1)! : view.from;
  if (target !== view.from) {
    const options = gamblePool(state, category).filter((d) => d.rarity === target);
    shop.defId = options[Math.floor(rng() * options.length)].id;
    recordAlbum(state, shop.defId);
  }
  if (won) state.stats.betsWon++;
  return { ok: true, value: { won, defId: shop.defId, from: view.from, to: target } };
}

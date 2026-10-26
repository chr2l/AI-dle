// Shop fusion and blueprints (GDD §4.6).
import { RARITY_INFO, SHOPS, SHOP_BY_ID, type ShopDef } from './data/shops';
import { type Result, addStar, recordAlbum } from './engine';
import { FUSION_LEVEL, fusionCost, fusionDuration } from './formulas';
import { type Rng, pickWeighted } from './rng';
import type { GameState } from './types';

const fail = (error: string): Result<never> => ({ ok: false, error });

/** Every shop a fusion of A and B can give: elements ⊆ elements(A) ∪ elements(B). */
export function fusionResults(a: ShopDef, b: ShopDef): ShopDef[] {
  const elements = new Set([...a.elements, ...b.elements]);
  return SHOPS.filter((d) => d.elements.every((e) => elements.has(e)));
}

/** Fuses the shops of two floors. The shops stay; the result becomes a blueprint. */
export function startFusion(state: GameState, floorA: number, floorB: number, now: number, rng: Rng = Math.random): Result<string> {
  if (state.level < FUSION_LEVEL) return fail(`La fusion se débloque au niveau ${FUSION_LEVEL}.`);
  if (state.fusion) return fail('Une fusion est déjà en cours.');
  const a = state.floors[floorA]?.shop;
  const b = state.floors[floorB]?.shop;
  if (!a || !b || floorA === floorB) return fail('Choisissez deux magasins.');
  const defA = SHOP_BY_ID[a.defId];
  const defB = SHOP_BY_ID[b.defId];
  const rankA = RARITY_INFO[defA.rarity].rank;
  const rankB = RARITY_INFO[defB.rarity].rank;
  const cost = fusionCost(rankA, rankB);
  if (state.coins < cost) return fail('Pas assez de pièces.');
  state.coins -= cost;
  const result = pickWeighted(rng, fusionResults(defA, defB), (d) => RARITY_INFO[d.rarity].weight);
  state.fusion = { a: defA.id, b: defB.id, resultId: result.id, endsAt: now + fusionDuration(rankA, rankB) * 1000 };
  return { ok: true, value: result.id };
}

/** Opens the blueprint's shop on an empty built floor. */
export function placePlan(state: GameState, planIndex: number, floorIndex: number): Result {
  const defId = state.plans[planIndex];
  const floor = state.floors[floorIndex];
  if (!defId) return fail('Plan introuvable.');
  if (!floor || floor.buildEndsAt !== undefined) return fail("Cet étage n'est pas construit.");
  if (floor.shop) return fail('Cet étage a déjà un magasin.');
  floor.shop = { defId, level: 1, stars: 1, stock: 0 };
  recordAlbum(state, defId);
  state.plans.splice(planIndex, 1);
  state.stats.shopsOpened++;
  return { ok: true, value: undefined };
}

/** Uses the blueprint as a duplicate: +1 star on the same shop. */
export function planAsStar(state: GameState, planIndex: number, floorIndex: number): Result {
  const defId = state.plans[planIndex];
  if (!defId) return fail('Plan introuvable.');
  if (state.floors[floorIndex]?.shop?.defId !== defId) return fail('Il faut le même magasin.');
  const res = addStar(state, floorIndex);
  if (res.ok) state.plans.splice(planIndex, 1);
  return res;
}

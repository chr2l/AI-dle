// Derived values computed from the state (never stored in the save).
import { PASS_ID, PASS_INCOME_PCT } from './monetization';
import { roomMultiplier } from './cityGame';
import { COUNTRY_BY_ID } from './data/countries';
import { CREW_RARITY, TRAIT_BY_ID } from './data/crew';
import { MODULES, MODULE_BY_ID, PLANE_BY_ID } from './data/planes';
import { DECO_BY_ID, TECH_BY_ID, type DecoDef } from './data/research';
import { RARITY_INFO, SHOPS, SHOP_BY_ID, type ShopDef } from './data/shops';
import {
  ALBUM_FUSION_BONUS,
  ALBUM_SET_BONUS,
  PRESTIGE_STAR_BONUS,
  AFFINITY_BONUS,
  CABIN_COMFORT_PER_POINT,
  CARNET_BONUS,
  MAX_RELIABILITY,
  MECHANIC_RELIABILITY_PER_POINT,
  MODULE_EVENT_BONUS,
  PILOT_SPEED_PER_POINT,
  TRAFFIC_BONUS,
  UPGRADE_STEP,
  arrivalsPerSec,
  loungeCapacity,
  vipMinComfort,
} from './formulas';
import type { CountryId, CrewMember, Element, CrewRole, GameState, PlaneState, ShopCategory, StatKey, VipState } from './types';

// --- Research effects ----------------------------------------------------------

type DecoBonus = Required<Pick<DecoDef, 'arrivalsPct' | 'shopIncomePct' | 'ticketPct' | 'loungeCap' | 'repairPct' | 'flightSpeedPct' | 'vipChancePct'>>;

export function decoBonuses(state: GameState): DecoBonus {
  const total: DecoBonus = {
    arrivalsPct: 0, shopIncomePct: 0, ticketPct: 0, loungeCap: 0, repairPct: 0, flightSpeedPct: 0, vipChancePct: 0,
  };
  for (const techId of state.research) {
    const effect = TECH_BY_ID[techId]?.effect;
    if (effect?.type !== 'deco') continue;
    const deco = DECO_BY_ID[effect.decoId];
    for (const key of Object.keys(total) as (keyof DecoBonus)[]) total[key] += deco[key] ?? 0;
  }
  return total;
}

export function researchedModules(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const techId of state.research) {
    const effect = TECH_BY_ID[techId]?.effect;
    if (effect?.type === 'module') out.add(effect.moduleId);
  }
  return out;
}

/** Extra resource share from the country's first technology (+10 %). */
export function resourceBonus(state: GameState, countryId: CountryId): number {
  let bonus = 0;
  for (const techId of state.research) {
    const tech = TECH_BY_ID[techId];
    if (tech?.countryId === countryId && tech.effect.type === 'shop') bonus += tech.effect.resourcePct ?? 0;
  }
  return bonus;
}

/** Franchise: each Alliance star gives +5 % shop and ticket income. */
export function prestigeMult(state: GameState): number {
  return 1 + PRESTIGE_STAR_BONUS * state.prestige.stars;
}

/** Album sets: each country whose shops were all opened once, and the fusion set. */
export function albumSets(state: GameState): { id: Element | 'fusion'; owned: number; total: number }[] {
  const owned = new Set(state.album);
  const sets = new Map<Element | 'fusion', { owned: number; total: number }>();
  for (const def of SHOPS) {
    const key = def.fusionOnly ? 'fusion' : def.elements[0];
    const set = sets.get(key) ?? { owned: 0, total: 0 };
    set.total++;
    if (owned.has(def.id)) set.owned++;
    sets.set(key, set);
  }
  return [...sets].map(([id, v]) => ({ id, ...v }));
}

export function albumBonus(state: GameState): number {
  return albumSets(state).reduce(
    (sum, s) => sum + (s.owned === s.total ? (s.id === 'fusion' ? ALBUM_FUSION_BONUS : ALBUM_SET_BONUS) : 0),
    0,
  );
}

export function carnetBonus(state: GameState): number {
  return Object.keys(state.carnet).length * CARNET_BONUS;
}

// --- Shops -------------------------------------------------------------------

/** Shops that can come out of a draw: neutral, discovered countries' commons, researched and event unlocks. */
export function shopPool(state: GameState, category?: ShopCategory): ShopDef[] {
  const extra = new Set(state.bonusShops);
  for (const techId of state.research) {
    const effect = TECH_BY_ID[techId]?.effect;
    if (effect?.type === 'shop') extra.add(effect.shopId);
  }
  return SHOPS.filter((def) => {
    if (def.fusionOnly) return false;
    if (category && def.category !== category) return false;
    if (def.elements.includes('neutre')) return true;
    if (extra.has(def.id)) return true;
    return def.rarity === 'C' && def.elements.some((e) => e !== 'neutre' && state.discovered.includes(e));
  });
}


/** Coins per second sold by the shop on this floor while it has stock. */
export function shopRate(state: GameState, floorIndex: number): number {
  const shop = state.floors[floorIndex]?.shop;
  if (!shop) return 0;
  const def = SHOP_BY_ID[shop.defId];
  return (
    RARITY_INFO[def.rarity].rate *
    1.25 ** (shop.level - 1) *
    (1 + 0.5 * (shop.stars - 1)) *
    (1 + TRAFFIC_BONUS * (state.level - 1)) *
    roomMultiplier(state, floorIndex) *
    (1 + decoBonuses(state).shopIncomePct + carnetBonus(state) + albumBonus(state)) *
    prestigeMult(state) *
    (state.purchases?.includes(PASS_ID) ? 1 + PASS_INCOME_PCT : 1)
  );
}

export function totalShopRate(state: GameState): number {
  return state.floors.reduce((sum, _f, i) => sum + shopRate(state, i), 0);
}

export function openShopCount(state: GameState): number {
  return state.floors.filter((f) => f.shop).length;
}

// --- Lounge ------------------------------------------------------------------

export function loungeCap(state: GameState): number {
  return loungeCapacity(state.lounge.level) + decoBonuses(state).loungeCap;
}

export function arrivalRate(state: GameState): number {
  return arrivalsPerSec(openShopCount(state)) * (1 + decoBonuses(state).arrivalsPct);
}

// --- Crew --------------------------------------------------------------------

export function crewOf(state: GameState, plane: PlaneState): CrewMember[] {
  return Object.values(plane.crew)
    .map((uid) => state.crew.find((c) => c.uid === uid))
    .filter((c): c is CrewMember => !!c);
}

function seat(state: GameState, plane: PlaneState, role: CrewRole): CrewMember | undefined {
  const uid = plane.crew[role];
  return uid ? state.crew.find((c) => c.uid === uid) : undefined;
}

/** power × level, the base of every seat bonus. */
export function crewPoints(member: CrewMember | undefined): number {
  return member ? CREW_RARITY[member.rarity].power * member.level : 0;
}

function traitSum(members: CrewMember[], key: 'speedPct' | 'coinsPct' | 'xpPct' | 'repairPct' | 'luck'): number {
  return members.reduce(
    (sum, m) => sum + m.traits.reduce((s, t) => s + (TRAIT_BY_ID[t]?.[key] ?? 0), 0),
    0,
  );
}

// --- Planes ------------------------------------------------------------------

export type PlaneStats = Record<StatKey, number> & { ticketPct: number };

export function planeStats(state: GameState, plane: PlaneState): PlaneStats {
  const model = PLANE_BY_ID[plane.modelId];
  const up = plane.upgrades;
  const modules = plane.modules.filter((m): m is string => !!m).map((id) => MODULE_BY_ID[id]);
  const crew = crewOf(state, plane);
  const sum = (key: 'comfort' | 'speedPct' | 'rangePct' | 'reliability' | 'ticketPct') =>
    modules.reduce((s, m) => s + (m[key] ?? 0), 0);

  const speed =
    model.speed *
    (1 + UPGRADE_STEP.speed * up.speed) *
    (1 + sum('speedPct') + PILOT_SPEED_PER_POINT * crewPoints(seat(state, plane, 'pilot')) +
      traitSum(crew, 'speedPct') + decoBonuses(state).flightSpeedPct);
  const capacity = Math.round(model.capacity * (1 + UPGRADE_STEP.capacity * up.capacity));
  const range = model.range * (1 + UPGRADE_STEP.range * up.range) * (1 + sum('rangePct'));
  const comfort =
    model.comfort + UPGRADE_STEP.comfort * up.comfort + sum('comfort') +
    Math.floor(CABIN_COMFORT_PER_POINT * crewPoints(seat(state, plane, 'cabin')));
  const reliability = Math.max(
    0,
    Math.min(
      MAX_RELIABILITY,
      model.reliability + UPGRADE_STEP.reliability * up.reliability + sum('reliability') +
        MECHANIC_RELIABILITY_PER_POINT * crewPoints(seat(state, plane, 'mechanic')),
    ),
  );
  const ticketPct = sum('ticketPct') + traitSum(crew, 'coinsPct') + decoBonuses(state).ticketPct;
  return { speed, capacity, range, comfort, reliability, ticketPct };
}

/** Bonus added to an event option's success chance for this plane in this country. */
export function eventBonus(state: GameState, plane: PlaneState, countryId: CountryId): number {
  const crew = crewOf(state, plane);
  const affinity = crew.filter((c) => c.element === countryId).length * AFFINITY_BONUS;
  const traits = crew.reduce(
    (s, c) =>
      s + c.traits.reduce((t, id) => {
        const trait = TRAIT_BY_ID[id];
        return t + (trait?.luck ?? 0) + (trait?.country === countryId ? trait.countryBonus ?? 0 : 0);
      }, 0),
    0,
  );
  const hasModule = plane.modules.some((m) => m && MODULE_BY_ID[m]?.countryId === countryId);
  return affinity + traits + (hasModule ? MODULE_EVENT_BONUS : 0);
}

export function affinityCount(state: GameState, plane: PlaneState, countryId: CountryId): number {
  return crewOf(state, plane).filter((c) => c.element === countryId).length;
}

export function crewXpBonus(member: CrewMember): number {
  return traitSum([member], 'xpPct');
}

export function repairBonus(state: GameState, plane: PlaneState): number {
  return decoBonuses(state).repairPct + traitSum(crewOf(state, plane), 'repairPct');
}

export function ringOf(countryId: CountryId): number {
  return COUNTRY_BY_ID[countryId].ring;
}

// --- VIP ---------------------------------------------------------------------

export function countryVipDemand(state: GameState, countryId: CountryId): VipState['demand'] {
  const ring = COUNTRY_BY_ID[countryId].ring;
  const module = MODULES.find((m) => m.countryId === countryId);
  const researched = module && researchedModules(state).has(module.id);
  return { countryId, minComfort: vipMinComfort(ring), moduleId: researched ? module.id : undefined };
}

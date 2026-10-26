// Game engine: the idle loop (`tick`) and every player action.
// Actions mutate the state in place and return a Result. `now` is a timestamp
// in ms; durations from formulas.ts are in seconds.
import { COUNTRIES, COUNTRY_BY_ID, RING_LEVELS } from './data/countries';
import { CREW_RARITY, FIRST_NAMES, LAST_NAMES, PREMIUM_RECRUIT_MILES, RECRUIT_ODDS, ROLES, TRAITS } from './data/crew';
import { EVENTS, EVENT_BY_ID, SEASON_EVENTS, type EventDef } from './data/events';
import { activeSeason, addSeasonPoints, seasonFlightPoints } from './calendar';
import { MAX_STAT_LEVEL, MODULE_BY_ID, PLANE_BY_ID, PLANE_COLORS } from './data/planes';
import { TECHS, TECH_BY_ID } from './data/research';
import { RARITY_INFO, RESTOCK_TIERS, SHOP_BY_ID, WALL_COLORS } from './data/shops';
import { VIPS } from './data/vips';
import {
  AFFINITY_BONUS,
  COUNTRY_VIP_STAY_SECONDS,
  DESTINATION_WINDOW_MS,
  MAX_CREW,
  spendXp,
  MAX_LOUNGE_LEVEL,
  loungeUpgradeCost,
  AVOID_PER_RELIABILITY,
  eventChance,
  FREE_RECRUIT_COOLDOWN_MS,
  MAX_SHOP_LEVEL,
  MAX_STARS,
  MODIFIER_INFO,
  REPAIR_SECONDS,
  RESEARCH_XP,
  REROLL_MILES,
  VIP_MILES,
  VIP_XP,
  buildCost,
  buildDuration,
  crewXpToNext,
  flightCrewXp,
  flightDuration,
  flightXp,
  hangarSize,
  maxFloors,
  planeUpgradeCost,
  recruitCost,
  repairCost,
  researchCost,
  researchDuration,
  resourceIncome,
  shopUpgradeCost,
  ticketIncome,
  vipCoins,
  vipResource,
  xpToNext,
} from './formulas';
import { type Rng, hashString, pick, pickWeighted, uid } from './rng';
import { featuredMult } from './destinations';
import { newPlane } from './state';
import {
  affinityCount,
  arrivalRate,
  carnetBonus,
  prestigeMult,
  countryVipDemand,
  crewOf,
  crewXpBonus,
  eventBonus,
  loungeCap,
  planeStats,
  repairBonus,
  researchedModules,
  resourceBonus,
  ringOf,
  shopPool,
  shopRate,
} from './stats';
import type {
  CrewMember,
  Destination,
  Element,
  FlightReport,
  GameState,
  Outcome,
  PlaneState,
  Rarity,
  ShopCategory,
  StatKey,
  VipResult,
} from './types';

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });
const done: Result<void> = { ok: true, value: undefined };

/** Payment for the ad-able actions. 'ad' means the rewarded ad was already watched (see monetization.ts). */
export type Payment = 'coins' | 'miles' | 'ad';

const MAX_REPORTS = 30;

// =============================================================================
// Progression
// =============================================================================

/** Adds reputation and handles level ups. Returns the number of levels gained. */
export function addXp(state: GameState, amount: number): number {
  state.xp += amount;
  let gained = 0;
  while (state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    state.level++;
    gained++;
  }
  return gained;
}

function earn(state: GameState, coins: number) {
  state.coins += coins;
  state.stats.totalCoins += coins;
}

export function unlockedRing(state: GameState): number {
  return Math.max(...Object.entries(RING_LEVELS).filter(([, lvl]) => state.level >= lvl).map(([ring]) => +ring));
}

// =============================================================================
// Idle loop
// =============================================================================

export interface TickResult {
  seconds: number;
  coins: number;
  flightsLanded: number;
  /** « ×2 gains hors ligne » already used. */
  doubled?: boolean;
}

/**
 * Advances the simulation to `now`. Safe to call every frame and after hours
 * offline: shop sales are linear until the stock runs out.
 */
export function tick(state: GameState, now: number): TickResult {
  const from = state.lastTick;
  const seconds = Math.max(0, (now - from) / 1000);
  const result: TickResult = { seconds, coins: 0, flightsLanded: 0 };
  // Constructions.
  state.floors.forEach((floor, i) => {
    if (floor.buildEndsAt !== undefined && floor.buildEndsAt <= now) {
      delete floor.buildEndsAt;
      state.stats.floorsBuilt++;
      addXp(state, Math.max(10 * (i + 1), spendXp(buildCost(i + 1))));
    }
  });

  // Shop sales and restocks.
  state.floors.forEach((floor, i) => {
    const shop = floor.shop;
    if (!shop) return;
    const rate = shopRate(state, i);
    let sellFrom = from;
    if (shop.restock) {
      if (shop.restock.endsAt > now) return;
      sellFrom = Math.max(from, shop.restock.endsAt);
      shop.stock += rate * RESTOCK_TIERS[shop.restock.tier].durationSec;
      delete shop.restock;
    }
    const sold = Math.min(shop.stock, (rate * (now - sellFrom)) / 1000);
    shop.stock -= sold;
    result.coins += sold;
  });
  earn(state, result.coins);

  // Passengers arrive in the lounge.
  const boostUntil = state.boosts.arrivalsX2Until ?? 0;
  const boosted = Math.max(0, (Math.min(now, boostUntil) - from) / 1000);
  state.lounge.passengers = Math.min(
    loungeCap(state),
    state.lounge.passengers + arrivalRate(state) * (seconds + boosted),
  );

  // Flights, repairs, research.
  for (const plane of state.planes) {
    if (plane.flight && plane.flight.endsAt > from && plane.flight.endsAt <= now) result.flightsLanded++;
    if (plane.repairEndsAt !== undefined && plane.repairEndsAt <= now) {
      plane.damaged = false;
      delete plane.repairEndsAt;
    }
  }
  if (state.researching && state.researching.endsAt <= now) {
    state.research.push(state.researching.techId);
    delete state.researching;
    state.stats.researchDone++;
    addXp(state, RESEARCH_XP);
  }
  if (state.fusion && state.fusion.endsAt <= now) {
    state.plans.push(state.fusion.resultId);
    delete state.fusion;
    state.stats.fusions++;
  }

  // VIPs leave when they are tired of waiting (unless already on board).
  const boarded = new Set(state.planes.flatMap((p) => p.flight?.vipUids ?? []));
  state.vips = state.vips.filter((v) => v.expiresAt > now || boarded.has(v.uid));

  state.lastTick = now;
  return result;
}

/** Ad « ×2 gains hors ligne »: grants the offline coins a second time. */
export function doubleOffline(state: GameState, offline: TickResult): Result {
  if (offline.coins <= 0 || offline.doubled) return fail('Aucun gain hors ligne à doubler.');
  earn(state, offline.coins);
  offline.coins *= 2;
  offline.doubled = true;
  return done;
}

// =============================================================================
// Tower: floors and shops
// =============================================================================

export function buildFloor(state: GameState, now: number): Result {
  const n = state.floors.length + 1;
  if (state.floors.some((f) => f.buildEndsAt !== undefined)) return fail('Un étage est déjà en construction.');
  if (n > maxFloors(state.level)) return fail(`Niveau d'aéroport insuffisant pour l'étage ${n}.`);
  const cost = buildCost(n);
  if (state.coins < cost) return fail('Pas assez de pièces.');
  state.coins -= cost;
  state.floors.push({ buildEndsAt: now + buildDuration(n) * 1000 });
  return done;
}

/** Finishes the current construction (VIP Promoteur, Miles or ad). */
export function finishBuild(state: GameState, now: number): Result {
  const floor = state.floors.find((f) => f.buildEndsAt !== undefined);
  if (!floor) return fail('Aucune construction en cours.');
  floor.buildEndsAt = now;
  tick(state, now);
  return done;
}

function isBuilt(state: GameState, index: number): boolean {
  const floor = state.floors[index];
  return !!floor && floor.buildEndsAt === undefined;
}

export function recordAlbum(state: GameState, defId: string) {
  if (!state.album.includes(defId)) state.album.push(defId);
}

function drawShop(state: GameState, category: ShopCategory, rng: Rng, exclude?: string): string | undefined {
  const pool = shopPool(state, category).filter((d) => d.id !== exclude);
  if (pool.length === 0) return undefined;
  const owned = new Set(state.floors.map((f) => f.shop?.defId));
  const fresh = pool.filter((d) => !owned.has(d.id));
  const candidates = fresh.length > 0 ? fresh : pool;
  return pickWeighted(rng, candidates, (d) => RARITY_INFO[d.rarity].weight).id;
}

/** Draws a shop of the chosen category for an empty floor (GDD §4.3). */
export function openShop(state: GameState, floorIndex: number, category: ShopCategory, rng: Rng = Math.random): Result<string> {
  if (!isBuilt(state, floorIndex)) return fail("Cet étage n'est pas construit.");
  const floor = state.floors[floorIndex];
  if (floor.shop) return fail('Cet étage a déjà un magasin.');
  const defId = drawShop(state, category, rng);
  if (!defId) return fail('Aucun magasin disponible dans cette catégorie.');
  floor.shop = { defId, level: 1, stars: 1, stock: 0 };
  recordAlbum(state, defId);
  state.stats.shopsOpened++;
  return ok(defId);
}

/** Re-draws a freshly opened shop once per floor, for Miles or an ad. */
export function rerollShop(state: GameState, floorIndex: number, payment: Payment, rng: Rng = Math.random): Result<string> {
  const floor = state.floors[floorIndex];
  const shop = floor?.shop;
  if (!shop) return fail('Aucun magasin à relancer.');
  if (floor.rerollUsed) return fail('Tirage déjà relancé sur cet étage.');
  if (shop.level > 1 || shop.stock > 0 || shop.restock) return fail('Ce magasin est déjà en activité.');
  if (payment === 'coins') return fail('La relance se paie en Miles ou avec une pub.');
  if (payment === 'miles') {
    if (state.miles < REROLL_MILES) return fail('Pas assez de Miles.');
    state.miles -= REROLL_MILES;
  }
  const category = SHOP_BY_ID[shop.defId].category;
  const defId = drawShop(state, category, rng, shop.defId) ?? shop.defId;
  floor.shop = { defId, level: 1, stars: 1, stock: 0 };
  recordAlbum(state, defId);
  floor.rerollUsed = true;
  return ok(defId);
}

/** Starts restocking an empty shop with product tier 0 (small), 1 (medium) or 2 (big). */
export function restock(state: GameState, floorIndex: number, tier: number, now: number): Result {
  const shop = state.floors[floorIndex]?.shop;
  if (!shop) return fail('Aucun magasin sur cet étage.');
  if (!RESTOCK_TIERS[tier]) return fail('Produit inconnu.');
  if (shop.restock) return fail('Réapprovisionnement déjà en cours.');
  if (shop.stock > 1e-6) return fail('Le rayon n’est pas encore vide.');
  shop.restock = { tier, endsAt: now + RESTOCK_TIERS[tier].restockSec * 1000 };
  state.stats.restocks++;
  return done;
}

/** Finishes a restock instantly (ad « Livraison express » or VIP Livreur). */
export function restockExpress(state: GameState, floorIndex: number, tier: number, now: number): Result {
  const shop = state.floors[floorIndex]?.shop;
  if (!shop) return fail('Aucun magasin sur cet étage.');
  if (!shop.restock) {
    const started = restock(state, floorIndex, tier, now);
    if (!started.ok) return started;
  }
  shop.restock!.endsAt = now;
  tick(state, now);
  return done;
}

export function upgradeShop(state: GameState, floorIndex: number): Result {
  const shop = state.floors[floorIndex]?.shop;
  if (!shop) return fail('Aucun magasin sur cet étage.');
  if (shop.level >= MAX_SHOP_LEVEL) return fail('Niveau maximum atteint.');
  const cost = shopUpgradeCost(SHOP_BY_ID[shop.defId].rarity, shop.level);
  if (state.coins < cost) return fail('Pas assez de pièces.');
  state.coins -= cost;
  shop.level++;
  state.stats.shopUpgrades++;
  addXp(state, spendXp(cost));
  return done;
}

/** Adds a star to a shop with a duplicate (fusion plan). */
export function addStar(state: GameState, floorIndex: number): Result {
  const shop = state.floors[floorIndex]?.shop;
  if (!shop) return fail('Aucun magasin sur cet étage.');
  if (shop.stars >= MAX_STARS) return fail('Étoiles au maximum.');
  shop.stars++;
  return done;
}

export function upgradeLounge(state: GameState): Result {
  if (state.lounge.level >= MAX_LOUNGE_LEVEL) return fail('Salle au niveau maximum.');
  const cost = loungeUpgradeCost(state.lounge.level);
  if (state.coins < cost) return fail('Pas assez de pièces.');
  state.coins -= cost;
  state.lounge.level++;
  return done;
}

const isColor = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

/** Free cosmetics (GDD §4.8). `target` is a floor index, 'facade' or 'lobby'. */
export function setColor(state: GameState, target: number | 'facade' | 'lobby', color: string): Result {
  if (!isColor(color)) return fail('Couleur invalide.');
  if (target === 'facade') state.facadeColor = color;
  else if (target === 'lobby') state.lobbyColor = color;
  else if (isBuilt(state, target) && WALL_COLORS.includes(color)) state.floors[target].wallColor = color;
  else return fail('Couleur ou étage invalide.');
  return done;
}

/** Swaps two built floors (free) to play with adjacency bonuses. */
export function swapFloors(state: GameState, a: number, b: number): Result {
  if (a === b || !isBuilt(state, a) || !isBuilt(state, b)) return fail('Étages invalides.');
  [state.floors[a], state.floors[b]] = [state.floors[b], state.floors[a]];
  return done;
}

// =============================================================================
// Planes
// =============================================================================

function findPlane(state: GameState, planeUid: string): PlaneState | undefined {
  return state.planes.find((p) => p.uid === planeUid);
}

function isIdle(plane: PlaneState): boolean {
  return !plane.flight;
}

export function buyPlane(state: GameState, modelId: string, rng: Rng = Math.random): Result<PlaneState> {
  const model = PLANE_BY_ID[modelId];
  if (!model) return fail('Modèle inconnu.');
  if (state.level < model.level) return fail(`Disponible au niveau ${model.level}.`);
  if (state.planes.length >= hangarSize(state.level)) return fail('Le hangar est plein.');
  if (state.coins < model.price) return fail('Pas assez de pièces.');
  state.coins -= model.price;
  const count = state.planes.filter((p) => p.modelId === modelId).length + 1;
  const plane = newPlane(uid('plane', rng), modelId, `${model.name} ${count}`, pick(rng, PLANE_COLORS));
  state.planes.push(plane);
  state.stats.planesBought++;
  addXp(state, spendXp(model.price));
  return ok(plane);
}

export function upgradePlane(state: GameState, planeUid: string, stat: StatKey): Result {
  const plane = findPlane(state, planeUid);
  if (!plane) return fail('Avion introuvable.');
  const level = plane.upgrades[stat];
  if (level >= MAX_STAT_LEVEL) return fail('Niveau maximum atteint.');
  const cost = planeUpgradeCost(PLANE_BY_ID[plane.modelId].price, level);
  if (state.coins < cost) return fail('Pas assez de pièces.');
  state.coins -= cost;
  plane.upgrades[stat]++;
  state.stats.planeUpgrades++;
  addXp(state, spendXp(cost));
  return done;
}

/** Installs a researched module in a slot (null empties the slot). */
export function setModule(state: GameState, planeUid: string, slot: number, moduleId: string | null): Result {
  const plane = findPlane(state, planeUid);
  if (!plane) return fail('Avion introuvable.');
  if (!isIdle(plane)) return fail("L'avion est en vol.");
  if (slot < 0 || slot >= plane.modules.length) return fail('Emplacement invalide.');
  if (moduleId !== null) {
    if (!MODULE_BY_ID[moduleId]) return fail('Module inconnu.');
    if (!researchedModules(state).has(moduleId)) return fail("Ce module n'est pas encore recherché.");
    if (plane.modules.some((m, i) => m === moduleId && i !== slot)) return fail('Module déjà installé.');
  }
  plane.modules[slot] = moduleId;
  return done;
}

export function repairPlane(state: GameState, planeUid: string, payment: Payment, now: number): Result {
  const plane = findPlane(state, planeUid);
  if (!plane?.damaged) return fail("Cet avion n'a pas besoin de réparation.");
  if (payment === 'ad') {
    plane.damaged = false;
    delete plane.repairEndsAt;
    return done;
  }
  if (plane.repairEndsAt !== undefined) return fail('Réparation déjà en cours.');
  if (payment === 'miles') return fail('La réparation se paie en pièces ou avec une pub.');
  const cost = Math.round(repairCost(PLANE_BY_ID[plane.modelId].price) * Math.max(0, 1 + repairBonus(state, plane)));
  if (state.coins < cost) return fail('Pas assez de pièces.');
  state.coins -= cost;
  plane.repairEndsAt = now + REPAIR_SECONDS * 1000;
  return done;
}

// =============================================================================
// Crew
// =============================================================================

const ELEMENTS: Element[] = ['neutre', ...COUNTRIES.map((c) => c.id)];

export function rollCrewMember(rng: Rng, kind: 'standard' | 'premium'): CrewMember {
  const odds = RECRUIT_ODDS[kind];
  const rarity = pickWeighted(rng, Object.keys(odds) as Rarity[], (r) => odds[r]);
  const traitCount = Math.floor(rng() * 3);
  const traits: string[] = [];
  while (traits.length < traitCount) {
    const t = pick(rng, TRAITS).id;
    if (!traits.includes(t)) traits.push(t);
  }
  return {
    uid: uid('crew', rng),
    name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
    role: pick(rng, ROLES),
    rarity,
    element: pick(rng, ELEMENTS),
    traits,
    level: 1,
    xp: 0,
  };
}

/** Recruits at the agency (GDD §7): coins, Miles (premium) or a free ad every 4 h. */
export function recruit(state: GameState, payment: Payment, now: number, rng: Rng = Math.random): Result<CrewMember> {
  if (state.crew.length >= MAX_CREW) return fail('Équipage complet : renvoyez quelqu’un d’abord.');
  if (payment === 'coins') {
    const cost = recruitCost(state.level);
    if (state.coins < cost) return fail('Pas assez de pièces.');
    state.coins -= cost;
  } else if (payment === 'miles') {
    if (state.miles < PREMIUM_RECRUIT_MILES) return fail('Pas assez de Miles.');
    state.miles -= PREMIUM_RECRUIT_MILES;
  } else {
    const readyAt = state.cooldowns.free_recruit ?? 0;
    if (now < readyAt) return fail('Recrutement gratuit pas encore disponible.');
    state.cooldowns.free_recruit = now + FREE_RECRUIT_COOLDOWN_MS;
  }
  const member = rollCrewMember(rng, payment === 'miles' ? 'premium' : 'standard');
  state.crew.push(member);
  state.stats.recruits++;
  return ok(member);
}

/** Seats a crew member in their role on a plane, replacing whoever sat there. */
export function assignCrew(state: GameState, crewUid: string, planeUid: string): Result {
  const member = state.crew.find((c) => c.uid === crewUid);
  const plane = findPlane(state, planeUid);
  if (!member || !plane) return fail('Équipier ou avion introuvable.');
  if (!isIdle(plane)) return fail("L'avion est en vol.");
  if (member.planeUid) {
    const previous = findPlane(state, member.planeUid);
    if (previous && !isIdle(previous)) return fail("L'équipier est en vol.");
    if (previous) delete previous.crew[member.role];
  }
  const seated = plane.crew[member.role];
  if (seated) {
    const other = state.crew.find((c) => c.uid === seated);
    if (other) delete other.planeUid;
  }
  plane.crew[member.role] = member.uid;
  member.planeUid = plane.uid;
  state.stats.crewAssigned++;
  return done;
}

export function unassignCrew(state: GameState, crewUid: string): Result {
  const member = state.crew.find((c) => c.uid === crewUid);
  if (!member?.planeUid) return fail("Cet équipier n'est pas affecté.");
  const plane = findPlane(state, member.planeUid);
  if (plane && !isIdle(plane)) return fail("L'avion est en vol.");
  if (plane) delete plane.crew[member.role];
  delete member.planeUid;
  return done;
}

/** Lets a crew member go (free, nothing refunded). */
export function dismissCrew(state: GameState, crewUid: string): Result {
  const member = state.crew.find((c) => c.uid === crewUid);
  if (!member) return fail('Équipier introuvable.');
  if (member.planeUid) {
    const res = unassignCrew(state, crewUid);
    if (!res.ok) return res;
  }
  state.crew = state.crew.filter((c) => c !== member);
  return done;
}

/** Gives XP to a crew member. Returns the number of levels gained. */
export function addCrewXp(member: CrewMember, amount: number): number {
  const maxLevel = CREW_RARITY[member.rarity].maxLevel;
  if (member.level >= maxLevel) return 0;
  member.xp += amount * (1 + crewXpBonus(member));
  let gained = 0;
  while (member.level < maxLevel && member.xp >= crewXpToNext(member.level)) {
    member.xp -= crewXpToNext(member.level);
    member.level++;
    gained++;
  }
  if (member.level >= maxLevel) member.xp = 0;
  return gained;
}

// =============================================================================
// Flights
// =============================================================================

export function canFly(state: GameState, plane: PlaneState, dest: Destination): Result {
  if (!isIdle(plane)) return fail("L'avion est déjà en vol.");
  if (plane.damaged) return fail("L'avion est endommagé.");
  if (unlockedRing(state) < ringOf(dest.countryId)) return fail('Destination pas encore accessible.');
  if (planeStats(state, plane).range < dest.distance) return fail('Autonomie insuffisante.');
  return done;
}

/** Sends a plane with up to `capacity` waiting passengers and the chosen VIPs. */
export function sendFlight(state: GameState, planeUid: string, dest: Destination, now: number, vipUids: string[] = []): Result {
  const plane = findPlane(state, planeUid);
  if (!plane) return fail('Avion introuvable.');
  const check = canFly(state, plane, dest);
  if (!check.ok) return check;
  const boarded = new Set(state.planes.flatMap((p) => p.flight?.vipUids ?? []));
  for (const v of vipUids) {
    const vip = state.vips.find((x) => x.uid === v);
    if (!vip?.demand || boarded.has(v)) return fail('VIP indisponible.');
  }
  const stats = planeStats(state, plane);
  const passengers = Math.min(Math.floor(state.lounge.passengers), stats.capacity);
  state.lounge.passengers -= passengers;
  plane.flight = {
    destination: dest,
    departAt: now,
    endsAt: now + flightDuration(dest.distance, stats.speed) * 1000,
    passengers,
    vipUids: [...vipUids],
    tailwindUsed: false,
  };
  state.stats.flightsSent++;
  return done;
}

/** Ad « Vent arrière » / VIP Contrôleur: −50 % of the remaining flight time. */
export function speedUpFlight(state: GameState, planeUid: string, now: number, once = true): Result {
  const flight = findPlane(state, planeUid)?.flight;
  if (!flight || flight.endsAt <= now) return fail('Aucun vol en cours.');
  if (once && flight.tailwindUsed) return fail('Vent arrière déjà utilisé sur ce vol.');
  flight.endsAt = now + (flight.endsAt - now) / 2;
  if (once) flight.tailwindUsed = true;
  return done;
}

function rollEvent(dest: Destination, durationSec: number, mystery: boolean, now: number, rng: Rng): EventDef | undefined {
  if (!mystery && rng() >= eventChance(durationSec)) return undefined;
  const seasonId = activeSeason(now)?.def.id;
  const seasonal = mystery ? [] : SEASON_EVENTS.filter((e) => e.season === seasonId);
  const pool = [...EVENTS, ...seasonal].filter(
    (e) => (e.country === 'any' || e.country === dest.countryId) && !!e.rare === mystery,
  );
  if (pool.length === 0) return undefined;
  const stormy = dest.modifier === 'tempete';
  return pickWeighted(rng, pool, (e) => e.weight * (stormy && e.kind === 'malus' ? 2 : 1));
}

export function optionChance(state: GameState, plane: PlaneState | undefined, countryId: Destination['countryId'], base: number): number {
  if (base >= 1) return 1;
  const bonus = plane ? eventBonus(state, plane, countryId) : 0;
  return Math.max(0, Math.min(1, base + bonus));
}

function applyOutcome(report: FlightReport, outcome: Outcome) {
  report.coins = Math.max(0, Math.round(report.coins * (1 + (outcome.coinsMult ?? 0))));
  report.resource = Math.max(0, Math.round(report.resource * (1 + (outcome.resourceMult ?? 0))));
  report.crewXp += outcome.crewXp ?? 0;
}

/** Credits a finished report (rewards, XP, damage, unlocks). */
function settle(state: GameState, report: FlightReport, now = state.lastTick) {
  const outcome = report.event?.outcome;
  if (outcome) applyOutcome(report, outcome);
  earn(state, report.coins + report.vipCoins);
  state.resources[report.countryId] += report.resource + report.vipResource;
  state.miles += report.vipMiles + (outcome?.miles ?? 0);
  addXp(state, report.xp + (outcome?.rep ?? 0));
  const plane = findPlane(state, report.planeUid);
  if (plane) {
    for (const member of crewOf(state, plane)) addCrewXp(member, report.crewXp);
    if (outcome?.damage) plane.damaged = true;
  }
  if (outcome?.unlockShop && !state.bonusShops.includes(outcome.unlockShop)) state.bonusShops.push(outcome.unlockShop);
  if (outcome?.vip) {
    const defs = VIPS.filter((v) => v.countryId === report.countryId);
    state.vips.push({
      uid: `vip_${report.id}`,
      defId: defs[Math.floor(Math.abs(hashString(report.id)) % defs.length)].id,
      expiresAt: state.lastTick + COUNTRY_VIP_STAY_SECONDS * 1000,
      demand: countryVipDemand(state, report.countryId),
    });
  }
  report.seasonPoints = (report.seasonPoints ?? 0) + (outcome?.seasonPoints ?? 0);
  addSeasonPoints(state, report.seasonPoints, now);
  report.pending = false;
}

/**
 * Collects a landed plane: tickets, resources, VIP requests and the random
 * event. A choice event leaves the report pending until `resolveEvent`.
 */
export function collectFlight(state: GameState, planeUid: string, now: number, rng: Rng = Math.random): Result<FlightReport> {
  const plane = findPlane(state, planeUid);
  const flight = plane?.flight;
  if (!plane || !flight) return fail('Aucun vol à collecter.');
  if (flight.endsAt > now) return fail("L'avion n'est pas encore rentré.");

  const dest = flight.destination;
  const ring = ringOf(dest.countryId);
  const stats = planeStats(state, plane);
  const mod = MODIFIER_INFO[dest.modifier];
  const affinity = 1 + AFFINITY_BONUS * affinityCount(state, plane, dest.countryId);

  const report: FlightReport = {
    id: uid('report', rng),
    planeUid,
    countryId: dest.countryId,
    destName: dest.name,
    passengers: flight.passengers,
    coins: Math.round(
      ticketIncome(dest.distance, flight.passengers, stats.comfort) * (1 + stats.ticketPct + carnetBonus(state)) * mod.coins * affinity * prestigeMult(state) * featuredMult(dest.countryId, now).coins,
    ),
    resource: Math.round(resourceIncome(flight.passengers, ring) * mod.resource * (1 + resourceBonus(state, dest.countryId)) * affinity * featuredMult(dest.countryId, now).resource),
    xp: flightXp(ring),
    crewXp: flightCrewXp(ring),
    vips: [],
    vipCoins: 0,
    vipMiles: 0,
    vipResource: 0,
    seasonPoints: seasonFlightPoints(now, ring, dest.countryId),
  };

  // VIP requests (GDD §5.2).
  const modules = new Set(plane.modules);
  for (const vipUid of flight.vipUids) {
    const vip = state.vips.find((v) => v.uid === vipUid);
    if (!vip?.demand) continue;
    const result: VipResult = { defId: vip.defId, satisfied: false };
    if (vip.demand.countryId !== dest.countryId) result.reason = 'Mauvaise destination';
    else if (stats.comfort < vip.demand.minComfort) result.reason = 'Pas assez confortable';
    else if (vip.demand.moduleId && !modules.has(vip.demand.moduleId)) result.reason = `Il manquait le module ${MODULE_BY_ID[vip.demand.moduleId]?.name ?? ''}`.trim();
    else {
      result.satisfied = true;
      report.vipCoins += vipCoins(ring);
      report.vipResource += vipResource(ring);
      report.vipMiles += VIP_MILES;
      report.xp += VIP_XP;
      state.carnet[vip.defId] = (state.carnet[vip.defId] ?? 0) + 1;
      state.stats.vipsServed++;
    }
    report.vips.push(result);
  }
  state.vips = state.vips.filter((v) => !flight.vipUids.includes(v.uid));

  // First visit: the country's shops join the pool.
  if (!state.discovered.includes(dest.countryId)) state.discovered.push(dest.countryId);

  // Random event (GDD §8.4).
  // A Mystère destination guarantees its rare event once, not on every trip.
  for (const key of Object.keys(state.cooldowns)) {
    if (key.startsWith('mystery:') && state.cooldowns[key] < now) delete state.cooldowns[key];
  }
  const mysteryKey = `mystery:${dest.id}`;
  const mystery = dest.modifier === 'mystere' && state.cooldowns[mysteryKey] === undefined;
  if (mystery) state.cooldowns[mysteryKey] = now + DESTINATION_WINDOW_MS;
  const event = rollEvent(dest, flightDuration(dest.distance, stats.speed), mystery, now, rng);
  if (event) {
    report.event = { defId: event.id };
    if (event.kind === 'choice') report.pending = true;
    else if (event.kind === 'malus' && rng() < stats.reliability * AVOID_PER_RELIABILITY) report.event.avoided = true;
    else report.event.outcome = event.outcome;
  }

  delete plane.flight;
  state.stats.flightsCollected++;
  if (!report.pending) settle(state, report, now);
  state.reports.unshift(report);
  state.reports.length = Math.min(state.reports.length, MAX_REPORTS);
  return ok(report);
}

/** Answers a pending choice event, rolls its success and credits the report. */
export function resolveEvent(state: GameState, reportId: string, choice: number, rng: Rng = Math.random): Result<FlightReport> {
  const report = state.reports.find((r) => r.id === reportId);
  if (!report?.pending || !report.event) return fail('Aucun choix en attente.');
  const option = EVENT_BY_ID[report.event.defId]?.options?.[choice];
  if (!option) return fail('Option invalide.');
  const plane = findPlane(state, report.planeUid);
  const success = rng() < optionChance(state, plane, report.countryId, option.chance);
  report.event.choice = choice;
  report.event.success = success;
  report.event.outcome = success ? option.success : option.fail ?? { text: 'Rien ne se passe.' };
  settle(state, report);
  return ok(report);
}

/** Ad « Double récolte »: doubles the coins and resources of a settled report. */
export function doubleReport(state: GameState, reportId: string): Result {
  const report = state.reports.find((r) => r.id === reportId);
  if (!report || report.pending) return fail('Rapport indisponible.');
  if (report.doubled) return fail('Récolte déjà doublée.');
  earn(state, report.coins);
  state.resources[report.countryId] += report.resource;
  report.doubled = true;
  return done;
}

// =============================================================================
// Research
// =============================================================================

export function startResearch(state: GameState, techId: string, now: number): Result {
  const tech = TECH_BY_ID[techId];
  if (!tech) return fail('Technologie inconnue.');
  if (state.researching) return fail('Une recherche est déjà en cours.');
  if (state.research.includes(techId)) return fail('Déjà recherchée.');
  if (!state.discovered.includes(tech.countryId)) return fail("Visitez d'abord ce pays.");
  const previous = TECHS.find((t) => t.countryId === tech.countryId && t.k === tech.k - 1);
  if (previous && !state.research.includes(previous.id)) return fail(`Recherchez d'abord « ${previous.name} ».`);
  const ring = COUNTRY_BY_ID[tech.countryId].ring;
  const cost = researchCost(ring, tech.k);
  if (state.coins < cost.coins || state.resources[tech.countryId] < cost.resource) return fail('Ressources insuffisantes.');
  state.coins -= cost.coins;
  state.resources[tech.countryId] -= cost.resource;
  state.researching = { techId, endsAt: now + researchDuration(ring, tech.k) * 1000 };
  return done;
}

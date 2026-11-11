/**
 * The flat airport inside a game (GDD §24, step 2 of the pivot): the layout
 * lives in `state.city`, each room points to a shop slot (`state.floors`),
 * and a room's position sets its income multiplier in `shopRate`.
 */
import {
  autoPlaceRoom, BUILDINGS, canPlace, connected, footprint, gameStarterLayout, place, placeError, PLOT, plotKey, revision, roomBonus, rotate, touchLayout,
  type BuildingKind, type CityLayout, type Placed, type RoomBonus, type ShopResolver,
} from './city';
import { SHOP_BY_ID } from './data/shops';
import type { GameState } from './types';

type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });
const done: Result = { ok: true, value: undefined };

/** Builds the airport of a tower save: starter layout, one room per floor. */
export function cityFromFloors(floorCount: number): CityLayout {
  const layout = gameStarterLayout();
  for (let i = 0; i < floorCount; i++) autoPlaceRoom(layout, i);
  return layout;
}

/** Makes sure the game has an airport and that every floor has its room if there is space. */
export function ensureCity(state: GameState): CityLayout {
  if (!state.city) state.city = cityFromFloors(state.floors.length);
  const placed = new Set(state.city.items.filter((p) => p.kind === 'salle').map((p) => p.floor));
  for (let i = 0; i < state.floors.length; i++) if (!placed.has(i)) autoPlaceRoom(state.city, i);
  return state.city;
}

export const roomShop = (state: GameState): ShopResolver => (p) => {
  if (p.floor === undefined) return undefined;
  const id = state.floors[p.floor]?.shop?.defId;
  return id ? SHOP_BY_ID[id] : undefined;
};

/** Floors that have no room on the land yet (the open land is full). */
export function unplacedFloors(state: GameState): number[] {
  const placed = new Set((state.city?.items ?? []).filter((p) => p.kind === 'salle').map((p) => p.floor));
  return state.floors.map((_, i) => i).filter((i) => !placed.has(i));
}

// One cached computation per layout and shop line-up: shopRate runs for every
// floor several times per second.
let cache: { city: CityLayout; rev: number; shops: string; mult: Map<number, number> } | null = null;

/** Income multiplier of each floor from the position of its room (1 when not placed). */
export function roomMultipliers(state: GameState): Map<number, number> {
  const city = state.city;
  if (!city) return new Map();
  const rev = revision(city);
  const shops = state.floors.map((f) => f.shop?.defId ?? '').join(',');
  if (cache && cache.city === city && cache.rev === rev && cache.shops === shops) return cache.mult;
  const linked = connected(city);
  const resolve = roomShop(state);
  const mult = new Map<number, number>();
  for (const p of city.items)
    if (p.kind === 'salle' && p.floor !== undefined && resolve(p)) mult.set(p.floor, roomBonus(city, p.uid, linked, resolve).multiplier);
  cache = { city, rev, shops, mult };
  return mult;
}

export function roomMultiplier(state: GameState, floorIndex: number): number {
  return roomMultipliers(state).get(floorIndex) ?? 1;
}

export function floorBonus(state: GameState, floorIndex: number): RoomBonus | null {
  const city = state.city;
  const p = city?.items.find((o) => o.kind === 'salle' && o.floor === floorIndex);
  return city && p ? roomBonus(city, p.uid, connected(city), roomShop(state)) : null;
}

// --- Prices ------------------------------------------------------------------

const DECOR_BASE: Partial<Record<BuildingKind, number>> = { arbre: 300, banc: 200, parterre: 600, fontaine: 4000 };
/** Kinds the player may add: corridors and runway-side pieces are free, decorations cost coins. */
export const BUILDABLE: BuildingKind[] = ['couloir', 'porte', 'arbre', 'parterre', 'banc', 'fontaine', 'voie', 'stand', 'piste'];

/** Price of one more decoration of this kind: ×1.25 for each one already owned. */
export function cityPrice(state: GameState, kind: BuildingKind): number {
  const base = DECOR_BASE[kind];
  if (!base) return 0;
  const owned = state.city?.items.filter((p) => p.kind === kind).length ?? 0;
  return Math.round(base * 1.25 ** owned);
}

/** Plots bought so far beyond the starting nine. */
const boughtPlots = (city: CityLayout) => Math.max(0, (city.plots?.length ?? 9) - 9);

export function plotPrice(state: GameState): number {
  return Math.round(2000 * 3.2 ** (boughtPlots(ensureCity(state)) + 1));
}

/** A plot can be bought when it lies on the terminal side and touches one already owned. */
export function canBuyPlot(city: CityLayout, px: number, pz: number): boolean {
  if (!city.plots || city.plots.includes(plotKey(px, pz))) return false;
  if (px < 0 || pz < 0 || (px + 1) * PLOT > city.airsideX || (pz + 1) * PLOT > city.depth) return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => city.plots!.includes(plotKey(px + dx, pz + dz)));
}

// --- Actions -------------------------------------------------------------------

/** Adds a building (new uid) or moves one (existing uid). New decorations are paid in coins. */
export function cityPlace(state: GameState, p: Placed): Result {
  const city = ensureCity(state);
  const existing = city.items.find((o) => o.uid === p.uid);
  if (existing && existing.kind !== p.kind) return fail('Bâtiment invalide.');
  if (!existing && !BUILDABLE.includes(p.kind)) return fail(p.kind === 'salle' ? 'Les salles viennent des étages construits.' : 'Il n’y en a qu’un.');
  const target: Placed = existing ? { ...p, floor: existing.floor } : { ...p, uid: `b${(city.next = (city.next ?? 1) + 1) - 1}` };
  const err = placeError(city, target);
  if (err) return fail(err);
  const price = existing ? 0 : cityPrice(state, p.kind);
  if (state.coins < price) return fail('Pas assez de pièces.');
  state.coins -= price;
  place(city, target);
  return done;
}

/** Puts a room that waits (no space) on the land. */
export function placeRoom(state: GameState, floorIndex: number, x: number, z: number, rot: 0 | 1 = 0): Result {
  const city = ensureCity(state);
  if (!state.floors[floorIndex]) return fail('Étage inconnu.');
  if (city.items.some((p) => p.kind === 'salle' && p.floor === floorIndex)) return fail('Cette salle est déjà posée.');
  const p: Placed = { uid: `b${(city.next = (city.next ?? 1) + 1) - 1}`, kind: 'salle', x, z, rot, floor: floorIndex };
  const err = placeError(city, p);
  if (err) return fail(err);
  place(city, p);
  return done;
}

export function cityRotate(state: GameState, uid: string): Result {
  return rotate(ensureCity(state), uid) ? done : fail('Pas la place de le tourner ici.');
}

/** Removes a building; rooms, the terminal and the tower stay (move them instead). No refund. */
export function cityRemove(state: GameState, uid: string): Result {
  const city = ensureCity(state);
  const i = city.items.findIndex((p) => p.uid === uid);
  if (i < 0) return fail('Bâtiment introuvable.');
  if (!BUILDABLE.includes(city.items[i].kind)) return fail('Celui-ci se déplace mais ne se retire pas.');
  city.items.splice(i, 1);
  touchLayout(city);
  return done;
}

export function buyPlot(state: GameState, px: number, pz: number): Result {
  const city = ensureCity(state);
  if (!canBuyPlot(city, px, pz)) return fail('Achetez d’abord une parcelle voisine.');
  const price = plotPrice(state);
  if (state.coins < price) return fail('Pas assez de pièces.');
  state.coins -= price;
  city.plots!.push(plotKey(px, pz));
  touchLayout(city);
  for (const i of unplacedFloors(state)) autoPlaceRoom(city, i);
  return done;
}

/** Called when a floor is added: its room goes on the land right away. */
export function onFloorAdded(state: GameState, floorIndex: number) {
  if (state.city) autoPlaceRoom(state.city, floorIndex);
}

/** Two floors swapped their shop: their rooms swap places too, so nothing moves on the land. */
export function onFloorsSwapped(state: GameState, a: number, b: number) {
  for (const p of state.city?.items ?? []) {
    if (p.kind !== 'salle') continue;
    if (p.floor === a) p.floor = b;
    else if (p.floor === b) p.floor = a;
  }
  if (state.city) touchLayout(state.city);
}

export { BUILDINGS, canPlace, footprint };

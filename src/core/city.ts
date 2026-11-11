/**
 * Flat airport ("city builder") layout — prototype, step 1 of the pivot away
 * from the tower. Pure logic: a grid of tiles where buildings are placed,
 * moved, rotated and removed, plus the placement rules that give positions a
 * meaning (connection to the terminal, neighbours sharing an element,
 * category zones, distance to the gates, beauty auras of decorations).
 * GameState keeps one layout (`state.city`, see cityGame.ts); rooms point to
 * the floor (shop slot) they show.
 */
import { SHOPS, type ShopDef } from './data/shops';
import type { Element, ShopCategory } from './types';

export type BuildingKind = 'terminal' | 'couloir' | 'salle' | 'porte' | 'piste' | 'voie' | 'stand' | 'tour' | 'arbre' | 'banc' | 'parterre' | 'fontaine';

/** Where a building may stand: the terminal side (landside), the runway side (airside), or both. */
export type Side = 'aerogare' | 'pistes' | 'libre';

export interface BuildingDef {
  name: string;
  emoji: string;
  /** Footprint in tiles before rotation (w along x, d along z). */
  w: number;
  d: number;
  /** Passengers walk through it: rooms and gates touching it are reached. */
  walkable?: boolean;
  /** Only one allowed. */
  unique?: boolean;
  /** Terminal side by default. Gates stand on the terminal side against the airside edge. */
  side?: Side;
  /** Decoration: beauty given to rooms within this many tiles. */
  aura?: number;
  beauty?: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  terminal: { name: 'Terminal', emoji: '🛎️', w: 3, d: 3, walkable: true, unique: true },
  couloir: { name: 'Couloir', emoji: '▫️', w: 1, d: 1, walkable: true },
  salle: { name: 'Salle', emoji: '🏪', w: 2, d: 2 },
  porte: { name: 'Porte', emoji: '🚪', w: 2, d: 1 },
  piste: { name: 'Piste', emoji: '🛫', w: 2, d: 12, side: 'pistes' },
  voie: { name: 'Voie de circulation', emoji: '➖', w: 1, d: 1, side: 'pistes' },
  stand: { name: 'Parking avion', emoji: '🅿️', w: 2, d: 2, side: 'pistes' },
  tour: { name: 'Tour de contrôle', emoji: '🗼', w: 2, d: 2, unique: true, side: 'libre' },
  arbre: { name: 'Arbre', emoji: '🌳', w: 1, d: 1, aura: 1, beauty: 1 },
  banc: { name: 'Banc', emoji: '🪑', w: 1, d: 1, aura: 1, beauty: 1 },
  parterre: { name: 'Parterre', emoji: '🌷', w: 1, d: 1, aura: 1, beauty: 2 },
  fontaine: { name: 'Fontaine', emoji: '⛲', w: 2, d: 2, aura: 2, beauty: 4 },
};

export interface Placed {
  uid: string;
  kind: BuildingKind;
  /** Top-left tile (smallest x and z). */
  x: number;
  z: number;
  /** 1 = turned a quarter: w and d swap. */
  rot: 0 | 1;
  /** Rooms only: the shop it holds (ShopDef id), for layouts outside a game. */
  shopId?: string;
  /** Rooms only: index of the shop slot in GameState.floors. */
  floor?: number;
}

export interface CityLayout {
  /** Bumped when the starter layout changes shape (older layouts are rebuilt). */
  version?: number;
  width: number;
  depth: number;
  /** Columns x >= airsideX are the runway side, reserved for runways, taxiways and stands. */
  airsideX: number;
  items: Placed[];
  /**
   * Bought plots of PLOT × PLOT tiles on the terminal side, as "px,pz".
   * Absent = the whole terminal side is open (prototype layouts, tests).
   */
  plots?: string[];
  /** Next building id. */
  next?: number;
}

export const CITY_VERSION = 3;
/** Side of a plot of land, in tiles. */
export const PLOT = 4;

export const plotKey = (px: number, pz: number) => `${px},${pz}`;

/** Whether every tile of `r` on the terminal side lies in a bought plot. */
export function inOpenLand(layout: CityLayout, r: Rect): boolean {
  if (!layout.plots) return true;
  for (let z = r.z; z < r.z + r.d; z++)
    for (let x = r.x; x < r.x + r.w; x++)
      if (x < layout.airsideX && !layout.plots.includes(plotKey(Math.floor(x / PLOT), Math.floor(z / PLOT)))) return false;
  return true;
}

export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export function footprint(p: Pick<Placed, 'kind' | 'x' | 'z' | 'rot'>): Rect {
  const def = BUILDINGS[p.kind];
  return p.rot ? { x: p.x, z: p.z, w: def.d, d: def.w } : { x: p.x, z: p.z, w: def.w, d: def.d };
}

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;

/** Two rectangles share an edge (not only a corner). */
export function touching(a: Rect, b: Rect): boolean {
  const xTouch = a.x + a.w === b.x || b.x + b.w === a.x;
  const zTouch = a.z + a.d === b.z || b.z + b.d === a.z;
  const xOver = a.x < b.x + b.w && b.x < a.x + a.w;
  const zOver = a.z < b.z + b.d && b.z < a.z + a.d;
  return (xTouch && zOver) || (zTouch && xOver);
}

/** Chebyshev distance between two rectangles, 0 when they touch or overlap. */
export function rectDistance(a: Rect, b: Rect): number {
  const dx = Math.max(0, b.x - (a.x + a.w - 1), a.x - (b.x + b.w - 1)) ;
  const dz = Math.max(0, b.z - (a.z + a.d - 1), a.z - (b.z + b.d - 1));
  return Math.max(dx, dz);
}

export function itemAt(layout: CityLayout, x: number, z: number): Placed | undefined {
  const cell = { x, z, w: 1, d: 1 };
  return layout.items.find((p) => overlap(footprint(p), cell));
}

/** Why `p` cannot stand where it is, or null when it fits. */
export function placeError(layout: CityLayout, p: Placed): string | null {
  const r = footprint(p);
  if (r.x < 0 || r.z < 0 || r.x + r.w > layout.width || r.z + r.d > layout.depth) return 'Hors du terrain.';
  const side = BUILDINGS[p.kind].side ?? 'aerogare';
  const airside = r.x >= layout.airsideX;
  const landside = r.x + r.w <= layout.airsideX;
  if (side === 'pistes' && !airside) return 'Réservé au côté pistes.';
  if (side === 'aerogare' && !landside) return 'Le côté pistes est réservé aux pistes, voies et parkings avions.';
  if (side === 'libre' && !airside && !landside) return 'À cheval sur la clôture.';
  if (p.kind === 'porte' && r.x + r.w !== layout.airsideX) return 'Une porte se pose contre la clôture du côté pistes.';
  if (!inOpenLand(layout, r)) return 'Ce terrain n’est pas encore à vous : achetez la parcelle.';
  if (BUILDINGS[p.kind].unique && layout.items.some((o) => o.kind === p.kind && o.uid !== p.uid)) return 'Il n’y en a qu’une.';
  if (layout.items.some((o) => o.uid !== p.uid && overlap(footprint(o), r))) return 'Pas de place ici.';
  return null;
}

/** Whether `p` fits: inside the land, on its side of the fence, on free tiles (ignoring `p` itself), and not a second unique building. */
export function canPlace(layout: CityLayout, p: Placed): boolean {
  return placeError(layout, p) === null;
}

/** Places a new building or moves an existing one (same uid). Returns false if it does not fit. */
const revisions = new WeakMap<CityLayout, number>();
/** Changes each time the layout changes through these helpers (cache key for income bonuses). */
export const revision = (layout: CityLayout) => revisions.get(layout) ?? 0;
/** Marks a layout changed by hand (e.g. a room pointing to another floor). */
export const touchLayout = (layout: CityLayout) => revisions.set(layout, revision(layout) + 1);

export function place(layout: CityLayout, p: Placed): boolean {
  if (!canPlace(layout, p)) return false;
  touchLayout(layout);
  const i = layout.items.findIndex((o) => o.uid === p.uid);
  if (i >= 0) layout.items[i] = { ...p };
  else layout.items.push({ ...p });
  return true;
}

export function remove(layout: CityLayout, uid: string): boolean {
  const i = layout.items.findIndex((o) => o.uid === uid);
  if (i < 0 || layout.items[i].kind === 'terminal') return false;
  layout.items.splice(i, 1);
  touchLayout(layout);
  return true;
}

/** Turns a building a quarter in place if it still fits. */
export function rotate(layout: CityLayout, uid: string): boolean {
  const p = layout.items.find((o) => o.uid === uid);
  if (!p) return false;
  return place(layout, { ...p, rot: p.rot ? 0 : 1 });
}

/**
 * Uids reached by passengers: the terminal, every corridor linked to it, and
 * every non-walkable building touching one of those.
 */
export function connected(layout: CityLayout): Set<string> {
  const terminal = layout.items.find((p) => p.kind === 'terminal');
  const reached = new Set<string>();
  if (!terminal) return reached;
  const walk = layout.items.filter((p) => BUILDINGS[p.kind].walkable);
  const queue = [terminal];
  reached.add(terminal.uid);
  while (queue.length) {
    const cur = footprint(queue.shift()!);
    for (const w of walk)
      if (!reached.has(w.uid) && touching(cur, footprint(w))) {
        reached.add(w.uid);
        queue.push(w);
      }
  }
  const hubs = layout.items.filter((p) => reached.has(p.uid)).map(footprint);
  for (const p of layout.items)
    if (!reached.has(p.uid) && (p.kind === 'salle' || p.kind === 'porte') && hubs.some((h) => touching(h, footprint(p)))) reached.add(p.uid);
  return reached;
}

/**
 * Runway side: runways, taxiways linked to a runway, and stands touching one
 * of those. A gate is "in service" when it is linked to the terminal and a
 * linked stand touches it across the fence.
 */
export function airsideLinked(layout: CityLayout): Set<string> {
  const reached = new Set<string>();
  const queue = layout.items.filter((p) => p.kind === 'piste');
  for (const p of queue) reached.add(p.uid);
  const ways = layout.items.filter((p) => p.kind === 'voie');
  while (queue.length) {
    const cur = footprint(queue.shift()!);
    for (const w of ways)
      if (!reached.has(w.uid) && touching(cur, footprint(w))) {
        reached.add(w.uid);
        queue.push(w);
      }
  }
  const hubs = layout.items.filter((p) => reached.has(p.uid)).map(footprint);
  for (const p of layout.items) if (p.kind === 'stand' && hubs.some((h) => touching(h, footprint(p)))) reached.add(p.uid);
  return reached;
}

export function gatesInService(layout: CityLayout, linked = connected(layout), air = airsideLinked(layout)): Set<string> {
  const stands = layout.items.filter((p) => p.kind === 'stand' && air.has(p.uid)).map(footprint);
  return new Set(layout.items.filter((p) => p.kind === 'porte' && linked.has(p.uid) && stands.some((s) => touching(s, footprint(p)))).map((p) => p.uid));
}

const shopById = new Map(SHOPS.map((s) => [s.id, s]));
export const shopOf = (p: Placed): ShopDef | undefined => (p.shopId ? shopById.get(p.shopId) : undefined);
/** Finds the shop a room shows (by default its shopId; a game resolves its floor). */
export type ShopResolver = (p: Placed) => ShopDef | undefined;

const shareElement = (a: Element[], b: Element[]) => a.some((e) => e !== 'neutre' && b.includes(e)) || (a.includes('neutre') && b.includes('neutre'));

/** Rooms of the same category linked by touching each other. */
export function zoneOf(layout: CityLayout, uid: string, shopFor: ShopResolver = shopOf): Placed[] {
  const start = layout.items.find((p) => p.uid === uid);
  const cat = start && shopFor(start)?.category;
  if (!start || !cat) return [];
  const same = layout.items.filter((p) => p.kind === 'salle' && shopFor(p)?.category === cat);
  const zone = [start];
  const seen = new Set([start.uid]);
  for (let i = 0; i < zone.length; i++)
    for (const o of same)
      if (!seen.has(o.uid) && touching(footprint(zone[i]), footprint(o))) {
        seen.add(o.uid);
        zone.push(o);
      }
  return zone;
}

/** Zone bonus by size: 3 rooms +10 %, 6 rooms +25 %, 10 rooms +50 %. */
export function zoneBonus(size: number): number {
  return size >= 10 ? 0.5 : size >= 6 ? 0.25 : size >= 3 ? 0.1 : 0;
}

export const ZONE_NAMES: Record<ShopCategory, string> = {
  resto: 'Food court',
  boutique: 'Galerie marchande',
  detente: 'Espace détente',
  service: 'Pôle services',
  loisir: 'Quartier loisirs',
};

export interface RoomBonus {
  connected: boolean;
  /** Touching rooms that share an element: +10 % each. */
  neighbours: number;
  zoneSize: number;
  zone: number;
  /** Beauty from decorations in range: +3 % per point, capped at +30 %. */
  beauty: number;
  /** A gate within 2 tiles: +15 %. */
  nearGate: boolean;
  /** Total income multiplier (0 when not linked to the terminal). */
  multiplier: number;
}

export function roomBonus(layout: CityLayout, uid: string, linked = connected(layout), shopFor: ShopResolver = shopOf): RoomBonus {
  const p = layout.items.find((o) => o.uid === uid);
  const shop = p && shopFor(p);
  if (!p || !shop) return { connected: false, neighbours: 0, zoneSize: 0, zone: 0, beauty: 0, nearGate: false, multiplier: 0 };
  const r = footprint(p);
  const neighbours = layout.items.filter((o) => {
    const s = o.uid !== uid && o.kind === 'salle' ? shopFor(o) : undefined;
    return s && touching(r, footprint(o)) && shareElement(shop.elements, s.elements);
  }).length;
  const zoneSize = zoneOf(layout, uid, shopFor).length;
  const zone = zoneBonus(zoneSize);
  let beauty = 0;
  for (const o of layout.items) {
    const def = BUILDINGS[o.kind];
    if (def.aura && rectDistance(r, footprint(o)) <= def.aura) beauty += def.beauty ?? 0;
  }
  const nearGate = layout.items.some((o) => o.kind === 'porte' && rectDistance(r, footprint(o)) <= 2);
  const isLinked = linked.has(uid);
  const multiplier = isLinked ? (1 + 0.1 * neighbours) * (1 + zone) * (1 + Math.min(0.3, 0.03 * beauty)) * (nearGate ? 1.15 : 1) : 0;
  return { connected: isLinked, neighbours, zoneSize, zone, beauty, nearGate, multiplier };
}

let uidCounter = 0;
export const newUid = () => `b${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

/**
 * Starting layout, laid out like a real airport: the terminal side on the
 * left (24 × 20 plot, fence at x = 14) with the terminal, corridors and the
 * player's current shops around it; the runway side on the right with two
 * gates on the fence, their stands, taxiways and the runway.
 */
export function starterLayout(shopIds: string[] = []): CityLayout {
  const layout: CityLayout = { version: CITY_VERSION, width: 24, depth: 20, airsideX: 14, items: [] };
  const add = (kind: BuildingKind, x: number, z: number, rot: 0 | 1 = 0, shopId?: string) =>
    place(layout, { uid: newUid(), kind, x, z, rot, shopId });
  add('terminal', 10, 8);
  add('porte', 13, 8, 1);
  add('porte', 13, 10, 1);
  for (let x = 7; x <= 13; x++) add('couloir', x, 7);
  for (let z = 8; z <= 11; z++) add('couloir', 9, z);
  for (let x = 10; x <= 12; x++) add('couloir', x, 11);
  const spots: [number, number][] = [[7, 5], [9, 5], [11, 5], [7, 8], [7, 10], [9, 12], [11, 12], [5, 6], [5, 8], [5, 10]];
  shopIds.slice(0, spots.length).forEach((id, i) => add('salle', spots[i][0], spots[i][1], 0, id));
  add('arbre', 13, 12);
  add('parterre', 13, 13);
  // Runway side.
  add('stand', 14, 8);
  add('stand', 14, 10);
  for (let x = 16; x <= 19; x++) {
    add('voie', x, 9);
    add('voie', x, 10);
  }
  for (let z = 3; z <= 14; z++) add('voie', 20, z);
  add('piste', 21, 3);
  add('tour', 16, 15);
  return layout;
}

/**
 * Auto layout grid used when the game places rooms by itself: corridors run
 * along "streets" (rows z ≡ 1 mod 3 and columns x ≡ 0 mod 5) and rooms fill
 * the 2 × 2 blocks between them, so the network never closes on itself.
 * The player can move anything anywhere afterwards.
 */
export const isStreet = (x: number, z: number) => z % 3 === 1 || x % 5 === 0;
const isRoomSpot = (x: number, z: number) => z % 3 === 2 && (x % 5 === 1 || x % 5 === 3);

/**
 * Starting airport of a game (GDD §24), 32 × 24 tiles, fence at x = 20.
 * The player owns the 3 × 3 plots around the terminal (17 room spots); the
 * runway side is open. Rooms of the floors already built are placed by
 * `autoPlaceRoom` (that is how tower saves are converted).
 */
export function gameStarterLayout(): CityLayout {
  const layout: CityLayout = { version: CITY_VERSION, width: 32, depth: 24, airsideX: 20, items: [], plots: [], next: 1 };
  for (let pz = 1; pz <= 3; pz++) for (let px = 2; px <= 4; px++) layout.plots!.push(plotKey(px, pz));
  const add = (kind: BuildingKind, x: number, z: number, rot: 0 | 1 = 0) => place(layout, { uid: `b${layout.next!++}`, kind, x, z, rot });
  add('terminal', 16, 8);
  add('porte', 19, 8, 1);
  add('couloir', 19, 10);
  add('porte', 19, 11, 1);
  for (let x = 10; x <= 19; x++) add('couloir', x, 7);
  for (let x = 11; x <= 15; x++) add('couloir', x, 10);
  for (let x = 11; x <= 19; x++) if (x !== 19) add('couloir', x, 13);
  for (let z = 4; z <= 15; z++) add('couloir', 10, z);
  add('arbre', 15, 8);
  add('parterre', 15, 9);
  // Runway side.
  add('stand', 20, 8);
  add('stand', 20, 11);
  for (let x = 22; x <= 25; x++) {
    add('voie', x, 9);
    add('voie', x, 11);
  }
  for (let z = 3; z <= 18; z++) add('voie', 26, z);
  add('piste', 27, 3);
  add('tour', 22, 15);
  return layout;
}

/**
 * Places the room of `floor` on the auto layout grid, linked to the
 * terminal: the nearest free block beside a linked corridor, else the
 * nearest one reached by laying corridor tiles along the streets. Returns
 * false when the open land is full (the room waits for a new plot).
 */
export function autoPlaceRoom(layout: CityLayout, floor: number): boolean {
  const id = () => `b${(layout.next = (layout.next ?? 1) + 1) - 1}`;
  const room = (x: number, z: number): Placed => ({ uid: '', kind: 'salle', x, z, rot: 0, floor });
  const linked = connected(layout);
  const hubs = layout.items.filter((p) => linked.has(p.uid) && BUILDINGS[p.kind].walkable).map(footprint);
  const terminal = layout.items.find((p) => p.kind === 'terminal');
  const t = terminal ? footprint(terminal) : { x: 0, z: 0, w: 0, d: 0 };
  const dist = (x: number, z: number) => Math.abs(x - t.x - 1) + Math.abs(z - t.z - 1);
  const spots: [number, number][] = [];
  for (let z = 0; z < layout.depth - 1; z++) for (let x = 0; x < layout.airsideX - 1; x++) if (isRoomSpot(x, z)) spots.push([x, z]);
  spots.sort((a, b) => dist(a[0], a[1]) - dist(b[0], b[1]));
  for (const [x, z] of spots) {
    const r = room(x, z);
    if (canPlace(layout, r) && hubs.some((h) => touching(h, footprint(r)))) return place(layout, { ...r, uid: id() });
  }
  // Lay corridors: shortest path along free street tiles from the network.
  const free = (x: number, z: number) =>
    x >= 0 && z >= 0 && x < layout.airsideX && z < layout.depth && isStreet(x, z) && !itemAt(layout, x, z) && inOpenLand(layout, { x, z, w: 1, d: 1 });
  const key = (x: number, z: number) => x * 1000 + z;
  const parent = new Map<number, number>();
  const queue: [number, number][] = [];
  for (let z = 0; z < layout.depth; z++)
    for (let x = 0; x < layout.airsideX; x++)
      if (free(x, z) && hubs.some((h) => touching(h, { x, z, w: 1, d: 1 }))) {
        parent.set(key(x, z), -1);
        queue.push([x, z]);
      }
  for (let qi = 0; qi < queue.length; qi++) {
    const [x, z] = queue[qi];
    const tile = { x, z, w: 1, d: 1 };
    const spot = spots.map(([sx, sz]) => room(sx, sz)).find((r) => touching(tile, footprint(r)) && canPlace(layout, r));
    if (spot) {
      for (let k = key(x, z); k !== -1; k = parent.get(k)!) place(layout, { uid: id(), kind: 'couloir', x: Math.floor(k / 1000), z: k % 1000, rot: 0 });
      return place(layout, { ...spot, uid: id() });
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (free(nx, nz) && !parent.has(key(nx, nz))) {
        parent.set(key(nx, nz), key(x, z));
        queue.push([nx, nz]);
      }
    }
  }
  return false;
}

/**
 * Flat airport ("city builder") layout — prototype, step 1 of the pivot away
 * from the tower. Pure logic: a grid of tiles where buildings are placed,
 * moved, rotated and removed, plus the placement rules that give positions a
 * meaning (connection to the terminal, neighbours sharing an element,
 * category zones, distance to the gates, beauty auras of decorations).
 * Not wired into GameState yet: the prototype keeps its own layout.
 */
import { SHOPS, type ShopDef } from './data/shops';
import type { Element, ShopCategory } from './types';

export type BuildingKind = 'terminal' | 'couloir' | 'salle' | 'porte' | 'piste' | 'tour' | 'arbre' | 'banc' | 'parterre' | 'fontaine';

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
  /** Decoration: beauty given to rooms within this many tiles. */
  aura?: number;
  beauty?: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  terminal: { name: 'Terminal', emoji: '🛎️', w: 3, d: 3, walkable: true, unique: true },
  couloir: { name: 'Couloir', emoji: '▫️', w: 1, d: 1, walkable: true },
  salle: { name: 'Salle', emoji: '🏪', w: 2, d: 2 },
  porte: { name: 'Porte', emoji: '🚪', w: 2, d: 1 },
  piste: { name: 'Piste', emoji: '🛫', w: 2, d: 10 },
  tour: { name: 'Tour de contrôle', emoji: '🗼', w: 2, d: 2, unique: true },
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
  /** Rooms only: the shop it holds (ShopDef id). */
  shopId?: string;
}

export interface CityLayout {
  width: number;
  depth: number;
  items: Placed[];
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

/** Whether `p` fits: inside the land, on free tiles (ignoring `p` itself), and not a second unique building. */
export function canPlace(layout: CityLayout, p: Placed): boolean {
  const r = footprint(p);
  if (r.x < 0 || r.z < 0 || r.x + r.w > layout.width || r.z + r.d > layout.depth) return false;
  if (BUILDINGS[p.kind].unique && layout.items.some((o) => o.kind === p.kind && o.uid !== p.uid)) return false;
  return !layout.items.some((o) => o.uid !== p.uid && overlap(footprint(o), r));
}

/** Places a new building or moves an existing one (same uid). Returns false if it does not fit. */
export function place(layout: CityLayout, p: Placed): boolean {
  if (!canPlace(layout, p)) return false;
  const i = layout.items.findIndex((o) => o.uid === p.uid);
  if (i >= 0) layout.items[i] = { ...p };
  else layout.items.push({ ...p });
  return true;
}

export function remove(layout: CityLayout, uid: string): boolean {
  const i = layout.items.findIndex((o) => o.uid === uid);
  if (i < 0 || layout.items[i].kind === 'terminal') return false;
  layout.items.splice(i, 1);
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

const shopById = new Map(SHOPS.map((s) => [s.id, s]));
export const shopOf = (p: Placed): ShopDef | undefined => (p.shopId ? shopById.get(p.shopId) : undefined);

const shareElement = (a: Element[], b: Element[]) => a.some((e) => e !== 'neutre' && b.includes(e)) || (a.includes('neutre') && b.includes('neutre'));

/** Rooms of the same category linked by touching each other. */
export function zoneOf(layout: CityLayout, uid: string): Placed[] {
  const start = layout.items.find((p) => p.uid === uid);
  const cat = start && shopOf(start)?.category;
  if (!start || !cat) return [];
  const same = layout.items.filter((p) => p.kind === 'salle' && shopOf(p)?.category === cat);
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

export function roomBonus(layout: CityLayout, uid: string, linked = connected(layout)): RoomBonus {
  const p = layout.items.find((o) => o.uid === uid);
  const shop = p && shopOf(p);
  if (!p || !shop) return { connected: false, neighbours: 0, zoneSize: 0, zone: 0, beauty: 0, nearGate: false, multiplier: 0 };
  const r = footprint(p);
  const neighbours = layout.items.filter((o) => {
    const s = o.uid !== uid && o.kind === 'salle' ? shopOf(o) : undefined;
    return s && touching(r, footprint(o)) && shareElement(shop.elements, s.elements);
  }).length;
  const zoneSize = zoneOf(layout, uid).length;
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
 * Starting layout: a 20 × 20 plot with the terminal in the middle, a runway
 * along one edge, the control tower, and the player's current shops placed
 * in a ring of corridors around the terminal (how saves will be converted).
 */
export function starterLayout(shopIds: string[] = []): CityLayout {
  const layout: CityLayout = { width: 20, depth: 20, items: [] };
  const add = (kind: BuildingKind, x: number, z: number, rot: 0 | 1 = 0, shopId?: string) =>
    place(layout, { uid: newUid(), kind, x, z, rot, shopId });
  add('terminal', 8, 8);
  add('piste', 17, 2);
  add('tour', 14, 2);
  add('porte', 11, 9, 1);
  // Corridors around the terminal, then rooms on their outer side.
  for (let x = 7; x <= 11; x++) add('couloir', x, 7);
  for (let x = 7; x <= 10; x++) add('couloir', x, 11);
  add('couloir', 7, 8);
  add('couloir', 7, 9);
  add('couloir', 7, 10);
  const spots: [number, number][] = [[7, 5], [9, 5], [11, 5], [5, 7], [5, 9], [5, 11], [7, 12], [9, 12], [3, 7], [3, 9], [3, 11], [13, 5]];
  shopIds.slice(0, spots.length).forEach((id, i) => add('salle', spots[i][0], spots[i][1], 0, id));
  add('arbre', 12, 12);
  add('parterre', 11, 12);
  return layout;
}

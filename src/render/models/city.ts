/**
 * Cube art models of the flat airport (city builder prototype). One tile of
 * the layout is TILE voxels wide; each model is built at its rotated
 * footprint, its corner at the origin, standing on y = 1 (y = 0 is the ground).
 */
import { BUILDINGS, footprint, shopOf, type CityLayout, type Placed } from '../../core/city';
import { CATEGORIES } from '../../core/data/shops';
import { darken, grain, lighten, NEUTRAL_PALETTE, paletteFor, rng, toHex } from '../palette';
import { VoxelGrid } from '../voxel';

export const TILE = 6;

const [WALL, BLUE, DARK, ORANGE] = NEUTRAL_PALETTE.map(toHex);
const GRASS = [0x8cc06b, 0x84b964];
const GLASS = 0x5b8fc9;

const CATEGORY_COLOR: Record<string, number> = { resto: 0xf4a259, boutique: 0xe56b9f, detente: 0x7cc6a4, service: 0x6c8ebf, loisir: 0xa883d8 };

/** Fence along the runway side, with a gap in front of each gate. */
export function buildFenceModel(layout: CityLayout): VoxelGrid {
  const D = layout.depth * TILE;
  const g = new VoxelGrid(1, 4, D);
  const gates = layout.items.filter((p) => p.kind === 'porte').map(footprint);
  for (let z = 0; z < D; z++) {
    const tz = Math.floor(z / TILE);
    if (gates.some((r) => tz >= r.z && tz < r.z + r.d)) continue;
    if (z % 3 === 0) g.box(0, 1, z, 0, 3, z, 0x6b6f7a);
    g.set(0, 3, z, 0xd6d9df);
    if (z % 2) g.set(0, 2, z, 0xd6d9df);
  }
  return g;
}

/** Grass on the terminal side, concrete on the runway side, faint tile seams. */
export function buildGroundModel(layout: CityLayout): VoxelGrid {
  const W = layout.width * TILE;
  const D = layout.depth * TILE;
  const g = new VoxelGrid(W, 1, D);
  const rand = rng(11);
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) {
      const tx = Math.floor(x / TILE);
      const tz = Math.floor(z / TILE);
      const seam = x % TILE === 0 || z % TILE === 0;
      const airside = tx >= layout.airsideX;
      const base = airside ? (tz % 2 ? 0xb9bcc4 : 0xb3b6be) : GRASS[(tx + tz) % 2];
      g.set(x, 0, z, grain(rand, seam ? darken(base, airside ? 0.12 : 0.06) : base, 0.03));
    }
  return g;
}

export function buildPlacedModel(p: Placed): VoxelGrid {
  const r = footprint(p);
  const W = r.w * TILE;
  const D = r.d * TILE;
  const seed = [...p.uid].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rand = rng(seed);
  switch (p.kind) {
    case 'terminal': return terminal(W, D, rand);
    case 'couloir': return corridor(W, D, rand);
    case 'salle': return room(p, W, D, rand);
    case 'porte': return gate(W, D);
    case 'piste': return runway(W, D);
    case 'voie': return taxiway(W, D, rand);
    case 'stand': return stand(W, D);
    case 'tour': return tower(W, D, rand);
    case 'arbre': return tree(W, D, rand);
    case 'banc': return bench(W, D);
    case 'parterre': return flowerBed(W, D, rand);
    case 'fontaine': return fountain(W, D);
  }
}

function slab(g: VoxelGrid, W: number, D: number, color: number, rand: () => number) {
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) g.set(x, 0, z, grain(rand, (x + z) % 2 ? color : lighten(color, 0.06), 0.03));
}

function terminal(W: number, D: number, rand: () => number): VoxelGrid {
  const H = 10;
  const g = new VoxelGrid(W, H + 3, D);
  slab(g, W, D, 0xd9d4c7, rand);
  g.box(1, 1, 1, W - 2, H - 1, D - 2, WALL);
  // Glass band on every side, darker frames.
  g.box(1, 3, 1, W - 2, 6, D - 2, GLASS);
  for (let x = 2; x < W - 2; x += 4) { g.box(x, 3, D - 2, x, 6, D - 2, DARK); }
  for (let z = 2; z < D - 2; z += 4) { g.box(W - 2, 3, z, W - 2, 6, z, DARK); }
  g.box(2, 2, 2, W - 3, H - 2, D - 3, WALL);
  // Roof with a dark rim and the yellow IdlePort sign.
  g.box(0, H, 0, W - 1, H, D - 1, darken(WALL, 0.2));
  g.box(0, H, 0, W - 1, H, 0, DARK).box(0, H, D - 1, W - 1, H, D - 1, DARK).box(0, H, 0, 0, H, D - 1, DARK).box(W - 1, H, 0, W - 1, H, D - 1, DARK);
  g.box(4, H + 1, D - 3, W - 5, H + 2, D - 3, 0xffcf3a);
  // Entrance (front, +z) with a canopy.
  g.box(Math.floor(W / 2) - 2, 1, D - 2, Math.floor(W / 2) + 1, 3, D - 2, 0x2a3a52);
  g.box(Math.floor(W / 2) - 3, 4, D - 1, Math.floor(W / 2) + 2, 4, D - 1, BLUE);
  return g;
}

function corridor(W: number, D: number, rand: () => number): VoxelGrid {
  const g = new VoxelGrid(W, 1, D);
  slab(g, W, D, 0xe3ddd0, rand);
  // Blue carpet runner in the middle.
  for (let z = 2; z < D - 2; z++) for (let x = 2; x < W - 2; x++) g.set(x, 0, z, 0x7f9fd1);
  return g;
}

function room(p: Placed, W: number, D: number, rand: () => number): VoxelGrid {
  const shop = shopOf(p);
  const [main, accent] = (shop?.colors ?? ['#cccccc', '#888888']).map(toHex);
  const pal = paletteFor(shop?.elements[0] ?? 'neutre');
  const H = 7;
  const g = new VoxelGrid(W, H + 3, D);
  slab(g, W, D, lighten(pal[2], 0.4), rand);
  g.box(1, 1, 1, W - 2, H - 1, D - 2, grain(rand, lighten(main, 0.25), 0.02));
  // Shop windows on the two faces seen by the camera.
  g.box(2, 2, D - 2, W - 3, 4, D - 2, GLASS).box(W - 2, 2, 2, W - 2, 4, D - 3, GLASS);
  g.box(Math.floor(W / 2) - 1, 1, D - 2, Math.floor(W / 2), 3, D - 2, darken(main, 0.4));
  // Striped awning.
  for (let x = 1; x < W - 1; x++) g.set(x, 5, D - 1, x % 2 ? accent : 0xffffff);
  for (let z = 1; z < D - 1; z++) g.set(W - 1, 5, z, z % 2 ? accent : 0xffffff);
  // Roof in the accent color, a sign in the category color.
  g.box(1, H, 1, W - 2, H, D - 2, darken(accent, 0.1));
  const cat = CATEGORY_COLOR[shop?.category ?? 'resto'] ?? ORANGE;
  g.box(3, H + 1, 3, W - 4, H + 2, D - 4, cat).box(4, H + 2, 4, W - 5, H + 2, D - 5, lighten(cat, 0.4));
  return g;
}

function gate(W: number, D: number): VoxelGrid {
  const g = new VoxelGrid(W, 6, D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) g.set(x, 0, z, 0x6b6f7a);
  const long = W >= D;
  // Jet bridge: a grey tube on legs with a blue stripe, a yellow guide line.
  if (long) {
    g.box(0, 3, 1, W - 2, 4, D - 2, 0xc9ccd3).box(0, 4, 1, W - 2, 4, D - 2, BLUE);
    for (const x of [2, W - 4]) g.box(x, 1, 2, x, 2, 2, DARK);
    for (let x = 0; x < W; x += 2) g.set(x, 0, D - 1, 0xffd23f);
  } else {
    g.box(1, 3, 0, W - 2, 4, D - 2, 0xc9ccd3).box(1, 4, 0, W - 2, 4, D - 2, BLUE);
    for (const z of [2, D - 4]) g.box(2, 1, z, 2, 2, z, DARK);
    for (let z = 0; z < D; z += 2) g.set(W - 1, 0, z, 0xffd23f);
  }
  return g;
}

function runway(W: number, D: number): VoxelGrid {
  const g = new VoxelGrid(W, 1, D);
  const long = D >= W;
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) {
      const along = long ? z : x;
      const across = long ? x : z;
      const span = long ? W : D;
      const edge = across === 0 || across === span - 1;
      const centre = (across === Math.floor(span / 2) || across === Math.floor(span / 2) - 1) && along % 6 < 3;
      g.set(x, 0, z, edge ? (along % 4 === 0 ? 0xffe28a : 0xeeeeee) : centre ? 0xffffff : 0x3a3d48);
    }
  return g;
}

function taxiway(W: number, D: number, rand: () => number): VoxelGrid {
  const g = new VoxelGrid(W, 1, D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) g.set(x, 0, z, grain(rand, 0x4a4d58, 0.03));
  // Yellow centre dot: lines up into a guide line across a row of taxiways.
  const c = Math.floor(W / 2);
  g.box(c - 1, 0, c - 1, c, 0, c, 0xffd23f);
  return g;
}

function stand(W: number, D: number): VoxelGrid {
  const g = new VoxelGrid(W, 1, D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) g.set(x, 0, z, (x + z) % 2 ? 0xc9ccd3 : 0xc3c6cd);
  // Yellow lead-in line and stop bar, red safety box at the gate end.
  const c = Math.floor(D / 2);
  for (let x = 1; x < W - 1; x++) g.set(x, 0, c, 0xffd23f);
  g.box(2, 0, c - 3, 2, 0, c + 3, 0xffd23f);
  g.box(0, 0, 0, 0, 0, D - 1, 0xd9483b);
  return g;
}

function tower(W: number, D: number, rand: () => number): VoxelGrid {
  const g = new VoxelGrid(W, 22, D);
  slab(g, W, D, 0xb9b4a7, rand);
  const cx = Math.floor(W / 2);
  const cz = Math.floor(D / 2);
  g.box(cx - 2, 1, cz - 2, cx + 1, 15, cz + 1, grain(rand, WALL, 0.02));
  g.box(cx - 4, 16, cz - 4, cx + 3, 18, cz + 3, BLUE).box(cx - 3, 17, cz - 3, cx + 2, 17, cz + 2, 0x1a2333);
  g.box(cx - 4, 19, cz - 4, cx + 3, 19, cz + 3, DARK).box(cx - 1, 20, cz - 1, cx, 21, cz, 0xff4a3d);
  return g;
}

function tree(W: number, D: number, rand: () => number): VoxelGrid {
  const g = new VoxelGrid(W, 10, D);
  const c = Math.floor(W / 2);
  g.box(c - 1, 1, c - 1, c, 3, c, 0x7a5230);
  const leaf = [0x4f9d4a, 0x5fb35a, 0x468c42];
  for (let y = 4; y <= 8; y++)
    for (let z = 0; z < D; z++)
      for (let x = 0; x < W; x++) {
        const dx = x - c + 0.5;
        const dz = z - c + 0.5;
        const dy = (y - 6) * 1.2;
        if (dx * dx + dz * dz + dy * dy < 9.5 + rand()) g.set(x, y, z, leaf[Math.floor(rand() * 3)]);
      }
  return g;
}

function bench(W: number, D: number): VoxelGrid {
  const g = new VoxelGrid(W, 4, D);
  g.box(1, 1, 2, W - 2, 1, 2, DARK).box(1, 1, D - 3, W - 2, 1, D - 3, DARK);
  g.box(1, 2, 2, W - 2, 2, D - 3, ORANGE).box(1, 3, 2, W - 2, 3, 2, darken(ORANGE, 0.2));
  return g;
}

function flowerBed(W: number, D: number, rand: () => number): VoxelGrid {
  const g = new VoxelGrid(W, 3, D);
  g.box(0, 1, 0, W - 1, 1, D - 1, 0xb08a5a).box(1, 1, 1, W - 2, 1, D - 2, 0x5b3d24);
  const petals = [0xff6b8b, 0xffd23f, 0xffffff, 0xb983ff];
  for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++) if ((x + z) % 2 === 0) g.set(x, 2, z, petals[Math.floor(rand() * petals.length)]);
  return g;
}

function fountain(W: number, D: number): VoxelGrid {
  const g = new VoxelGrid(W, 8, D);
  g.box(0, 1, 0, W - 1, 2, D - 1, 0xc7c2b6).box(1, 2, 1, W - 2, 2, D - 2, 0x58b7e8);
  const c = Math.floor(W / 2);
  g.box(c - 1, 3, c - 1, c, 4, c, 0xc7c2b6).box(c - 1, 5, c - 1, c, 6, c, 0x9ad9f5).set(c, 7, c, 0xd8f3ff);
  return g;
}

/** Ghost of the building being placed: its footprint, green if it fits, red if not. */
export function buildGhostModel(p: Placed, ok: boolean): VoxelGrid {
  const r = footprint(p);
  const g = new VoxelGrid(r.w * TILE, 2, r.d * TILE);
  const color = ok ? 0x6be37a : 0xff5a5a;
  g.box(0, 0, 0, r.w * TILE - 1, 0, r.d * TILE - 1, lighten(color, 0.3));
  g.box(0, 1, 0, r.w * TILE - 1, 1, 0, color).box(0, 1, r.d * TILE - 1, r.w * TILE - 1, 1, r.d * TILE - 1, color);
  g.box(0, 1, 0, 0, 1, r.d * TILE - 1, color).box(r.w * TILE - 1, 1, 0, r.w * TILE - 1, 1, r.d * TILE - 1, color);
  return g;
}

/** Red "!" floating over a room or gate not linked to the terminal. */
export function buildAlertModel(): VoxelGrid {
  const g = new VoxelGrid(3, 7, 3);
  g.box(0, 2, 0, 2, 6, 2, 0xff4a3d).box(1, 3, 2, 1, 5, 2, 0xffffff).box(0, 0, 0, 2, 1, 2, 0xff4a3d).set(1, 0, 2, 0xffffff);
  return g;
}

export const kindHeight = (p: Placed) => (p.kind === 'tour' ? 22 : p.kind === 'terminal' ? 13 : p.kind === 'salle' ? 10 : 6);
export const CATEGORY_NAMES = Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, v.name]));
export { BUILDINGS };

import type { ShopDef } from '../../core/data/shops';
import type { Element, ShopCategory } from '../../core/types';
import { darken, grain, lighten, paletteFor, pick, rng, toHex } from '../palette';
import { VoxelGrid } from '../voxel';
import { addPerson } from './props';

/** Every floor of the tower shares these dimensions (in voxels). */
export const FLOOR = { width: 24, height: 9, depth: 10 } as const;

export interface FloorModelOptions {
  shop?: ShopDef;
  /** Wall color picked by the player (FloorState.wallColor). */
  wallColor?: string;
  /** Floor under construction: scaffolding, no shop. */
  building?: boolean;
  /** Same seed → same layout. Use the floor number. */
  seed: number;
}

/**
 * A floor is a dollhouse cut: slab, back wall (z = 0) and left wall (x = 0);
 * the front and the right side stay open toward the iso camera. The ceiling
 * is the slab of the floor above.
 */
export function buildFloorModel(opts: FloorModelOptions): VoxelGrid {
  const { width: W, height: H, depth: D } = FLOOR;
  const rand = rng(opts.seed * 7919 + 17);
  const g = new VoxelGrid(W, H, D);
  const element: Element = opts.shop?.elements[0] ?? 'neutre';
  const pal = paletteFor(element);
  const wall = opts.wallColor ? toHex(opts.wallColor) : lighten(pal[0], 0.35);
  const floorTile = lighten(pal[2], 0.35);

  // Slab with a checker tile pattern, then the two walls with a skirting board.
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) g.set(x, 0, z, grain(rand, (x + z) % 2 ? floorTile : lighten(floorTile, 0.08)));
  for (let y = 1; y < H; y++) {
    for (let x = 0; x < W; x++) g.set(x, y, 0, grain(rand, y === 1 ? darken(wall, 0.35) : wall, 0.03));
    for (let z = 0; z < D; z++) g.set(0, y, z, grain(rand, y === 1 ? darken(wall, 0.35) : darken(wall, 0.05), 0.03));
  }
  // Darker slab edge on the open sides: the facade band that separates floors.
  g.box(0, 0, D - 1, W - 1, 0, D - 1, 0x2b2d42).box(W - 1, 0, 0, W - 1, 0, D - 1, 0x3a3d52);

  if (opts.building) {
    addScaffolding(g, rand);
    return g;
  }
  if (!opts.shop) return g;

  const [main, accent] = opts.shop.colors.map(toHex);
  addSign(g, main, accent);
  CATEGORY_LAYOUTS[opts.shop.category](g, main, accent, pal, rand);
  COUNTRY_DECOR[element]?.(g, pal, rand);
  const people = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < people; i++) addPerson(g, 3 + Math.floor(rand() * (W - 8)), 1, 6 + Math.floor(rand() * 3), rand);
  return g;
}

function addSign(g: VoxelGrid, main: number, accent: number): void {
  g.box(8, 6, 1, 15, 7, 1, main);
  for (let x = 9; x <= 14; x += 2) g.set(x, 7, 1, accent);
  g.box(8, 5, 1, 15, 5, 1, darken(main, 0.4));
}

function addScaffolding(g: VoxelGrid, rand: () => number): void {
  const pole = 0x8a8f98;
  for (const x of [3, 11, 19]) for (const z of [2, 7]) g.box(x, 1, z, x, 7, z, pole);
  for (const y of [3, 6]) {
    g.box(3, y, 2, 19, y, 2, pole);
    g.box(3, y, 7, 19, y, 7, 0xc89b5a);
  }
  // Hazard stripes along the front edge.
  for (let x = 1; x < g.width - 1; x++) g.set(x, 1, g.depth - 1, Math.floor(x / 2) % 2 ? 0xffcf3a : 0x222222);
  for (let i = 0; i < 4; i++) g.box(4 + i * 4, 1, 4, 5 + i * 4, 1 + Math.floor(rand() * 2), 5, 0x9c6b3c);
}

type Layout = (g: VoxelGrid, main: number, accent: number, pal: number[], rand: () => number) => void;

const CATEGORY_LAYOUTS: Record<ShopCategory, Layout> = {
  resto(g, main, accent, _pal, rand) {
    g.box(3, 1, 1, 15, 3, 2, darken(main, 0.15));
    g.box(3, 3, 1, 15, 3, 2, accent);
    g.box(5, 4, 1, 6, 5, 1, 0x3a3a3a); // coffee machine
    for (let i = 0; i < 2; i++) {
      const x = 5 + i * 8 + Math.floor(rand() * 2);
      g.box(x, 1, 6, x, 2, 6, 0x5a3b2a).box(x - 1, 3, 5, x + 1, 3, 7, lighten(main, 0.3));
      g.set(x - 2, 1, 6, accent).set(x + 2, 1, 6, accent);
    }
  },
  boutique(g, main, accent, pal, rand) {
    for (let x = 2; x <= 18; x += 4) {
      g.box(x, 1, 1, x + 2, 5, 1, darken(main, 0.3));
      for (const y of [2, 4]) for (let i = 0; i < 3; i++) g.set(x + i, y, 2, grain(rand, pick(rand, [...pal, accent]), 0.1));
    }
    g.box(9, 1, 5, 14, 2, 7, main).box(10, 3, 6, 13, 3, 6, accent);
  },
  detente(g, main, accent, _pal, rand) {
    g.box(3, 1, 4, 14, 1, 8, lighten(accent, 0.2)); // rug
    g.box(4, 1, 1, 12, 2, 2, main).box(4, 3, 1, 12, 3, 1, darken(main, 0.2)); // sofa
    g.box(4, 3, 2, 4, 3, 2, main).box(12, 3, 2, 12, 3, 2, main);
    g.box(16, 1, 2, 17, 2, 3, 0x7a4b2a).box(16, 3, 2, 17, 5 + Math.floor(rand() * 2), 3, 0x3f9b4a); // plant
  },
  service(g, main, accent, _pal, rand) {
    g.box(4, 1, 2, 16, 3, 3, main).box(4, 3, 2, 16, 3, 3, lighten(main, 0.3));
    for (const x of [6, 11, 15]) g.box(x, 4, 2, x + 1, 5, 2, 0x22262e).set(x, 5, 3, accent);
    for (let x = 5; x <= 15; x += 5) g.box(x, 1, 7, x, 3, 7, 0xb8bcc6);
    g.box(5, 3, 7, 15, 3, 7, darken(accent, 0.2 * rand()));
  },
  loisir(g, main, accent, pal, rand) {
    for (let i = 0; i < 4; i++) {
      const x = 2 + i * 4;
      g.box(x, 1, 1, x + 2, 5, 2, main);
      g.box(x, 3, 3, x + 2, 4, 3, pick(rand, pal)).set(x + 1, 2, 3, accent);
    }
    g.box(18, 1, 5, 20, 2, 7, darken(main, 0.2)).box(18, 3, 5, 20, 3, 7, 0x2e8b57);
  },
};

type Decor = (g: VoxelGrid, pal: number[], rand: () => number) => void;

/** Small country touches so a floor reads as tropical, infernal, digital… */
const COUNTRY_DECOR: Partial<Record<Element, Decor>> = {
  tropicalia(g) {
    g.box(20, 1, 2, 20, 6, 2, 0x8b5a2b);
    for (const [dx, dz] of [[-2, 0], [2, 0], [0, -1], [0, 2], [-1, 1], [1, 1]]) g.set(20 + dx, 7, 2 + dz, 0x2fa84f);
    g.set(20, 7, 2, 0x1d8a6e);
  },
  infernia(g, pal, rand) {
    for (let i = 0; i < 10; i++) g.set(1 + Math.floor(rand() * 20), 0, 3 + Math.floor(rand() * 6), pick(rand, [pal[0], 0xffa024]));
    g.box(20, 1, 2, 21, 1, 3, 0x3b1d1d).set(20, 2, 2, 0xff5a1f).set(21, 2, 3, 0xffa024);
  },
  bitopia(g, pal) {
    for (let x = 2; x < g.width - 1; x += 4) for (let z = 2; z < g.depth - 1; z += 3) g.set(x, 0, z, pal[1]);
    g.box(20, 1, 2, 21, 4, 3, pal[2]).set(20, 3, 4, pal[1]).set(21, 2, 4, pal[3]);
  },
  givrebourg(g, pal) {
    for (const [x, h] of [[19, 3], [20, 5], [21, 2]]) g.box(x, 1, 2, x, h, 2, pal[3]);
    g.set(20, 6, 2, pal[1]);
  },
  desolande(g, pal) {
    g.box(20, 1, 2, 20, 4, 2, 0x5f8f3a).box(19, 3, 2, 19, 4, 2, 0x5f8f3a).set(21, 3, 2, 0x5f8f3a);
    g.box(17, 1, 3, 18, 1, 4, darken(pal[0], 0.3));
  },
  melodia(g, pal) {
    g.box(19, 1, 2, 21, 4, 3, 0x1e1b2e).set(20, 2, 4, pal[1]).set(20, 3, 4, pal[0]);
  },
  gourmandie(g, pal) {
    g.box(19, 1, 2, 21, 2, 4, pal[1]).box(19, 3, 2, 21, 3, 4, pal[3]).set(20, 4, 3, 0xd7263d);
  },
  nuagelande(g, pal) {
    for (const [x, z] of [[18, 3], [19, 3], [20, 3], [19, 4], [21, 4]]) g.set(x, 6, z, lighten(pal[0], 0.6));
  },
};

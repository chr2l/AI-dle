import type { Element } from '../../core/types';
import { darken, grain, lighten, paletteFor, pick, rng } from '../palette';
import { VoxelGrid } from '../voxel';
import { FLOOR } from './floor';

/**
 * The land around the tower, themed by a country (the featured country of
 * the week in game): ground, apron, runway, taxiway, road with a car park,
 * a hangar and seeded vegetation / props. Static, so it is one mesh; cars,
 * clouds and planes move on top of it (see airport.ts).
 *
 * World layout (the tower stands on x 0..23, z 0..9):
 * - apron in front of the tower, runway further along +z, parallel to x;
 * - a road on the left of the tower, along z.
 */
export const SCENERY = {
  /** World position of the grid's (0, 0, 0) cell. */
  origin: { x: -44, y: -1, z: -34 },
  width: 140,
  depth: 112,
  height: 14,
  runway: { x0: -40, x1: 92, z0: 44, z1: 52 },
  apron: { x0: -4, x1: 62, z0: FLOOR.depth, z1: 36 },
  road: { x0: -16, x1: -12 },
} as const;

export const RUNWAY_CENTER_Z = (SCENERY.runway.z0 + SCENERY.runway.z1) / 2;

export interface Theme {
  /** Background color behind the scene. */
  sky: number;
  ground: number;
  groundAlt: number;
  /** Draws one decor item with its base at (x, y, z) in grid coordinates. */
  item: (g: VoxelGrid, x: number, y: number, z: number, rand: () => number, pal: number[]) => void;
}

const tree = (g: VoxelGrid, x: number, y: number, z: number, trunk: number, leaves: number, h: number) => {
  g.box(x, y, z, x, y + h - 1, z, trunk);
  g.box(x - 1, y + h, z - 1, x + 1, y + h + 1, z + 1, leaves).set(x, y + h + 2, z, lighten(leaves, 0.1));
};

const THEMES: Record<Element, Theme> = {
  neutre: {
    sky: 0x8fd3ff,
    ground: 0x6aa84f, groundAlt: 0x5e9a45,
    item: (g, x, y, z, rand) => (rand() < 0.75 ? tree(g, x, y, z, 0x7a4b2a, pick(rand, [0x3f9b4a, 0x2f8a3f, 0x58b05a]), 2 + Math.floor(rand() * 2)) : g.box(x, y, z, x + 1, y, z + 1, 0xe8d36b)),
  },
  tropicalia: {
    sky: 0x6fd6ff,
    ground: 0xe9d38f, groundAlt: 0x7bc96f,
    item: (g, x, y, z, rand) => {
      if (rand() < 0.3) return void g.box(x - 1, y - 1, z - 1, x + 2, y - 1, z + 2, 0x2ec4d6); // lagoon
      const h = 4 + Math.floor(rand() * 3);
      g.box(x, y, z, x, y + h - 1, z, 0x8b5a2b);
      for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]]) g.set(x + dx, y + h - (Math.abs(dx) + Math.abs(dz) > 1 ? 0 : 1), z + dz, 0x2fa84f);
      g.set(x, y + h, z, 0x1d8a6e);
    },
  },
  givrebourg: {
    sky: 0xbfe0ff,
    ground: 0xf2f8ff, groundAlt: 0xdcefff,
    item: (g, x, y, z, rand) => {
      if (rand() < 0.3) return void g.box(x, y, z, x + 1, y + 1 + Math.floor(rand() * 2), z + 1, 0xa8e6ff);
      g.set(x, y, z, 0x6b4a2b);
      for (let i = 0; i < 4; i++) g.box(x - (3 - i) + 1, y + 1 + i, z - (3 - i) + 1, x + (3 - i) - 1, y + 1 + i, z + (3 - i) - 1, i % 2 ? 0x2f6b4f : 0xf4f8ff);
      g.set(x, y + 5, z, 0xf4f8ff);
    },
  },
  desolande: {
    sky: 0xf6c47a,
    ground: 0xd9b26f, groundAlt: 0xcfa45e,
    item: (g, x, y, z, rand) => {
      if (rand() < 0.4) return void g.box(x, y, z, x + 1 + Math.floor(rand() * 2), y + Math.floor(rand() * 2), z + 1, 0x9c7a54);
      const h = 3 + Math.floor(rand() * 3);
      g.box(x, y, z, x, y + h, z, 0x5f8f3a).box(x - 1, y + 2, z, x - 1, y + 3, z, 0x5f8f3a).box(x + 1, y + 1, z, x + 1, y + 2, z, 0x5f8f3a);
    },
  },
  infernia: {
    sky: 0x3a1520,
    ground: 0x3b2a2a, groundAlt: 0x4a3030,
    item: (g, x, y, z, rand) => {
      if (rand() < 0.45) return void g.box(x - 1, y - 1, z - 1, x + 1, y - 1, z + 1, pick(rand, [0xff5a1f, 0xffa024])); // lava pool
      const h = 2 + Math.floor(rand() * 4);
      g.box(x, y, z, x, y + h, z, 0x1e1418).set(x, y + h + 1, z, 0xff5a1f);
    },
  },
  bitopia: {
    sky: 0x0c0f2e,
    ground: 0x1b1f5e, groundAlt: 0x232a72,
    item: (g, x, y, z, rand, pal) => {
      const h = 1 + Math.floor(rand() * 4);
      g.box(x, y, z, x + 1, y + h, z + 1, pick(rand, [pal[1], pal[3], pal[0]])).box(x, y + h + 1, z, x + 1, y + h + 1, z + 1, 0xffffff);
    },
  },
  melodia: {
    sky: 0x4b3285,
    ground: 0x8e6bd1, groundAlt: 0x7f5cc2,
    item: (g, x, y, z, rand, pal) => {
      if (rand() < 0.5) return void g.box(x, y, z, x + 1, y + 3, z + 1, 0x1e1b2e).set(x, y + 2, z + 2, pal[1]).set(x + 1, y + 1, z + 2, pal[1]);
      g.box(x, y, z, x, y + 4, z, 0x1e1b2e).box(x - 1, y, z, x - 1, y + 1, z + 1, 0x1e1b2e).box(x + 1, y + 4, z, x + 2, y + 4, z, 0x1e1b2e); // musical note
    },
  },
  gourmandie: {
    sky: 0xffc9d9,
    ground: 0xffe0b5, groundAlt: 0x9ad18b,
    item: (g, x, y, z, rand, pal) => {
      const h = 3 + Math.floor(rand() * 2);
      g.box(x, y, z, x, y + h - 1, z, 0xf4f4f0);
      g.box(x - 1, y + h, z - 1, x + 1, y + h + 2, z + 1, pick(rand, [pal[3], 0xd7263d, 0x7cc6fe])).set(x, y + h + 1, z + 2, 0xffffff);
    },
  },
  nuagelande: {
    sky: 0xa9d8ff,
    ground: 0xcfe8ff, groundAlt: 0xbcdcf7,
    item: (g, x, y, z, rand) => {
      g.box(x - 1, y, z - 1, x + 1, y + 1, z + 1, 0xffffff).box(x, y + 2, z, x + 1 + Math.floor(rand() * 2), y + 2, z, 0xffffff);
    },
  },
};

export function buildSceneryModel(element: Element = 'neutre', seed = 7): VoxelGrid {
  const { origin, width: W, depth: D, height: H, runway, apron, road } = SCENERY;
  const theme = THEMES[element] ?? THEMES.neutre;
  const pal = paletteFor(element);
  const rand = rng(seed);
  const g = new VoxelGrid(W, H, D);
  // World → grid helpers.
  const gx = (x: number) => x - origin.x;
  const gz = (z: number) => z - origin.z;
  const tower = { x0: gx(0), x1: gx(FLOOR.width - 1), z0: gz(0), z1: gz(FLOOR.depth - 1) };
  const busy = new Uint8Array(W * D); // cells already used, so decor avoids them
  const mark = (x0: number, z0: number, x1: number, z1: number) => {
    for (let z = Math.max(0, z0); z <= Math.min(D - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) busy[z * W + x] = 1;
  };

  // Ground.
  // Ground: soft organic patches of the second color (cheap value noise).
  const patch = (x: number, z: number) => Math.sin(x * 0.19) + Math.sin(z * 0.23 + x * 0.07) + Math.sin((x + z) * 0.09 + 1.7);
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) g.set(x, 0, z, grain(rand, patch(x, z) > 0.9 ? theme.groundAlt : theme.ground, 0.04));
  mark(tower.x0 - 2, tower.z0 - 2, tower.x1 + 2, tower.z1 + 2);

  // Apron (concrete) with parking lines.
  const concrete = 0xb9bcc4;
  g.box(gx(apron.x0), 0, gz(apron.z0), gx(apron.x1), 0, gz(apron.z1), concrete);
  g.box(gx(apron.x0) + 1, 0, gz(apron.z1) - 3, gx(apron.x1) - 8, 0, gz(apron.z1) - 3, 0xf2e94e); // taxi line
  mark(gx(apron.x0) - 1, gz(apron.z0), gx(apron.x1) + 1, gz(apron.z1) + 1);

  // Taxiway down to the runway.
  g.box(gx(apron.x1) - 6, 0, gz(apron.z1), gx(apron.x1) - 2, 0, gz(runway.z0), 0x6b6f78);
  g.box(gx(apron.x1) - 4, 0, gz(apron.z1), gx(apron.x1) - 4, 0, gz(runway.z0), 0xf2e94e);
  mark(gx(apron.x1) - 7, gz(apron.z1), gx(apron.x1) - 1, gz(runway.z0));

  // Runway: asphalt, white edges, dashed center line, threshold stripes, edge lights.
  const asphalt = 0x4a4e57;
  g.box(gx(runway.x0), 0, gz(runway.z0), gx(runway.x1), 0, gz(runway.z1), asphalt);
  g.box(gx(runway.x0), 0, gz(runway.z0), gx(runway.x1), 0, gz(runway.z0), 0xe8e8e8).box(gx(runway.x0), 0, gz(runway.z1), gx(runway.x1), 0, gz(runway.z1), 0xe8e8e8);
  const cz = gz(Math.round(RUNWAY_CENTER_Z));
  for (let x = gx(runway.x0) + 8; x < gx(runway.x1) - 8; x += 6) g.box(x, 0, cz, x + 2, 0, cz, 0xf4f4f0);
  for (const end of [gx(runway.x0) + 2, gx(runway.x1) - 4])
    for (let z = gz(runway.z0) + 2; z <= gz(runway.z1) - 2; z += 2) g.box(end, 0, z, end + 2, 0, z, 0xf4f4f0);
  for (let x = gx(runway.x0); x <= gx(runway.x1); x += 8) g.set(x, 1, gz(runway.z0) - 1, 0xffd23f).set(x, 1, gz(runway.z1) + 1, 0xffd23f);
  mark(gx(runway.x0) - 2, gz(runway.z0) - 2, gx(runway.x1) + 2, gz(runway.z1) + 2);

  // Hangar on the right of the apron.
  const hx0 = gx(apron.x1) + 3;
  const hz0 = gz(apron.z0) + 1;
  g.box(hx0, 1, hz0, hx0 + 14, 7, hz0 + 12, 0x8a8f98).box(hx0, 8, hz0, hx0 + 14, 8, hz0 + 12, darken(0x8a8f98, 0.2));
  g.box(hx0 + 2, 1, hz0 + 12, hx0 + 12, 6, hz0 + 12, 0x3a3d52); // open doors
  g.box(hx0 + 4, 7, hz0 + 12, hx0 + 10, 7, hz0 + 12, pal[0]);
  mark(hx0 - 1, hz0 - 1, hx0 + 15, hz0 + 14);

  // Road on the left of the tower, with a car park by the terminal.
  g.box(gx(road.x0), 0, 0, gx(road.x1), 0, D - 1, 0x3a3d45);
  for (let z = 0; z < D; z += 5) g.box(gx((road.x0 + road.x1) / 2), 0, z, gx((road.x0 + road.x1) / 2), 0, z + 1, 0xf4f4f0);
  g.box(gx(road.x1) + 1, 0, tower.z0, tower.x0 - 3, 0, tower.z1 + 2, 0x6b6f78);
  for (let z = tower.z0 + 1; z <= tower.z1 + 1; z += 3) g.box(gx(road.x1) + 2, 0, z, tower.x0 - 4, 0, z, 0xf4f4f0);
  mark(gx(road.x0) - 1, 0, tower.x0 - 1, D - 1);

  // Decor scattered on the free land.
  for (let i = 0; i < 260; i++) {
    const x = 3 + Math.floor(rand() * (W - 6));
    const z = 3 + Math.floor(rand() * (D - 6));
    let free = true;
    for (let dz = -3; dz <= 3 && free; dz++) for (let dx = -3; dx <= 3 && free; dx++) if (busy[(z + dz) * W + x + dx]) free = false;
    if (!free) continue;
    theme.item(g, x, 1, z, rand, pal);
    mark(x - 2, z - 2, x + 2, z + 2);
  }
  return g;
}

/** Small car (nose toward +z) for the road loop. */
export function buildCarModel(color: number): VoxelGrid {
  const g = new VoxelGrid(3, 3, 5);
  g.box(0, 1, 0, 2, 1, 4, color).box(0, 2, 1, 2, 2, 3, lighten(color, 0.2)).box(0, 2, 3, 2, 2, 3, 0x7fb7e6);
  g.set(0, 0, 1, 0x222222).set(2, 0, 1, 0x222222).set(0, 0, 3, 0x222222).set(2, 0, 3, 0x222222);
  return g;
}

/** A puffy cloud drifting over the airport. */
export function buildCloudModel(seed: number): VoxelGrid {
  const rand = rng(seed);
  const g = new VoxelGrid(14, 4, 8);
  for (let i = 0; i < 6; i++) {
    const x = 1 + Math.floor(rand() * 9);
    const z = 1 + Math.floor(rand() * 4);
    g.box(x, 0, z, x + 3, 1 + Math.floor(rand() * 2), z + 2, 0xffffff);
  }
  return g;
}

/** Colors and decor of a scenery theme (the land beyond reuses them, see horizon.ts). */
export function sceneryTheme(element: Element): Theme {
  return THEMES[element] ?? THEMES.neutre;
}

/** Sky color matching a scenery theme. */
export function skyColor(element: Element): number {
  return (THEMES[element] ?? THEMES.neutre).sky;
}

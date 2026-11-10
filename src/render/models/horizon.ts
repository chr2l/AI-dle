import { BufferAttribute, BufferGeometry, Group, Mesh } from 'three';
import type { Element } from '../../core/types';
import { darken, grain, hexToRgb, lighten, mix, paletteFor, pick, rng } from '../palette';
import { voxelMaterial } from '../pixelRenderer';
import { srgbToLinear, VoxelGrid } from '../voxel';
import { meshFromGrid } from '../tower';
import { SCENERY, sceneryTheme } from './scenery';

/**
 * The land beyond the airport, so the scene fills the whole screen at every
 * zoom (refonte B+C): a wide flat ground of the theme's colors with lakes
 * and the road running on, then a ring of bigger decor (hills, woods,
 * mountains, a town, themed landmarks) in voxels twice the size of the
 * airport's, and further away only the ground, which the fog of the view
 * fades into the sky (towerView.ts).
 */

/** Side of a ground tile and half-size of the flat ground, in world units. */
const TILE = 8;
const GROUND_HALF = 900;
/** Voxels of the decor ring are this many world units wide. */
export const RING_SCALE = 2;
/** The ring grid, in ring voxels, centered on the airport. */
const RING = 230;

const detail = {
  x0: SCENERY.origin.x,
  z0: SCENERY.origin.z,
  x1: SCENERY.origin.x + SCENERY.width,
  z1: SCENERY.origin.z + SCENERY.depth,
};
const center = { x: (detail.x0 + detail.x1) / 2, z: (detail.z0 + detail.z1) / 2 };

/** Flat ground with soft patches of the second color and a few lakes, under the airport's own ground. */
function buildGround(element: Element): Mesh {
  const theme = sceneryTheme(element);
  const water = WATER[element] ?? 0x3f9fe0;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const quad = (x0: number, z0: number, x1: number, z1: number, color: number, y = 0) => {
    const v = positions.length / 3;
    const [r, g, b] = hexToRgb(color);
    positions.push(x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0);
    for (let k = 0; k < 4; k++) colors.push(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
    // Middle of the outline atlas cell with no edge: plain color.
    uvs.push(0.12, 0.12, 0.13, 0.12, 0.13, 0.13, 0.12, 0.13);
    indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
  };
  const rand = rng(31);
  const patch = (x: number, z: number) => Math.sin(x * 0.021) + Math.sin(z * 0.026 + x * 0.008) + Math.sin((x + z) * 0.012 + 1.7);
  const lake = (x: number, z: number) => Math.sin(x * 0.009 + 2.1) * Math.sin(z * 0.011 + 0.6) > 0.72;
  const n = Math.ceil((GROUND_HALF * 2) / TILE);
  const sx = Math.floor((center.x - GROUND_HALF) / TILE) * TILE;
  const sz = Math.floor((center.z - GROUND_HALF) / TILE) * TILE;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = sx + i * TILE;
      const z = sz + j * TILE;
      const far = Math.hypot(x - center.x, z - center.z) > 170;
      const base = far && lake(x, z) ? water : patch(x, z) > 0.9 ? theme.groundAlt : theme.ground;
      quad(x, z, x + TILE, z + TILE, grain(rand, base, 0.03));
    }
  // The road on the left of the tower runs on to the horizon, both ways.
  const { x0: rx0, x1: rx1 } = SCENERY.road;
  const mid = (rx0 + rx1) / 2;
  for (const [a, b] of [[sz, detail.z0], [detail.z1, sz + n * TILE]]) {
    quad(rx0, a, rx1 + 1, b, 0x3a3d45, 0.01);
    for (let z = a; z < b - 2; z += 5) quad(mid, z, mid + 1, z + 2, 0xf4f4f0, 0.02);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, voxelMaterial);
  // Just under the airport's ground, which covers it near the tower.
  mesh.position.y = -0.04;
  return mesh;
}

const WATER: Partial<Record<Element, number>> = {
  tropicalia: 0x2ec4d6,
  givrebourg: 0x9fd8f5,
  infernia: 0xff5a1f,
  bitopia: 0x2a35a8,
  desolande: 0xb08a55,
  nuagelande: 0xffffff,
  gourmandie: 0xff9fc0,
  melodia: 0x5a3fa8,
};

/** Big landmarks of the far decor, one shape per theme. */
const LANDMARK: Record<Element, (g: VoxelGrid, x: number, z: number, rand: () => number, pal: number[]) => void> = {
  neutre: (g, x, z, rand) => mountain(g, x, z, 8 + Math.floor(rand() * 6), 0x7d8a96, 0xf4f8ff),
  givrebourg: (g, x, z, rand) => mountain(g, x, z, 9 + Math.floor(rand() * 6), 0xb9d3ea, 0xffffff),
  desolande: (g, x, z, rand) => mesa(g, x, z, 3 + Math.floor(rand() * 4), 0xc0814a),
  infernia: (g, x, z, rand) => volcano(g, x, z, 8 + Math.floor(rand() * 5)),
  tropicalia: (g, x, z, rand) => mountain(g, x, z, 6 + Math.floor(rand() * 5), 0x3f9b4a, 0x2f8a3f),
  nuagelande: (g, x, z, rand) => cloudHill(g, x, z, 4 + Math.floor(rand() * 4)),
  gourmandie: (g, x, z, rand, pal) => cake(g, x, z, 3 + Math.floor(rand() * 3), rand, pal),
  bitopia: (g, x, z, rand, pal) => tower(g, x, z, 6 + Math.floor(rand() * 12), pick(rand, [pal[1], pal[3], 0x3a3f9a])),
  melodia: (g, x, z, rand, pal) => mountain(g, x, z, 7 + Math.floor(rand() * 5), 0x6b4fb0, pal[1]),
};

function mountain(g: VoxelGrid, x: number, z: number, h: number, rock: number, cap: number) {
  for (let y = 0; y < h; y++) {
    const r = Math.round((h - y) * 0.9);
    const c = y >= h - 2 ? cap : y % 3 === 2 ? darken(rock, 0.08) : rock;
    g.box(x - r, y, z - r, x + r, y, z + r, c);
  }
}

function mesa(g: VoxelGrid, x: number, z: number, h: number, rock: number) {
  const r = 3 + h;
  for (let y = 0; y < h; y++) g.box(x - r + (y >> 1), y, z - r + (y >> 1), x + r - (y >> 1), y, z + r - (y >> 1), y % 2 ? darken(rock, 0.1) : rock);
}

function volcano(g: VoxelGrid, x: number, z: number, h: number) {
  mountain(g, x, z, h, 0x2a1d22, 0x3b2a2a);
  g.box(x - 1, h - 1, z - 1, x + 1, h - 1, z + 1, 0xff5a1f).set(x, h, z, 0xffa024);
}

function cloudHill(g: VoxelGrid, x: number, z: number, h: number) {
  for (let y = 0; y < h; y++) {
    const r = h + 2 - y;
    g.box(x - r, y, z - r + 1, x + r, y, z + r - 1, y % 2 ? 0xffffff : 0xeef6ff);
  }
}

function cake(g: VoxelGrid, x: number, z: number, layers: number, rand: () => number, pal: number[]) {
  for (let i = 0; i < layers; i++) {
    const r = 6 - i * 2;
    if (r < 1) break;
    g.box(x - r, i * 2, z - r, x + r, i * 2 + 1, z + r, i % 2 ? 0xfff2e0 : pick(rand, [pal[3], 0xff9fc0, 0xc98b5a]));
  }
}

function tower(g: VoxelGrid, x: number, z: number, h: number, color: number) {
  g.box(x - 2, 0, z - 2, x + 2, h, z + 2, color);
  for (let y = 2; y < h; y += 3) g.box(x - 2, y, z - 2, x + 2, y, z + 2, lighten(color, 0.35));
  g.box(x - 1, h + 1, z - 1, x + 1, h + 1, z + 1, 0xffffff);
}

/** A small town block: houses with roofs of the theme's colors. */
function town(g: VoxelGrid, x: number, z: number, rand: () => number, pal: number[]) {
  for (let i = 0; i < 6; i++) {
    const hx = x + Math.floor(rand() * 10) - 5;
    const hz = z + Math.floor(rand() * 10) - 5;
    const h = 1 + Math.floor(rand() * 3);
    g.box(hx, 0, hz, hx + 1, h, hz + 1, pick(rand, [0xf4efe4, 0xe9e4d8, pal[0]]));
    g.box(hx, h + 1, hz, hx + 1, h + 1, hz + 1, pick(rand, [0xc0503a, pal[1], pal[3]]));
  }
}

/** A wood seen from afar: a low canopy with a few taller crowns, in the theme's tree colors. */
function wood(g: VoxelGrid, x: number, z: number, r: number, rand: () => number, leaves: number[]) {
  for (let dz = -r; dz <= r; dz++)
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r + rand() * 3) continue;
      const c = pick(rand, leaves);
      g.set(x + dx, 0, z + dz, c);
      if (rand() < 0.3) g.set(x + dx, 1, z + dz, lighten(c, 0.08));
    }
}

/** Tree colors of each theme's woods (the airport's own decor items would be giants at this scale). */
const WOODS: Record<Element, number[]> = {
  neutre: [0x3f9b4a, 0x2f8a3f, 0x58b05a],
  tropicalia: [0x2fa84f, 0x1d8a6e, 0x48b85c],
  givrebourg: [0x2f6b4f, 0x3d7a5c, 0xf4f8ff],
  desolande: [0x5f8f3a, 0x9c7a54, 0x7a9a4a],
  infernia: [0x1e1418, 0x3a2226, 0xff5a1f],
  bitopia: [0x2a35a8, 0x3fa7ff, 0x1b1f5e],
  melodia: [0x5a3fa8, 0x7f5cc2, 0x1e1b2e],
  gourmandie: [0x9ad18b, 0xff9fc0, 0xf4f4f0],
  nuagelande: [0xffffff, 0xeef6ff, 0xdcebff],
};

function hill(g: VoxelGrid, x: number, z: number, h: number, color: number) {
  for (let y = 0; y < h; y++) {
    const r = (h - y) * 2 + 1;
    g.box(x - r, y, z - r + 1, x + r, y, z + r - 1, y % 2 ? lighten(color, 0.06) : color);
  }
}

/** The ring of big decor around the airport, in voxels RING_SCALE wide. */
function buildRing(element: Element, seed = 11): Group {
  const theme = sceneryTheme(element);
  const pal = paletteFor(element);
  const rand = rng(seed);
  const g = new VoxelGrid(RING, 24, RING);
  const ox = center.x - (RING * RING_SCALE) / 2;
  const oz = center.z - (RING * RING_SCALE) / 2;
  // Ring cells covering the airport (plus a margin) stay empty, as do the road and the runway axis.
  const hole = {
    x0: Math.floor((detail.x0 - ox) / RING_SCALE) - 3,
    x1: Math.ceil((detail.x1 - ox) / RING_SCALE) + 3,
    z0: Math.floor((detail.z0 - oz) / RING_SCALE) - 3,
    z1: Math.ceil((detail.z1 - oz) / RING_SCALE) + 3,
  };
  const roadX = Math.round(((SCENERY.road.x0 + SCENERY.road.x1) / 2 - ox) / RING_SCALE);
  const runwayZ = Math.round(((SCENERY.runway.z0 + SCENERY.runway.z1) / 2 - oz) / RING_SCALE);
  const free = (x: number, z: number, r: number) =>
    x - r > 0 && z - r > 0 && x + r < RING && z + r < RING &&
    (x + r < hole.x0 || x - r > hole.x1 || z + r < hole.z0 || z - r > hole.z1) &&
    Math.abs(x - roadX) > r + 2 && Math.abs(z - runwayZ) > r + 4;
  const used: { x: number; z: number; r: number }[] = [];
  const place = (r: number, draw: (x: number, z: number) => void, tries = 40, minDist = 0) => {
    for (let t = 0; t < tries; t++) {
      const x = Math.floor(rand() * RING);
      const z = Math.floor(rand() * RING);
      const dist = Math.hypot(x - RING / 2, z - RING / 2);
      if (dist < minDist || !free(x, z, r) || used.some((u) => Math.hypot(u.x - x, u.z - z) < u.r + r + 1)) continue;
      used.push({ x, z, r });
      draw(x, z);
      return;
    }
  };
  // Landmarks first, mostly behind the airport (top of the screen: −x, −z).
  for (let i = 0; i < 26; i++) place(10, (x, z) => LANDMARK[element](g, x, z, rand, pal), 60, 55);
  for (let i = 0; i < 6; i++) place(7, (x, z) => town(g, x, z, rand, pal), 40, 50);
  for (let i = 0; i < 30; i++) place(6, (x, z) => hill(g, x, z, 2 + Math.floor(rand() * 2), mix(theme.groundAlt, theme.ground, rand() * 0.5)), 40, 45);
  for (let i = 0; i < 70; i++) {
    const r = 3 + Math.floor(rand() * 4);
    place(r, (x, z) => wood(g, x, z, r, rand, WOODS[element] ?? WOODS.neutre), 20, 40);
  }
  const mesh = meshFromGrid(g);
  mesh.scale.setScalar(RING_SCALE);
  // Ring voxels stand on the ground.
  mesh.position.set(ox, 0, oz);
  const node = new Group();
  node.add(mesh);
  return node;
}

/** The whole land beyond the airport for a theme. */
export function buildHorizon(element: Element): Group {
  const group = new Group();
  group.add(buildGround(element));
  group.add(buildRing(element));
  return group;
}

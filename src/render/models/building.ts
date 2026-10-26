import { darken, grain, lighten, NEUTRAL_PALETTE, rng, toHex } from '../palette';
import { VoxelGrid } from '../voxel';
import { FLOOR } from './floor';
import { addPerson } from './props';

const [WALL, BLUE, DARK, ORANGE] = NEUTRAL_PALETTE.map(toHex);

/** Ground floor: check-in desk, departures board, seats and the entrance. */
export function buildLobbyModel(seed = 0): VoxelGrid {
  const { width: W, height: H, depth: D } = FLOOR;
  const rand = rng(seed + 101);
  const g = new VoxelGrid(W, H, D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) g.set(x, 0, z, grain(rand, (x + z) % 2 ? 0xd9d4c7 : 0xcfc9ba));
  for (let y = 1; y < H; y++) {
    for (let x = 0; x < W; x++) g.set(x, y, 0, grain(rand, y > 6 ? BLUE : WALL, 0.03));
    for (let z = 0; z < D; z++) g.set(0, y, z, grain(rand, y > 6 ? darken(BLUE, 0.1) : darken(WALL, 0.05), 0.03));
  }
  g.box(0, 0, D - 1, W - 1, 0, D - 1, DARK).box(W - 1, 0, 0, W - 1, 0, D - 1, DARK);
  // Departures board.
  g.box(3, 5, 1, 11, 7, 1, 0x1a1c24);
  for (let x = 4; x <= 10; x++) for (const y of [5, 6]) if (rand() > 0.35) g.set(x, y, 1, rand() > 0.8 ? ORANGE : 0xf2e94e);
  // Check-in desk with luggage belt.
  g.box(13, 1, 2, 20, 3, 3, BLUE).box(13, 3, 2, 20, 3, 3, lighten(BLUE, 0.4)).box(13, 1, 1, 20, 1, 1, 0x555a66);
  // Rows of seats.
  for (let x = 3; x <= 9; x++) g.box(x, 1, 6, x, 1, 6, ORANGE).set(x, 2, 6, darken(ORANGE, 0.25));
  for (let i = 0; i < 3; i++) addPerson(g, 4 + Math.floor(rand() * 15), 1, 5 + Math.floor(rand() * 4), rand);
  return g;
}

/** Roof: control tower with a beacon, sitting on the last slab. */
export function buildRoofModel(seed = 0): VoxelGrid {
  const W = FLOOR.width;
  const D = FLOOR.depth;
  const rand = rng(seed + 202);
  const g = new VoxelGrid(W, 18, D);
  g.box(0, 0, 0, W - 1, 0, D - 1, darken(WALL, 0.25));
  for (let x = 0; x < W; x += 2) g.set(x, 1, 0, DARK).set(0, 1, Math.min(D - 1, x), DARK);
  // Shaft, then a cab with dark windows.
  g.box(14, 1, 3, 17, 9, 6, grain(rand, WALL, 0.02));
  g.box(13, 10, 2, 18, 12, 7, BLUE);
  g.box(13, 11, 2, 18, 11, 7, 0x1d2b44);
  g.box(13, 13, 2, 18, 13, 7, DARK);
  g.box(15, 14, 4, 15, 16, 4, 0x8a8f98).set(15, 17, 4, 0xff3b30);
  // Helipad.
  g.box(3, 1, 3, 9, 1, 8, 0x4a4e57);
  g.box(5, 1, 4, 5, 1, 7, 0xf2e94e).box(7, 1, 4, 7, 1, 7, 0xf2e94e).box(5, 1, 5, 7, 1, 6, 0xf2e94e);
  g.box(6, 1, 4, 6, 1, 4, 0x4a4e57).box(6, 1, 7, 6, 1, 7, 0x4a4e57);
  return g;
}

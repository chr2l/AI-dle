import { pick } from '../palette';
import type { VoxelGrid } from '../voxel';

const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const CLOTHES = [0xd7263d, 0x1b998b, 0x2e294e, 0xf46036, 0x3fa7ff, 0xc5d86d, 0xff6fb5];

/** A 1×4×1 passenger: legs, body, head. */
export function addPerson(g: VoxelGrid, x: number, y: number, z: number, rand: () => number): void {
  g.set(x, y, z, 0x2b2d42);
  const outfit = pick(rand, CLOTHES);
  g.set(x, y + 1, z, outfit);
  g.set(x, y + 2, z, outfit);
  g.set(x, y + 3, z, pick(rand, SKINS));
}

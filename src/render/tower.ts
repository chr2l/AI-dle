import { Group, Mesh } from 'three';
import type { PlaneModel } from '../core/data/planes';
import type { Element } from '../core/types';
import { buildLobbyModel, buildRoofModel } from './models/building';
import { buildFloorModel, FLOOR, type FloorModelOptions } from './models/floor';
import { buildPlaneModel } from './models/plane';
import { buildVipModel, VIP_SIZE } from './models/vip';
import { voxelMaterial } from './pixelRenderer';
import { buildGeometry, VoxelGrid } from './voxel';

export function meshFromGrid(grid: VoxelGrid): Mesh {
  return new Mesh(buildGeometry(grid), voxelMaterial);
}

/** World y of the slab of a floor (0 = lobby). */
export const floorY = (index: number) => index * FLOOR.height;

/**
 * Stacks lobby, floors (bottom to top) and roof. Each floor's slab is the
 * ceiling of the one below.
 */
export function buildTower(floors: Omit<FloorModelOptions, 'seed'>[]): Group {
  const group = new Group();
  group.add(meshFromGrid(buildLobbyModel()));
  floors.forEach((opts, i) => {
    const mesh = meshFromGrid(buildFloorModel({ ...opts, seed: i + 1 }));
    mesh.position.y = floorY(i + 1);
    mesh.name = `floor-${i + 1}`;
    group.add(mesh);
  });
  const roof = meshFromGrid(buildRoofModel());
  roof.position.y = floorY(floors.length + 1);
  group.add(roof);
  return group;
}

/** Tarmac at the foot of the tower with parked planes, along +z. */
export function buildApron(planes: { model: PlaneModel; livery?: Element }[]): Group {
  const group = new Group();
  const ground = new VoxelGrid(FLOOR.width + 30, 1, 40);
  ground.box(0, 0, 0, ground.width - 1, 0, ground.depth - 1, 0x4a4e57);
  for (let x = 2; x < ground.width - 2; x += 4) ground.box(x, 0, 20, x + 1, 0, 20, 0xf2e94e);
  const groundMesh = meshFromGrid(ground);
  groundMesh.position.set(-4, -1, FLOOR.depth);
  group.add(groundMesh);
  let x = 0;
  for (const { model, livery } of planes) {
    const mesh = meshFromGrid(buildPlaneModel(model, livery));
    mesh.position.set(x, 0, FLOOR.depth + 4);
    group.add(mesh);
    x += model.shape.length * 2 + 4;
  }
  return group;
}

export const VIP_SPACING = { x: VIP_SIZE.width + 2, z: VIP_SIZE.depth + 6 } as const;

/** VIP figures on a carpet, `columns` per row, rows going back along -z. */
export function buildVipLineup(ids: string[], columns: number): { group: Group; width: number; depth: number } {
  const group = new Group();
  const rows = Math.ceil(ids.length / columns);
  const width = columns * VIP_SPACING.x;
  const depth = rows * VIP_SPACING.z;
  const carpet = new VoxelGrid(width + 2, 1, depth + 2);
  carpet.box(0, 0, 0, carpet.width - 1, 0, carpet.depth - 1, 0xb3263a);
  carpet.box(1, 0, 1, carpet.width - 2, 0, carpet.depth - 2, 0xd7263d);
  const carpetMesh = meshFromGrid(carpet);
  carpetMesh.position.set(-1, -1, -1);
  group.add(carpetMesh);
  ids.forEach((id, i) => {
    const mesh = meshFromGrid(buildVipModel(id));
    // First ids in front (largest z) so the line-up reads top to bottom.
    mesh.position.set((i % columns) * VIP_SPACING.x, 0, depth - (Math.floor(i / columns) + 1) * VIP_SPACING.z + 3);
    mesh.name = `vip-${id}`;
    group.add(mesh);
  });
  return { group, width, depth };
}

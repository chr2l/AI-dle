import { Group, Mesh } from 'three';
import type { PlaneModel } from '../core/data/planes';
import type { Element } from '../core/types';
import { buildLobbyModel, buildRoofModel } from './models/building';
import { buildFloorModel, FLOOR, type FloorModelOptions } from './models/floor';
import { buildPlaneModel } from './models/plane';
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

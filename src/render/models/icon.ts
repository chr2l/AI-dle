import type { PlaneModel } from '../../core/data/planes';
import { VoxelGrid } from '../voxel';
import { buildPlaneModel } from './plane';

/**
 * App icon: a chunky control tower on a grass island with a yellow plane
 * climbing past it. Few, big shapes so it still reads at 48 px.
 */
export const ICON_ISLAND = 17;

export function buildIconTowerModel(): VoxelGrid {
  const n = ICON_ISLAND;
  const g = new VoxelGrid(n, 26, n);
  // Island: dirt underside, grass top, a runway strip along the front.
  g.box(1, 0, 1, n - 2, 0, n - 2, 0x8a5a3c);
  g.box(0, 1, 0, n - 1, 2, n - 1, 0x5cc94f);
  g.box(0, 2, 12, n - 1, 2, 15, 0x4a4f5c);
  for (let x = 1; x < n; x += 4) g.box(x, 2, 13, x + 1, 2, 14, 0xffffff);
  // Shaft.
  g.box(5, 3, 4, 9, 15, 8, 0xf2f0ea);
  for (let y = 5; y <= 13; y += 4) g.box(5, y, 4, 9, y, 8, 0xd6d2c6);
  g.box(6, 3, 8, 8, 5, 8, 0x3b82c4); // door
  // Cab: wide glass ring with white mullions under a dark roof.
  g.box(3, 16, 2, 11, 16, 10, 0xf2f0ea);
  g.box(3, 17, 2, 11, 19, 10, 0x6fd3ff);
  g.box(3, 19, 2, 11, 19, 10, 0xb4ecff);
  for (const c of [3, 7, 11]) {
    g.box(c, 17, 2, c, 19, 2, 0xf2f0ea).box(c, 17, 10, c, 19, 10, 0xf2f0ea);
    g.box(3, 17, c - 1, 3, 19, c - 1, 0xf2f0ea).box(11, 17, c - 1, 11, 19, c - 1, 0xf2f0ea);
  }
  g.box(3, 20, 2, 11, 20, 10, 0x24304a);
  g.box(5, 21, 4, 9, 21, 8, 0x24304a);
  // Antenna and beacon.
  g.box(7, 22, 6, 7, 23, 6, 0xb8bcc6);
  g.box(6, 24, 5, 8, 25, 7, 0xff4d4d);
  return g;
}

const ICON_PLANE: PlaneModel = {
  id: 'icone', name: 'Icône', speed: 0, capacity: 0, range: 0, comfort: 0, reliability: 0,
  slots: 0, price: 0, level: 0, shape: { length: 5, wingspan: 7, engines: 2, body: 1 }, color: '#ffd23f',
};

export function buildIconPlaneModel(): VoxelGrid {
  return buildPlaneModel(ICON_PLANE, 'infernia');
}

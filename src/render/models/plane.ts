import type { PlaneModel } from '../../core/data/planes';
import type { Element } from '../../core/types';
import { darken, lighten, paletteFor, toHex } from '../palette';
import { VoxelGrid } from '../voxel';

/**
 * Builds a plane from the silhouette parameters of its model
 * (PlaneModel.shape). The fuselage runs along x, nose toward +x; the livery
 * stripe takes the accent color of an element (country affinity).
 */
export function buildPlaneModel(model: PlaneModel, livery: Element = 'neutre'): VoxelGrid {
  const { length, wingspan, engines, body } = model.shape;
  const L = length * 2 + 2;
  const S = wingspan * 2 + 1;
  const bodyR = body; // half-thickness of the fuselage
  const cz = Math.floor(S / 2);
  const H = 2 * bodyR + 7;
  const g = new VoxelGrid(L, H, S);
  const hull = toHex(model.color);
  const stripe = paletteFor(livery)[livery === 'neutre' ? 1 : 0];
  const y0 = 2; // leaves room for engines and wheels under the wings

  // Fuselage, tapered at the nose and the tail.
  for (let x = 0; x < L; x++) {
    const taper = x >= L - 2 ? 1 : x < 2 ? 1 : 0;
    const r = Math.max(0, bodyR - taper);
    g.box(x, y0, cz - r, x, y0 + 2 * bodyR - taper, cz + r, hull);
  }
  g.box(0, y0 + bodyR, cz - bodyR, L - 3, y0 + bodyR, cz + bodyR, stripe);
  g.box(L - 3, y0 + 2 * bodyR, cz - bodyR, L - 2, y0 + 2 * bodyR, cz + bodyR, 0x1d2b44); // cockpit
  g.set(L - 1, y0 + bodyR, cz, darken(hull, 0.3)); // nose cone
  for (let x = 3; x < L - 4; x += 2) {
    g.set(x, y0 + bodyR + 1, cz + bodyR, 0xbfe3ff);
    g.set(x, y0 + bodyR + 1, cz - bodyR, 0xbfe3ff);
  }

  // Wings (chord 3), slightly behind the middle.
  const wx = Math.floor(L * 0.4);
  g.box(wx, y0 + 1, 0, wx + 2, y0 + 1, S - 1, lighten(hull, 0.15));
  g.box(wx, y0 + 1, 0, wx + 2, y0 + 1, 0, stripe).box(wx, y0 + 1, S - 1, wx + 2, y0 + 1, S - 1, stripe);

  // Engines under the wings, symmetric around the fuselage.
  for (let i = 0; i < Math.floor(engines / 2); i++) {
    const off = bodyR + 2 + i * 3;
    for (const z of [cz - off, cz + off]) g.box(wx, y0, z, wx + 2, y0, z, 0x555a66);
  }
  if (engines === 1) g.box(L - 1, y0 + bodyR - 1, cz, L - 1, y0 + bodyR + 1, cz, 0x555a66); // propeller

  // Tail: fin plus horizontal stabilizer.
  g.box(0, y0 + 2 * bodyR + 1, cz, 2, H - 2, cz, hull).box(0, H - 2, cz, 1, H - 1, cz, stripe);
  g.box(0, y0 + 2 * bodyR, cz - 3, 1, y0 + 2 * bodyR, cz + 3, hull);

  // Wheels.
  g.set(L - 3, y0 - 1, cz, 0x222222).set(wx + 1, y0 - 1, cz - bodyR, 0x222222).set(wx + 1, y0 - 1, cz + bodyR, 0x222222);
  return g;
}

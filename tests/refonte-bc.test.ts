import { describe, expect, it } from 'vitest';
import type { Mesh } from 'three';
import { buildHorizon } from '../src/render/models/horizon';
import { SCENERY } from '../src/render/models/scenery';

describe('Décor jusqu’à l’horizon', () => {
  it('pose un sol bien plus large que l’aéroport et un anneau de décor, pour chaque thème', () => {
    for (const element of ['neutre', 'givrebourg', 'infernia', 'bitopia', 'nuagelande'] as const) {
      const t0 = performance.now();
      const horizon = buildHorizon(element);
      const ms = performance.now() - t0;
      const [ground, ring] = horizon.children as [Mesh, { children: Mesh[] }];
      ground.geometry.computeBoundingBox();
      const box = ground.geometry.boundingBox!;
      expect(box.max.x - box.min.x).toBeGreaterThan(SCENERY.width * 8);
      expect(box.max.z - box.min.z).toBeGreaterThan(SCENERY.depth * 8);
      // The ring has decor, but stays light enough for a phone.
      const faces = ring.children[0].geometry.index!.count / 6;
      expect(faces, element).toBeGreaterThan(2000);
      expect(faces, element).toBeLessThan(120_000);
      expect(ms, element).toBeLessThan(3000);
    }
  });
});

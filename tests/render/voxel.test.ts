import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { PLANE_MODELS } from '../../src/core/data/planes';
import { SHOPS } from '../../src/core/data/shops';
import { buildLobbyModel, buildRoofModel } from '../../src/render/models/building';
import { buildFloorModel, FLOOR } from '../../src/render/models/floor';
import { buildPlaneModel } from '../../src/render/models/plane';
import { mix, paletteFor } from '../../src/render/palette';
import { cubeEdgeTexture, ISO_DIRECTION, snapToPixelGrid } from '../../src/render/pixelRenderer';
import { buildMeshData, FACE_SHADE, VoxelGrid } from '../../src/render/voxel';

describe('VoxelGrid + mesh', () => {
  it('culls faces shared by two voxels', () => {
    const g = new VoxelGrid(3, 3, 3).set(0, 0, 0, 0xffffff);
    expect(buildMeshData(g).faceCount).toBe(6);
    g.set(1, 0, 0, 0xffffff);
    expect(buildMeshData(g).faceCount).toBe(10);
    g.box(0, 0, 0, 2, 2, 2, 0xffffff);
    expect(buildMeshData(g).faceCount).toBe(6 * 9);
  });

  it('bakes top / left / right shading into vertex colors', () => {
    const data = buildMeshData(new VoxelGrid(1, 1, 1).set(0, 0, 0, 0xffffff));
    const shades = new Set<number>();
    for (let i = 0; i < data.colors.length; i += 3) shades.add(Number(data.colors[i].toFixed(2)));
    for (const s of [FACE_SHADE.top, FACE_SHADE.left, FACE_SHADE.right]) expect(shades).toContain(s);
  });

  it('maps the full texture square on every face for the cube edges', () => {
    const data = buildMeshData(new VoxelGrid(1, 1, 1).set(0, 0, 0, 0xffffff));
    expect(data.uvs.length).toBe((data.positions.length / 3) * 2);
    const tex = cubeEdgeTexture(8);
    const px = (x: number, y: number) => (tex.image.data as Uint8Array)[(y * 8 + x) * 4];
    expect(px(0, 4)).toBeLessThan(px(4, 4));
  });

  it('ignores writes outside the grid', () => {
    const g = new VoxelGrid(2, 2, 2).set(5, 0, 0, 1).box(-3, -3, -3, 0, 0, 0, 2);
    expect(g.count()).toBe(1);
  });
});

describe('models', () => {
  it('builds every shop floor deterministically, within floor bounds', () => {
    for (const shop of SHOPS) {
      const a = buildFloorModel({ shop, seed: 4 });
      const b = buildFloorModel({ shop, seed: 4 });
      expect([a.width, a.height, a.depth]).toEqual([FLOOR.width, FLOOR.height, FLOOR.depth]);
      expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
      expect(a.count()).toBeGreaterThan(FLOOR.width * FLOOR.depth);
    }
  });

  it('varies the layout with the seed', () => {
    const a = buildFloorModel({ shop: SHOPS[0], seed: 1 });
    const b = buildFloorModel({ shop: SHOPS[0], seed: 2 });
    expect(Array.from(a.cells)).not.toEqual(Array.from(b.cells));
  });

  it('builds lobby, roof, construction floor and every plane', () => {
    expect(buildLobbyModel().count()).toBeGreaterThan(0);
    expect(buildRoofModel().count()).toBeGreaterThan(0);
    expect(buildFloorModel({ building: true, seed: 1 }).count()).toBeGreaterThan(0);
    for (const model of PLANE_MODELS) {
      const plane = buildPlaneModel(model, 'tropicalia');
      expect(plane.width).toBe(model.shape.length * 2 + 2);
      expect(plane.count()).toBeGreaterThan(20);
    }
  });
});

describe('palette + camera', () => {
  it('uses the country palette and falls back to neutral', () => {
    expect(paletteFor('tropicalia')[0]).toBe(0x2ec4a6);
    expect(paletteFor('neutre')).toHaveLength(4);
    expect(mix(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });

  it('snaps the camera target to the art-pixel grid without changing depth', () => {
    const p = new Vector3(3.37, 12.81, 4.02);
    const s = snapToPixelGrid(p, 3);
    expect(s.dot(ISO_DIRECTION)).toBeCloseTo(p.dot(ISO_DIRECTION));
    expect(s.distanceTo(p)).toBeLessThan(1 / 3);
    expect(snapToPixelGrid(s, 3).distanceTo(s)).toBeCloseTo(0);
  });
});

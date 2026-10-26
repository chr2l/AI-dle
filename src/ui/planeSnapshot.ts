// Cube art portraits of the plane models for the fleet cards, rendered once
// per model and livery on a shared offscreen canvas and kept as data URLs.
import { Box3, Vector3 } from 'three';
import { PLANE_BY_ID } from '../core/data/planes';
import type { Element } from '../core/types';
import { buildPlaneModel } from '../render/models/plane';
import { PixelRenderer } from '../render/pixelRenderer';
import { meshFromGrid } from '../render/tower';

const WIDTH = 240;
const HEIGHT = 130;
const cache = new Map<string, string>();
let view: PixelRenderer | null | undefined;

export function planeSnapshot(modelId: string, livery: Element = 'neutre'): string | undefined {
  const key = `${modelId}:${livery}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (view === undefined) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      view = new PixelRenderer(canvas, { style: 'cube', background: '#2c3266' });
      view.renderer.setPixelRatio(2);
      view.resize(WIDTH, HEIGHT);
    } catch {
      view = null;
    }
  }
  const model = PLANE_BY_ID[modelId];
  if (!view || !model) return undefined;
  const mesh = meshFromGrid(buildPlaneModel(model, livery));
  view.scene.add(mesh);
  const box = new Box3().setFromObject(mesh);
  const size = box.getSize(new Vector3());
  // Zoom so the plane fills the card whatever its size.
  view.pixelsPerVoxel = Math.min(12, (WIDTH * 0.8) / ((size.x + size.z) * 0.71));
  view.resize(WIDTH, HEIGHT);
  view.target.copy(box.getCenter(new Vector3()));
  view.render();
  const url = view.renderer.domElement.toDataURL('image/png');
  view.scene.remove(mesh);
  mesh.geometry.dispose();
  cache.set(key, url);
  return url;
}

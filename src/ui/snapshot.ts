// Cube art portraits for the interface: planes (fleet cards), VIPs and shops
// (bubbles, sheets, Dex). Each one is rendered once on a shared offscreen
// canvas and kept as a data URL.
import { Box3, Vector3 } from 'three';
import { PLANE_BY_ID } from '../core/data/planes';
import { SHOP_BY_ID } from '../core/data/shops';
import type { Element } from '../core/types';
import { buildFloorModel } from '../render/models/floor';
import { buildPlaneModel } from '../render/models/plane';
import { buildFigure, buildVipModel, GUIDE_LOOK, VIP_LOOKS } from '../render/models/vip';
import { PixelRenderer } from '../render/pixelRenderer';
import { meshFromGrid } from '../render/tower';
import type { VoxelGrid } from '../render/voxel';

const cache = new Map<string, string>();
const views = new Map<string, PixelRenderer | null>();

function viewFor(width: number, height: number, background: string): PixelRenderer | null {
  const key = `${width}x${height}:${background}`;
  if (!views.has(key)) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const view = new PixelRenderer(canvas, { style: 'cube', background });
      view.renderer.setPixelRatio(2);
      view.resize(width, height);
      views.set(key, view);
    } catch {
      views.set(key, null);
    }
  }
  return views.get(key)!;
}

/** portrait: frame the upper part of a tall model (head and shoulders) instead of the whole of it. */
function render(key: string, build: () => VoxelGrid | undefined, width: number, height: number, fill: number, background = '#cfe8ff', portrait = false): string | undefined {
  const hit = cache.get(key);
  if (hit) return hit;
  const view = viewFor(width, height, background);
  const grid = view && build();
  if (!view || !grid) return undefined;
  const mesh = meshFromGrid(grid);
  view.scene.add(mesh);
  const box = new Box3().setFromObject(mesh);
  const size = box.getSize(new Vector3());
  // Zoom so the model fills the picture whatever its size (iso footprint and height).
  view.pixelsPerVoxel = portrait
    ? (height * fill) / (size.y * 0.6)
    : Math.min(12, (width * fill) / ((size.x + size.z) * 0.71), (height * fill) / (size.y + (size.x + size.z) * 0.41));
  view.resize(width, height);
  view.target.copy(box.getCenter(new Vector3()));
  if (portrait) view.target.y += size.y * 0.2;
  view.render();
  const url = view.renderer.domElement.toDataURL('image/png');
  view.scene.remove(mesh);
  mesh.geometry.dispose();
  cache.set(key, url);
  return url;
}

export function planeSnapshot(modelId: string, livery: Element = 'neutre'): string | undefined {
  const model = PLANE_BY_ID[modelId];
  return render(`plane:${modelId}:${livery}`, () => model && buildPlaneModel(model, livery), 240, 130, 0.8);
}

export function vipSnapshot(id: string): string | undefined {
  return render(`vip:${id}`, () => (VIP_LOOKS[id] ? buildVipModel(id) : undefined), 96, 96, 0.95, '#e6dcff', true);
}

export function shopSnapshot(defId: string): string | undefined {
  const shop = SHOP_BY_ID[defId];
  return render(`shop:${defId}`, () => shop && buildFloorModel({ shop, seed: 1 }), 120, 96, 1.2);
}

/** Portrait of Capucine, the guide of the journal and banners. */
export function guideSnapshot(): string | undefined {
  return render('guide', () => buildFigure(GUIDE_LOOK), 96, 96, 0.95, '#ffe089', true);
}

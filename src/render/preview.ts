/**
 * Visual preview of the voxel pipeline (preview.html): a tower with random
 * shops from every country, a floor under construction and the plane fleet.
 * Query params: ?style=cube|pixel&seed=3&floors=8&scale=3&ppv=10
 * ?scene=vips shows the VIP line-up instead (&vips=rockeur,diva to pick some).
 */
import { COUNTRIES } from '../core/data/countries';
import { PLANE_MODELS } from '../core/data/planes';
import { SHOPS } from '../core/data/shops';
import { VIPS } from '../core/data/vips';
import { FLOOR } from './models/floor';
import { VIP_SIZE } from './models/vip';
import { pick, rng } from './palette';
import { PixelRenderer } from './pixelRenderer';
import { buildApron, buildTower, buildVipLineup, floorY, VIP_SPACING } from './tower';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1);
const floorCount = Number(params.get('floors') ?? 8);
const rand = rng(seed);

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const view = new PixelRenderer(canvas, {
  style: params.get('style') === 'pixel' ? 'pixel' : 'cube',
  pixelScale: params.has('scale') ? Number(params.get('scale')) : undefined,
  pixelsPerVoxel: params.has('ppv') ? Number(params.get('ppv')) : undefined,
});

const vipScene = params.get('scene') === 'vips';
let center: () => void;
let scroll = 0;
let maxY = 0;

if (vipScene) {
  const ids = params.get('vips')?.split(',') ?? VIPS.map((v) => v.id);
  const lineup = buildVipLineup(ids, 3);
  view.scene.add(lineup.group);
  maxY = lineup.depth;
  scroll = Number(params.get('row') ?? 0) * VIP_SPACING.z;
  // Scrolling walks the camera along the rows (toward -z).
  center = () => view.target.set(lineup.width / 2, VIP_SIZE.height / 2, lineup.depth - scroll - VIP_SPACING.z / 2);
} else {
  const floors = Array.from({ length: floorCount }, (_, i) =>
    i === floorCount - 1 ? { building: true } : { shop: pick(rand, SHOPS) },
  );
  view.scene.add(buildTower(floors));
  view.scene.add(
    buildApron(PLANE_MODELS.slice(0, 3).map((model, i) => ({ model, livery: COUNTRIES[(seed + i) % COUNTRIES.length].id }))),
  );
  scroll = floorY(1);
  maxY = floorY(floorCount + 1);
  center = () => view.target.set(FLOOR.width / 2, scroll, FLOOR.depth / 2);
}

function resize() {
  view.resize(canvas.clientWidth, canvas.clientHeight);
  view.render();
}
function scrollBy(dy: number) {
  scroll = Math.min(maxY, Math.max(0, scroll + dy));
  center();
  view.render();
}

addEventListener('resize', resize);
addEventListener('wheel', (e) => scrollBy(-e.deltaY / 20), { passive: true });
let lastY: number | null = null;
canvas.addEventListener('pointerdown', (e) => (lastY = e.clientY));
addEventListener('pointerup', () => (lastY = null));
addEventListener('pointermove', (e) => {
  if (lastY === null) return;
  scrollBy((e.clientY - lastY) / (view.pixelScale * view.pixelsPerVoxel));
  lastY = e.clientY;
});

center();
resize();
(window as unknown as { __previewReady: boolean }).__previewReady = true;

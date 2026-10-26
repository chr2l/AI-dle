/**
 * Visual preview of the voxel pipeline (preview.html): a tower with random
 * shops from every country, a floor under construction and the plane fleet.
 * Query params: ?seed=3&floors=8&scale=3&ppv=4
 */
import { COUNTRIES } from '../core/data/countries';
import { PLANE_MODELS } from '../core/data/planes';
import { SHOPS } from '../core/data/shops';
import { FLOOR } from './models/floor';
import { pick, rng } from './palette';
import { PixelRenderer } from './pixelRenderer';
import { buildApron, buildTower, floorY } from './tower';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1);
const floorCount = Number(params.get('floors') ?? 8);
const rand = rng(seed);

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const view = new PixelRenderer(canvas, {
  pixelScale: Number(params.get('scale') ?? 3),
  pixelsPerVoxel: Number(params.get('ppv') ?? 4),
});

const floors = Array.from({ length: floorCount }, (_, i) =>
  i === floorCount - 1 ? { building: true } : { shop: pick(rand, SHOPS) },
);
view.scene.add(buildTower(floors));
view.scene.add(
  buildApron(PLANE_MODELS.slice(0, 3).map((model, i) => ({ model, livery: COUNTRIES[(seed + i) % COUNTRIES.length].id }))),
);

const minY = floorY(1);
const maxY = floorY(floorCount + 1);
let scroll = minY;
const center = () => view.target.set(FLOOR.width / 2, scroll, FLOOR.depth / 2);

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

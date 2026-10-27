/**
 * Visual preview of the voxel pipeline (preview.html): a tower with random
 * shops from every country, a floor under construction and the plane fleet.
 * Query params: ?style=cube|pixel&seed=3&floors=8&scale=3&ppv=10
 * &country=tropicalia themes the airport scenery (default: neutral land).
 * ?scene=icon draws the app icon (&bg=RRGGBB background).
 * ?scene=vips shows the VIP line-up instead (&vips=rockeur,diva to pick some).
 */
import { COUNTRIES } from '../core/data/countries';
import { PLANE_MODELS } from '../core/data/planes';
import { SHOPS } from '../core/data/shops';
import { VIPS } from '../core/data/vips';
import type { Element } from '../core/types';
import { FLOOR } from './models/floor';
import { VIP_SIZE } from './models/vip';
import { pick, rng } from './palette';
import { PixelRenderer } from './pixelRenderer';
import { buildTower, buildVipLineup, floorY, meshFromGrid, VIP_SPACING } from './tower';
import { AirportScene } from './airport';
import { Color, Group } from 'three';
import { buildIconPlaneModel, buildIconTowerModel } from './models/icon';

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
const iconScene = params.get('scene') === 'icon';
let center: () => void;
let scroll = 0;
let maxY = 0;

if (iconScene) {
  // App icon, rendered on a flat background (&bg=000000) so the alpha can be recovered.
  view.scene.background = new Color(`#${params.get('bg') ?? '8fd3ff'}`);
  view.scene.add(meshFromGrid(buildIconTowerModel()));
  const plane = new Group();
  const mesh = meshFromGrid(buildIconPlaneModel());
  plane.add(mesh);
  plane.rotation.set(0, Math.PI / 2, 0.35, 'YXZ');
  plane.position.set(15, 22, 9);
  view.scene.add(plane);
  center = () => view.target.set(9, 11, 7.5);
} else if (vipScene) {
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
  const airport = new AirportScene();
  airport.setTheme((params.get('country') as Element | null) ?? 'neutre');
  view.scene.background = new Color(airport.sky);
  const fleet = PLANE_MODELS.slice(0, 4).map((model, i) => ({
    uid: `p${i}`,
    modelId: model.id,
    flying: false,
    livery: COUNTRIES[(seed + i) % COUNTRIES.length].id,
  }));
  airport.sync(fleet, Date.now());
  // The first plane leaves after a second so a takeoff is always on show.
  setTimeout(() => {
    fleet[0].flying = true;
    airport.sync(fleet, Date.now());
  }, 1000);
  view.scene.add(airport.group);
  const loop = () => {
    requestAnimationFrame(loop);
    airport.tick(Date.now());
    view.render();
  };
  requestAnimationFrame(loop);
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

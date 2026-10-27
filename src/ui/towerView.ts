// Cube art view of the player's tower (src/render), filling the Tour tab.
// The player moves from floor to floor: floors above the focused one and the
// roof are hidden so it can be seen, and the camera glides and zooms onto it.
// The top stop shows the whole tower. The airport around it (scenery, planes
// taking off and landing, cars, clouds) animates every frame. The scene also
// reacts (plan de polish IP-11, IP-22): touching a floor of the whole tower
// flies to it, a finished floor drops into place, takeoffs shake the camera,
// and the light follows the local hour with the weather of the week.
import { Color, Group, Raycaster, Vector2, Vector3, type Object3D } from 'three';
import { SHOP_BY_ID } from '../core/data/shops';
import { featuredCountry } from '../core/destinations';
import type { GameState } from '../core';
import { AirportScene } from '../render/airport';
import { daylight, lighting, Weather, WEATHER } from '../render/daylight';
import { FLOOR } from '../render/models/floor';
import { RUNWAY_CENTER_Z, SCENERY } from '../render/models/scenery';
import { PixelRenderer, voxelMaterial } from '../render/pixelRenderer';
import { buildTower, floorY } from '../render/tower';

/** Animation frame rate cap, to spare mobile batteries (Réglages: 30 or 60). */
let FPS = 30;
export const setTowerFps = (fps: number) => (FPS = fps);
/** Zoom (CSS pixels per voxel) on a single floor, and on the whole tower. */
const ZOOM_FLOOR = 14;
const ZOOM_OVERVIEW = 6;
const ZOOM_RUNWAY = 7;
/** Stop below the hall: the runway, to watch planes take off and land. */
export const RUNWAY_STOP = -1;

export class TowerView {
  private view: PixelRenderer;
  private content = new Group();
  private signature = '';
  private airport = new AirportScene();
  private lastFrame = 0;
  private floorCount = 0;
  /** -1 = runway, 0 = hall, 1..n = floors, n + 1 = whole tower. */
  focus = Infinity;
  private camY = 0;
  private camX = FLOOR.width / 2;
  private camZ = FLOOR.depth / 2;
  private zoom = ZOOM_OVERVIEW;
  /** Called when a swipe moves to another floor, and on a tap (index = current focus). */
  onFocus?: (index: number) => void;
  onTap?: (index: number) => void;
  /** A floor just finished dropping into place (index 1..n). */
  onDrop?: (index: number) => void;
  private drops: { index: number; start: number }[] = [];
  private shakeUntil = 0;
  private weather = new Weather();
  private sky = new Color();
  private tint = new Color(1, 1, 1);
  private lightAt = 0;
  /** A sheet covers the scene: 4 frames per second are enough behind it (plan de polish IP-20). */
  paused = false;
  /** Average time to draw a frame (ms) and frames drawn, for the adaptive resolution and statistics. */
  private drawMs = 0;
  frames = 0;
  private framesSince = performance.now();
  private country = '';

  constructor(readonly canvas: HTMLCanvasElement) {
    this.view = new PixelRenderer(canvas, { style: 'cube', pixelsPerVoxel: ZOOM_OVERVIEW });
    this.view.scene.add(this.content);
    this.view.scene.add(this.airport.group);
    this.view.scene.add(this.weather.points);
    let start: { y: number; t: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => (start = { y: e.clientY, t: Date.now() }));
    addEventListener('pointerup', (e) => {
      if (!start) return;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dy) < 10) {
        // On the whole tower, the touched floor is where the elevator goes.
        const hit = this.stop > this.floorCount ? this.pick(e.clientX, e.clientY) : null;
        if (hit !== null && hit <= this.floorCount) {
          this.setFocus(hit);
          this.onFocus?.(this.stop);
        } else this.onTap?.(this.stop);
      }
      // Swipe up to climb, down to go back to the ground.
      else if (Math.abs(dy) > 30) this.move(dy < 0 ? 1 : -1);
    });
    new ResizeObserver(() => this.resize()).observe(canvas);
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      // Skip frames while the view is hidden (other tabs) or over the FPS cap.
      if (!this.canvas.clientWidth || now - this.lastFrame < 1000 / (this.paused ? 4 : FPS)) return;
      this.lastFrame = now;
      this.airport.tick(Date.now());
      this.weather.tick(now / 1000, this.view.target);
      this.animateDrops(now);
      const t0 = performance.now();
      this.draw();
      this.adapt(performance.now() - t0);
    };
    requestAnimationFrame(loop);
  }

  /** Current stop, clamped to the existing floors. */
  get stop() {
    return Math.max(RUNWAY_STOP, Math.min(this.floorCount + 1, this.focus));
  }

  private move(delta: number) {
    this.setFocus(this.stop + delta);
    this.onFocus?.(this.stop);
  }

  setFocus(index: number) {
    this.focus = Math.max(RUNWAY_STOP, Math.min(this.floorCount + 1, index));
    this.applyVisibility();
  }

  private applyVisibility() {
    const stop = this.stop;
    const overview = stop > this.floorCount || stop === RUNWAY_STOP;
    const tower = this.content.children[0];
    tower?.children.forEach((o: Object3D, i) => {
      // Children: lobby (0), floors 1..n, roof (n + 1).
      o.visible = overview || i <= stop;
    });
  }

  resize() {
    if (!this.canvas.clientWidth) return;
    this.view.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.draw();
  }

  private draw() {
    const stop = this.stop;
    const overview = stop > this.floorCount;
    const runway = stop === RUNWAY_STOP;
    const targetY = runway ? 0 : overview ? floorY(this.floorCount + 1) * 0.55 : floorY(stop) + FLOOR.height * 0.45;
    const targetZoom = runway ? ZOOM_RUNWAY : overview ? Math.min(ZOOM_OVERVIEW, (this.canvas.clientHeight * 0.8) / Math.max(30, floorY(this.floorCount + 2) * 1.1)) : ZOOM_FLOOR;
    // The runway lies in front of the tower: the camera slides there along the same axis.
    const targetX = runway ? (SCENERY.runway.x0 + SCENERY.runway.x1) / 4 : FLOOR.width / 2;
    const targetZ = runway ? RUNWAY_CENTER_Z : FLOOR.depth / 2;
    // Ease toward the target for a smooth elevator ride.
    const ease = (a: number, b: number) => a + (b - a) * 0.18;
    this.camY = ease(this.camY, targetY);
    this.zoom = ease(this.zoom, targetZoom);
    this.camX = ease(this.camX, targetX);
    this.camZ = ease(this.camZ, targetZ);
    const { width, height } = this.view.artSize;
    const halfW = width / this.zoom / 2;
    const halfH = height / this.zoom / 2;
    Object.assign(this.view.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.view.camera.updateProjectionMatrix();
    this.view.target.set(this.camX, this.camY, this.camZ);
    const shake = this.shakeUntil - performance.now();
    if (shake > 0) this.view.target.x += Math.sin(shake / 18) * (shake / 400) * 0.6;
    // The night tint applies to this view only: portraits share the material.
    voxelMaterial.color.copy(this.tint);
    this.view.render();
    voxelMaterial.color.setRGB(1, 1, 1);
  }

  /**
   * Adaptive resolution: on a phone that struggles (frames slower than half
   * the frame budget on average), render with fewer pixels per CSS pixel.
   */
  private adapt(ms: number) {
    this.frames++;
    this.drawMs = this.drawMs ? this.drawMs * 0.95 + ms * 0.05 : ms;
    if (this.frames % 60 !== 0) return;
    const ratio = this.view.renderer.getPixelRatio();
    if (this.drawMs > 500 / FPS && ratio > 1) {
      this.view.renderer.setPixelRatio(Math.max(1, ratio - 0.5));
      this.resize();
    }
  }

  /** Frames per second actually drawn since the last call (statistics). */
  fps(): number {
    const now = performance.now();
    const fps = (this.frames * 1000) / Math.max(1, now - this.framesSince);
    this.frames = 0;
    this.framesSince = now;
    return Math.round(fps);
  }

  /** Short camera shake (takeoff, landing of a floor). */
  shake(ms = 400) {
    this.shakeUntil = performance.now() + ms;
  }

  /** Index of the tower part under a screen point: 0 = hall, 1..n = floors, n + 1 = roof. */
  private pick(clientX: number, clientY: number): number | null {
    const tower = this.content.children[0];
    if (!tower) return null;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new Raycaster();
    ray.setFromCamera(ndc, this.view.camera);
    const hit = ray.intersectObjects(tower.children, false)[0];
    return hit ? tower.children.indexOf(hit.object) : null;
  }

  /** Screen point (relative to the canvas) above the middle of a floor, or null when hidden. */
  floorPoint(index: number): { x: number; y: number } | null {
    if (!this.canvas.clientWidth || index < 0 || index > this.floorCount) return null;
    const stop = this.stop;
    if (stop <= this.floorCount && index > stop) return null;
    const p = new Vector3(FLOOR.width / 2, floorY(index) + FLOOR.height * 0.7, FLOOR.depth / 2).project(this.view.camera);
    if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return null;
    return { x: ((p.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - p.y) / 2) * this.canvas.clientHeight };
  }

  /** PNG of the current view (plan de polish IP-23). */
  snapshot(): string {
    this.draw();
    return this.canvas.toDataURL('image/png');
  }

  /** Finished floors fall from above and bounce once. */
  private animateDrops(now: number) {
    if (!this.drops.length) return;
    const tower = this.content.children[0];
    this.drops = this.drops.filter((d) => {
      const mesh = tower?.children[d.index];
      if (!mesh) return false;
      const t = Math.min(1, (now - d.start) / 650);
      // Ease-in fall, then a small bounce.
      const fall = t < 0.7 ? (1 - (t / 0.7) ** 2) * 16 : Math.sin(((t - 0.7) / 0.3) * Math.PI) * 1.2;
      mesh.position.y = floorY(d.index) + fall;
      if (t >= 1) {
        mesh.position.y = floorY(d.index);
        this.shake(250);
        this.onDrop?.(d.index);
        return false;
      }
      return true;
    });
  }

  /** Light of the hour and weather of the country of the week. */
  private updateLight(now: number) {
    if (now - this.lightAt < 60_000 && this.lightAt) return;
    this.lightAt = now;
    const { tint, sky } = lighting(daylight(new Date(now)), this.airport.sky);
    this.tint.copy(tint);
    this.sky.copy(sky);
    this.view.scene.background = this.sky;
    this.weather.set(WEATHER[featuredCountry(now)] ?? null);
  }

  /** Rebuilds the tower if its floors changed; keeps the airport in sync with the fleet. */
  update(state: GameState) {
    const now = Date.now();
    const country = featuredCountry(now);
    if (country !== this.country) this.lightAt = 0;
    this.country = country;
    this.airport.setTheme(country);
    this.updateLight(now);
    this.airport.sync(
      state.planes.map((p) => ({ uid: p.uid, modelId: p.modelId, flying: !!p.flight })),
      now,
    );
    const signature = state.floors.map((f) => (f.buildEndsAt !== undefined ? '#' : `${f.shop?.defId ?? ''}:${f.wallColor ?? ''}`)).join(',');
    if (signature === this.signature) return;
    // Floors that just finished building (or appeared) drop into place.
    if (this.signature) {
      const before = this.signature.split(',');
      signature.split(',').forEach((part, i) => {
        if (part !== '#' && (before[i] === '#' || before[i] === undefined)) this.drops.push({ index: i + 1, start: performance.now() });
      });
    }
    this.signature = signature;
    for (const child of [...this.content.children]) {
      child.traverse((o) => (o as { geometry?: { dispose(): void } }).geometry?.dispose());
      this.content.remove(child);
    }
    this.content.add(
      buildTower(
        state.floors.map((f) =>
          f.buildEndsAt !== undefined ? { building: true } : { shop: f.shop && SHOP_BY_ID[f.shop.defId], wallColor: f.wallColor },
        ),
      ),
    );
    this.floorCount = state.floors.length;
    this.applyVisibility();
    this.draw();
  }
}

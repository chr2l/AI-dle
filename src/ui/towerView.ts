// Cube art view of the player's tower (src/render), filling the Tour tab.
// The player moves from floor to floor: floors above the focused one and the
// roof are hidden so it can be seen, and the camera glides and zooms onto it.
// The top stop shows the whole tower. The airport around it (scenery, planes
// taking off and landing, cars, clouds) animates every frame.
import { Color, Group, type Object3D } from 'three';
import { SHOP_BY_ID } from '../core/data/shops';
import { featuredCountry } from '../core/destinations';
import type { GameState } from '../core';
import { AirportScene } from '../render/airport';
import { FLOOR } from '../render/models/floor';
import { PixelRenderer } from '../render/pixelRenderer';
import { buildTower, floorY } from '../render/tower';

/** Animation frame rate cap, to spare mobile batteries. */
const FPS = 30;
/** Zoom (CSS pixels per voxel) on a single floor, and on the whole tower. */
const ZOOM_FLOOR = 14;
const ZOOM_OVERVIEW = 6;

export class TowerView {
  private view: PixelRenderer;
  private content = new Group();
  private signature = '';
  private airport = new AirportScene();
  private lastFrame = 0;
  private floorCount = 0;
  /** 0 = hall, 1..n = floors, n + 1 = whole tower. */
  focus = Infinity;
  private camY = 0;
  private zoom = ZOOM_OVERVIEW;
  /** Called when a swipe moves to another floor, and on a tap (index = current focus). */
  onFocus?: (index: number) => void;
  onTap?: (index: number) => void;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.view = new PixelRenderer(canvas, { style: 'cube', pixelsPerVoxel: ZOOM_OVERVIEW });
    this.view.scene.add(this.content);
    this.view.scene.add(this.airport.group);
    let start: { y: number; t: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => (start = { y: e.clientY, t: Date.now() }));
    addEventListener('pointerup', (e) => {
      if (!start) return;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dy) < 10) this.onTap?.(this.stop);
      // Swipe up to climb, down to go back to the ground.
      else if (Math.abs(dy) > 30) this.move(dy < 0 ? 1 : -1);
    });
    new ResizeObserver(() => this.resize()).observe(canvas);
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      // Skip frames while the view is hidden (other tabs) or over the FPS cap.
      if (!this.canvas.clientWidth || now - this.lastFrame < 1000 / FPS) return;
      this.lastFrame = now;
      this.airport.tick(Date.now());
      this.draw();
    };
    requestAnimationFrame(loop);
  }

  /** Current stop, clamped to the existing floors. */
  get stop() {
    return Math.max(0, Math.min(this.floorCount + 1, this.focus));
  }

  private move(delta: number) {
    this.setFocus(this.stop + delta);
    this.onFocus?.(this.stop);
  }

  setFocus(index: number) {
    this.focus = Math.max(0, Math.min(this.floorCount + 1, index));
    this.applyVisibility();
  }

  private applyVisibility() {
    const stop = this.stop;
    const overview = stop > this.floorCount;
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
    const targetY = overview ? floorY(this.floorCount + 1) * 0.55 : floorY(stop) + FLOOR.height * 0.45;
    const targetZoom = overview ? Math.min(ZOOM_OVERVIEW, (this.canvas.clientHeight * 0.8) / Math.max(30, floorY(this.floorCount + 2) * 1.1)) : ZOOM_FLOOR;
    // Ease toward the target for a smooth elevator ride.
    this.camY += (targetY - this.camY) * 0.18;
    this.zoom += (targetZoom - this.zoom) * 0.18;
    const { width, height } = this.view.artSize;
    const halfW = width / this.zoom / 2;
    const halfH = height / this.zoom / 2;
    Object.assign(this.view.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.view.camera.updateProjectionMatrix();
    this.view.target.set(FLOOR.width / 2, this.camY, FLOOR.depth / 2);
    this.view.render();
  }

  /** Rebuilds the tower if its floors changed; keeps the airport in sync with the fleet. */
  update(state: GameState) {
    const now = Date.now();
    this.airport.setTheme(featuredCountry(now));
    this.view.scene.background = new Color(this.airport.sky);
    this.airport.sync(
      state.planes.map((p) => ({ uid: p.uid, modelId: p.modelId, flying: !!p.flight })),
      now,
    );
    const signature = state.floors.map((f) => (f.buildEndsAt !== undefined ? '#' : `${f.shop?.defId ?? ''}:${f.wallColor ?? ''}`)).join(',');
    if (signature === this.signature) return;
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

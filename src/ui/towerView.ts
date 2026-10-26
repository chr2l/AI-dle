// Cube art view of the player's tower (src/render), above the Tour panel.
// The tower is rebuilt only when its floors change; the airport around it
// (scenery, planes taking off and landing, cars, clouds) animates every
// frame. Drag scrolls the view.
import { Color, Group } from 'three';
import { SHOP_BY_ID } from '../core/data/shops';
import { featuredCountry } from '../core/destinations';
import type { GameState } from '../core';
import { AirportScene } from '../render/airport';
import { FLOOR } from '../render/models/floor';
import { PixelRenderer } from '../render/pixelRenderer';
import { buildTower, floorY } from '../render/tower';

/** Animation frame rate cap, to spare mobile batteries. */
const FPS = 30;

export class TowerView {
  private view: PixelRenderer;
  private content = new Group();
  private signature = '';
  private scroll = 0;
  private maxY = 0;
  private followTop = true;
  private airport = new AirportScene();
  private lastFrame = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.view = new PixelRenderer(canvas, { style: 'cube', pixelsPerVoxel: 6 });
    this.view.scene.add(this.content);
    this.view.scene.add(this.airport.group);
    let lastY: number | null = null;
    canvas.addEventListener('pointerdown', (e) => (lastY = e.clientY));
    addEventListener('pointerup', () => (lastY = null));
    addEventListener('pointermove', (e) => {
      if (lastY === null) return;
      this.scrollBy((e.clientY - lastY) / this.view.pixelsPerVoxel);
      lastY = e.clientY;
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

  resize() {
    if (!this.canvas.clientWidth) return;
    this.view.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.draw();
  }

  private scrollBy(dy: number) {
    this.scroll = Math.min(this.maxY, Math.max(0, this.scroll + dy));
    this.followTop = this.scroll >= this.maxY - FLOOR.height;
    this.draw();
  }

  private draw() {
    this.view.target.set(FLOOR.width / 2, this.scroll, FLOOR.depth / 2);
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
    this.maxY = floorY(state.floors.length + 1);
    // Stay on the newest floor unless the player scrolled down on purpose.
    if (this.followTop) this.scroll = Math.max(0, floorY(state.floors.length));
    this.draw();
  }
}

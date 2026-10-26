// Cube art view of the player's tower (src/render), above the Tour panel.
// The scene is rebuilt only when what it shows changes; drag scrolls it.
import { Group } from 'three';
import { PLANE_BY_ID } from '../core/data/planes';
import { SHOP_BY_ID } from '../core/data/shops';
import type { GameState } from '../core';
import { FLOOR } from '../render/models/floor';
import { PixelRenderer } from '../render/pixelRenderer';
import { buildApron, buildTower, floorY } from '../render/tower';

export class TowerView {
  private view: PixelRenderer;
  private content = new Group();
  private signature = '';
  private scroll = 0;
  private maxY = 0;
  private followTop = true;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.view = new PixelRenderer(canvas, { style: 'cube', pixelsPerVoxel: 6 });
    this.view.scene.add(this.content);
    let lastY: number | null = null;
    canvas.addEventListener('pointerdown', (e) => (lastY = e.clientY));
    addEventListener('pointerup', () => (lastY = null));
    addEventListener('pointermove', (e) => {
      if (lastY === null) return;
      this.scrollBy((e.clientY - lastY) / this.view.pixelsPerVoxel);
      lastY = e.clientY;
    });
    new ResizeObserver(() => this.resize()).observe(canvas);
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

  /** Rebuilds the meshes if floors or planes changed since the last call. */
  update(state: GameState) {
    const floors = state.floors.map((f) => (f.buildEndsAt !== undefined ? '#' : `${f.shop?.defId ?? ''}:${f.wallColor ?? ''}`));
    const planes = state.planes.map((p) => (p.flight ? '' : p.modelId));
    const signature = `${floors.join(',')}|${planes.join(',')}`;
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
    this.content.add(buildApron(state.planes.filter((p) => !p.flight).map((p) => ({ model: PLANE_BY_ID[p.modelId] }))));
    this.maxY = floorY(state.floors.length + 1);
    // Stay on the newest floor unless the player scrolled down on purpose.
    if (this.followTop) this.scroll = Math.max(0, floorY(state.floors.length));
    this.draw();
  }
}

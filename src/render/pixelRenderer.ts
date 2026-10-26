import {
  Color,
  DataTexture,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { EDGE, EDGE_ATLAS_COLUMNS } from './voxel';

/**
 * - `cube`: crisp full-resolution render, every voxel drawn as a visible cube
 *   with darkened edges (cube art).
 * - `pixel`: low-resolution render upscaled without smoothing (pixel art).
 */
export type VoxelStyle = 'cube' | 'pixel';

export interface PixelRendererOptions {
  style?: VoxelStyle;
  /** Pixel style: screen pixels per art pixel (the canvas is scaled up without smoothing). */
  pixelScale?: number;
  /** Art pixels (CSS pixels in cube style) per voxel edge, which sets the zoom. */
  pixelsPerVoxel?: number;
  background?: string;
}

/** Iso camera direction: looks from (+x, +y, +z) toward the origin. */
export const ISO_DIRECTION = new Vector3(1, 1, 1).normalize();

/** One shared material: shading is baked in the vertex colors. */
export const voxelMaterial = new MeshBasicMaterial({ vertexColors: true });

/**
 * Outline atlas for the cube style: 4×4 tiles, one per edge mask (see
 * EDGE in voxel.ts). A tile darkens a 1-texel line only on the edges its
 * mask names, so cubes of one object join seamlessly.
 */
export function cubeEdgeTexture(tile = 16, darkness = 0.8): DataTexture {
  const size = tile * EDGE_ATLAS_COLUMNS;
  const data = new Uint8Array(size * size * 4);
  const line = Math.round(255 * darkness);
  for (let ty = 0; ty < size; ty++)
    for (let tx = 0; tx < size; tx++) {
      const mask = Math.floor(ty / tile) * EDGE_ATLAS_COLUMNS + Math.floor(tx / tile);
      const x = tx % tile;
      const y = ty % tile;
      const edged =
        (mask & EDGE.u0 && x === 0) ||
        (mask & EDGE.u1 && x === tile - 1) ||
        (mask & EDGE.v0 && y === 0) ||
        (mask & EDGE.v1 && y === tile - 1);
      const v = edged ? line : 255;
      data.set([v, v, v, 255], (ty * size + tx) * 4);
    }
  const texture = new DataTexture(data, size, size);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

let edgeTexture: DataTexture | null = null;

/** Switches every voxel mesh between the cube and pixel looks. */
export function setVoxelStyle(style: VoxelStyle): void {
  voxelMaterial.map = style === 'cube' ? (edgeTexture ??= cubeEdgeTexture()) : null;
  voxelMaterial.needsUpdate = true;
}

/**
 * Renders a three.js scene with an orthographic iso camera. In pixel style
 * the image is drawn at low resolution and upscaled with `image-rendering:
 * pixelated`, the camera snapped to the art-pixel grid so voxels do not
 * shimmer while the tower scrolls. In cube style it renders at full
 * resolution with antialiasing and edged cubes.
 */
export class PixelRenderer {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
  readonly renderer: WebGLRenderer;
  readonly target = new Vector3();
  readonly style: VoxelStyle;
  pixelScale: number;
  pixelsPerVoxel: number;
  private artWidth = 1;
  private artHeight = 1;

  constructor(
    readonly canvas: HTMLCanvasElement,
    opts: PixelRendererOptions = {},
  ) {
    this.style = opts.style ?? 'cube';
    const cube = this.style === 'cube';
    this.pixelScale = cube ? 1 : (opts.pixelScale ?? 3);
    this.pixelsPerVoxel = opts.pixelsPerVoxel ?? (cube ? 10 : 4);
    this.renderer = new WebGLRenderer({ canvas, antialias: cube, alpha: false });
    this.renderer.setPixelRatio(cube ? Math.min(2, globalThis.devicePixelRatio ?? 1) : 1);
    this.scene.background = new Color(opts.background ?? '#1b1f3b');
    setVoxelStyle(this.style);
    if (!cube) canvas.style.imageRendering = 'pixelated';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  /** Call on resize with the CSS size of the canvas. */
  resize(cssWidth: number, cssHeight: number): void {
    this.artWidth = Math.max(1, Math.ceil(cssWidth / this.pixelScale));
    this.artHeight = Math.max(1, Math.ceil(cssHeight / this.pixelScale));
    this.renderer.setSize(this.artWidth, this.artHeight, false);
    const halfW = this.artWidth / this.pixelsPerVoxel / 2;
    const halfH = this.artHeight / this.pixelsPerVoxel / 2;
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.camera.updateProjectionMatrix();
  }

  /** Size of the low-resolution image, in art pixels. */
  get artSize(): { width: number; height: number } {
    return { width: this.artWidth, height: this.artHeight };
  }

  render(): void {
    const snapped = this.style === 'pixel' ? snapToPixelGrid(this.target, this.pixelsPerVoxel) : this.target.clone();
    this.camera.position.copy(snapped).addScaledVector(ISO_DIRECTION, 100);
    this.camera.lookAt(snapped);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}

const RIGHT = new Vector3(1, 0, -1).normalize();
const UP = new Vector3().crossVectors(RIGHT, ISO_DIRECTION).normalize();

/**
 * Moves a point so its projection on the camera plane lands on whole art
 * pixels, keeping its depth along the view axis.
 */
export function snapToPixelGrid(point: Vector3, pixelsPerVoxel: number): Vector3 {
  const step = 1 / pixelsPerVoxel;
  const r = point.dot(RIGHT);
  const u = point.dot(UP);
  const d = point.dot(ISO_DIRECTION);
  return new Vector3()
    .addScaledVector(RIGHT, Math.round(r / step) * step)
    .addScaledVector(UP, Math.round(u / step) * step)
    .addScaledVector(ISO_DIRECTION, d);
}

import { Color, DataTexture, MeshBasicMaterial, NearestFilter, SRGBColorSpace, OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three';

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
 * Edge texture for the cube style: a darker 1-texel border and a lighter
 * inner rim on every face, multiplied with the baked vertex colors.
 */
export function cubeEdgeTexture(size = 16): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const ring = Math.min(x, y, size - 1 - x, size - 1 - y);
      const v = ring === 0 ? 168 : ring === 1 && (x === 1 || y === size - 2) ? 255 : 236;
      data.set([v, v, v, 255], (y * size + x) * 4);
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

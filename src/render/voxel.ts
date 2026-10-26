import { BufferAttribute, BufferGeometry } from 'three';
import { hexToRgb } from './palette';

/**
 * Baked face shading, as in the GDD: top light, left medium, right dark.
 * The iso camera looks from (+x, +y, +z), so +z faces appear on the left of
 * the screen and +x faces on the right.
 */
export const FACE_SHADE = { top: 1, left: 0.8, right: 0.62, bottom: 0.5, back: 0.7 } as const;

/** A dense voxel grid. Colors are 0xRRGGBB numbers, -1 means empty. */
export class VoxelGrid {
  readonly cells: Int32Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly depth: number,
  ) {
    this.cells = new Int32Array(width * height * depth).fill(-1);
  }

  private index(x: number, y: number, z: number): number {
    return x + this.width * (z + this.depth * y);
  }

  inside(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.width && y < this.height && z < this.depth;
  }

  get(x: number, y: number, z: number): number {
    return this.inside(x, y, z) ? this.cells[this.index(x, y, z)] : -1;
  }

  set(x: number, y: number, z: number, color: number | string): this {
    if (this.inside(x, y, z)) this.cells[this.index(x, y, z)] = toColor(color);
    return this;
  }

  clear(x: number, y: number, z: number): this {
    if (this.inside(x, y, z)) this.cells[this.index(x, y, z)] = -1;
    return this;
  }

  /** Fills the box [x0, x1] × [y0, y1] × [z0, z1] (inclusive). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number | string): this {
    const c = toColor(color);
    for (let y = Math.max(0, y0); y <= Math.min(this.height - 1, y1); y++)
      for (let z = Math.max(0, z0); z <= Math.min(this.depth - 1, z1); z++)
        for (let x = Math.max(0, x0); x <= Math.min(this.width - 1, x1); x++) this.cells[this.index(x, y, z)] = c;
    return this;
  }

  /** Copies another grid into this one at an offset, skipping its empty cells. */
  stamp(other: VoxelGrid, ox: number, oy: number, oz: number): this {
    for (let y = 0; y < other.height; y++)
      for (let z = 0; z < other.depth; z++)
        for (let x = 0; x < other.width; x++) {
          const c = other.get(x, y, z);
          if (c >= 0) this.set(x + ox, y + oy, z + oz, c);
        }
    return this;
  }

  count(): number {
    let n = 0;
    for (const c of this.cells) if (c >= 0) n++;
    return n;
  }
}

function toColor(color: number | string): number {
  return typeof color === 'number' ? color : parseInt(color.replace('#', ''), 16);
}

interface FaceDef {
  dir: [number, number, number];
  shade: number;
  /** Four corners, counter-clockwise seen from outside. */
  corners: [number, number, number][];
}

const FACES: FaceDef[] = [
  { dir: [0, 1, 0], shade: FACE_SHADE.top, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, -1, 0], shade: FACE_SHADE.bottom, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { dir: [1, 0, 0], shade: FACE_SHADE.right, corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { dir: [-1, 0, 0], shade: FACE_SHADE.back, corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { dir: [0, 0, 1], shade: FACE_SHADE.left, corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { dir: [0, 0, -1], shade: FACE_SHADE.back, corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

export interface MeshData {
  positions: Float32Array;
  colors: Float32Array;
  /** Each face gets the full 0..1 square, so a texture can draw cube edges. */
  uvs: Float32Array;
  indices: Uint32Array;
  faceCount: number;
}

/**
 * Builds the visible faces of a grid (faces touching another voxel are
 * culled) with the face shading baked into vertex colors.
 */
export function buildMeshData(grid: VoxelGrid): MeshData {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let faceCount = 0;
  for (let y = 0; y < grid.height; y++)
    for (let z = 0; z < grid.depth; z++)
      for (let x = 0; x < grid.width; x++) {
        const c = grid.get(x, y, z);
        if (c < 0) continue;
        const [r, g, b] = hexToRgb(c);
        for (const face of FACES) {
          if (grid.get(x + face.dir[0], y + face.dir[1], z + face.dir[2]) >= 0) continue;
          const base = positions.length / 3;
          for (const [cx, cy, cz] of face.corners) {
            positions.push(x + cx, y + cy, z + cz);
            colors.push(r * face.shade, g * face.shade, b * face.shade);
          }
          uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          faceCount++;
        }
      }
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    faceCount,
  };
}

export function buildGeometry(grid: VoxelGrid): BufferGeometry {
  const data = buildMeshData(grid);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new BufferAttribute(data.colors, 3));
  geometry.setAttribute('uv', new BufferAttribute(data.uvs, 2));
  geometry.setIndex(new BufferAttribute(data.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

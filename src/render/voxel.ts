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

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function toColor(color: number | string): number {
  return typeof color === 'number' ? color : parseInt(color.replace('#', ''), 16);
}

export interface FaceDef {
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
  /** Points each face at the tile of the edge atlas matching its outline mask. */
  uvs: Float32Array;
  indices: Uint32Array;
  faceCount: number;
}

/** Outline bits of a face, in its own uv frame. */
export const EDGE = { u0: 1, u1: 2, v0: 4, v1: 8 } as const;
/** The 16 masks are laid out as a 4×4 atlas (see cubeEdgeTexture). */
export const EDGE_ATLAS_COLUMNS = 4;

/** Above this distance (sum of RGB channel gaps, 0..765) two voxels belong to different objects. */
const OBJECT_COLOR_GAP = 60;

/** In-plane overlap of neighboring quads, in voxels. */
const SEAM_OVERLAP = 0.02;

function sameObject(a: number, b: number): boolean {
  const gap =
    Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)) +
    Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) +
    Math.abs((a & 255) - (b & 255));
  return gap <= OBJECT_COLOR_GAP;
}

/**
 * Which edges of a visible face get an outline: only where the surface of an
 * object ends (silhouette, corner) or meets a different object (color
 * change). Faces inside one object join without a line.
 */
export function faceEdgeMask(grid: VoxelGrid, x: number, y: number, z: number, face: FaceDef): number {
  const color = grid.get(x, y, z);
  const [c0, c1, , c3] = face.corners;
  const u = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]];
  const v = [c3[0] - c0[0], c3[1] - c0[1], c3[2] - c0[2]];
  const n = face.dir;
  const edges: [number[], number][] = [
    [u.map((a) => -a), EDGE.u0],
    [u, EDGE.u1],
    [v.map((a) => -a), EDGE.v0],
    [v, EDGE.v1],
  ];
  let mask = 0;
  for (const [[dx, dy, dz], bit] of edges) {
    const side = grid.get(x + dx, y + dy, z + dz);
    const over = grid.get(x + dx + n[0], y + dy + n[1], z + dz + n[2]);
    // Concave crease: the face meets the side of the voxel standing next to it.
    if (over >= 0) {
      if (!sameObject(color, over)) mask |= bit;
    } else if (side < 0 || !sameObject(color, side)) mask |= bit;
  }
  return mask;
}

/**
 * Builds the visible faces of a grid (faces touching another voxel are
 * culled) with the face shading baked into vertex colors and an outline
 * mask per face for the cube style.
 */
export function buildMeshData(grid: VoxelGrid): MeshData {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const inset = 0.002;
  let faceCount = 0;
  for (let y = 0; y < grid.height; y++)
    for (let z = 0; z < grid.depth; z++)
      for (let x = 0; x < grid.width; x++) {
        const c = grid.get(x, y, z);
        if (c < 0) continue;
        const [r, g, b] = hexToRgb(c);
        // Colors are authored in sRGB; the renderer works in linear space.
        const tint = (channel: number, shade: number) => srgbToLinear(channel * shade);
        for (const face of FACES) {
          if (grid.get(x + face.dir[0], y + face.dir[1], z + face.dir[2]) >= 0) continue;
          const base = positions.length / 3;
          for (const [cx, cy, cz] of face.corners) {
            // Grow each quad a hair inside its plane so no seam shows between faces.
            const grow = (c: number, axis: number) => (face.dir[axis] === 0 ? (c - 0.5) * SEAM_OVERLAP : 0);
            positions.push(x + cx + grow(cx, 0), y + cy + grow(cy, 1), z + cz + grow(cz, 2));
            colors.push(tint(r, face.shade), tint(g, face.shade), tint(b, face.shade));
          }
          const mask = faceEdgeMask(grid, x, y, z, face);
          const col = mask % EDGE_ATLAS_COLUMNS;
          const row = Math.floor(mask / EDGE_ATLAS_COLUMNS);
          const lo = (t: number) => (t + inset) / EDGE_ATLAS_COLUMNS;
          const hi = (t: number) => (t + 1 - inset) / EDGE_ATLAS_COLUMNS;
          uvs.push(lo(col), lo(row), hi(col), lo(row), hi(col), hi(row), lo(col), hi(row));
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

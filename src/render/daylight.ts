import { BufferAttribute, BufferGeometry, Color, Points, PointsMaterial } from 'three';
import type { CountryId } from '../core/types';

/**
 * Day and night on the local clock, and the weather of the country of the
 * week (plan de polish IP-22). Shading is baked in the vertex colors, so the
 * night is a tint on the shared voxel material and a darker sky.
 */

/** 1 in full day, 0 at night, with a two-hour dawn (6 h to 8 h) and dusk (19 h to 21 h). */
export function daylight(date: Date): number {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 8 && h < 19) return 1;
  if (h >= 6 && h < 8) return (h - 6) / 2;
  if (h >= 19 && h < 21) return 1 - (h - 19) / 2;
  return 0;
}

const NIGHT_TINT = new Color(0.5, 0.55, 0.8);
const NIGHT_SKY = new Color('#0e1236');
const DUSK_SKY = new Color('#f08a5d');

/** Material tint and sky color for a daylight level. */
export function lighting(k: number, sky: number | string): { tint: Color; sky: Color } {
  const tint = NIGHT_TINT.clone().lerp(new Color(1, 1, 1), k);
  const day = new Color(sky);
  // Dawn and dusk pass through a warm sky before night.
  const twilight = k > 0 && k < 1 ? 1 - Math.abs(k - 0.5) * 2 : 0;
  const out = NIGHT_SKY.clone().lerp(day, k).lerp(DUSK_SKY, twilight * 0.35);
  return { tint, sky: out };
}

export type WeatherKind = 'snow' | 'rain' | 'embers';

export const WEATHER: Partial<Record<CountryId, WeatherKind>> = {
  givrebourg: 'snow',
  tropicalia: 'rain',
  nuagelande: 'rain',
  infernia: 'embers',
};

const SPEC: Record<WeatherKind, { color: string; size: number; fall: number; drift: number; count: number }> = {
  snow: { color: '#ffffff', size: 3, fall: 9, drift: 3, count: 260 },
  rain: { color: '#9cc9ff', size: 2, fall: 60, drift: 0, count: 320 },
  embers: { color: '#ff8a3d', size: 3, fall: -10, drift: 4, count: 120 },
};

/** Box around the camera target where particles live, in voxels. */
const SPAN = { x: 140, y: 140, z: 140 };

/** Falling (or rising) particles that follow the camera. */
export class Weather {
  readonly points: Points;
  private kind: WeatherKind | null = null;
  private seeds: Float32Array;

  constructor() {
    const max = Math.max(...Object.values(SPEC).map((s) => s.count));
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(max * 3), 3));
    this.seeds = new Float32Array(max * 4).map(() => Math.random());
    this.points = new Points(geo, new PointsMaterial({ size: 2, sizeAttenuation: false, transparent: true, opacity: 0.85 }));
    this.points.visible = false;
    this.points.frustumCulled = false;
  }

  set(kind: WeatherKind | null) {
    if (kind === this.kind) return;
    this.kind = kind;
    this.points.visible = !!kind;
    if (!kind) return;
    const spec = SPEC[kind];
    const mat = this.points.material as PointsMaterial;
    mat.color.set(spec.color);
    mat.size = spec.size;
    this.points.geometry.setDrawRange(0, spec.count);
  }

  /** Moves the particles; `center` is the camera target. */
  tick(seconds: number, center: { x: number; y: number; z: number }) {
    if (!this.kind) return;
    const spec = SPEC[this.kind];
    const pos = this.points.geometry.getAttribute('position') as BufferAttribute;
    const wrap = (v: number, span: number) => ((v % span) + span) % span - span / 2;
    for (let i = 0; i < spec.count; i++) {
      const [a, b, c, d] = [this.seeds[i * 4], this.seeds[i * 4 + 1], this.seeds[i * 4 + 2], this.seeds[i * 4 + 3]];
      const speed = 0.7 + d * 0.6;
      const sway = Math.sin(seconds * (0.6 + d) + a * 20) * spec.drift;
      pos.setXYZ(
        i,
        center.x + wrap(a * SPAN.x + sway, SPAN.x),
        center.y + wrap(b * SPAN.y - seconds * spec.fall * speed, SPAN.y),
        center.z + wrap(c * SPAN.z + sway * 0.5, SPAN.z),
      );
    }
    pos.needsUpdate = true;
  }
}

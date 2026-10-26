import { COUNTRIES } from '../core/data/countries';
import type { Element } from '../core/types';

/** 0xRRGGBB → linear-free [r, g, b] in 0..1 (vertex colors are used as-is). */
export function hexToRgb(color: number): [number, number, number] {
  return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
}

export function toHex(color: string): number {
  return parseInt(color.replace('#', ''), 16);
}

/** Mixes two colors; t = 0 gives a, t = 1 gives b. */
export function mix(a: number, b: number, t: number): number {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const ch = (x: number, y: number) => Math.round((x + (y - x) * t) * 255);
  return (ch(ar, br) << 16) | (ch(ag, bg) << 8) | ch(ab, bb);
}

export const darken = (c: number, t: number) => mix(c, 0x000000, t);
export const lighten = (c: number, t: number) => mix(c, 0xffffff, t);

/** Palette used for neutral content (the airport's own colors). */
export const NEUTRAL_PALETTE = ['#e9e4d8', '#4a6fa5', '#2b2d42', '#f4a259'];

/** Four colors for an element: [main, accent, dark, highlight]. */
export function paletteFor(element: Element): number[] {
  const country = COUNTRIES.find((c) => c.id === element);
  return (country?.palette ?? NEUTRAL_PALETTE).map(toHex);
}

/** Small deterministic PRNG (mulberry32) so models are reproducible by seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

/** Slight per-voxel brightness noise: gives surfaces a hand-made pixel texture. */
export function grain(rand: () => number, color: number, amount = 0.06): number {
  const t = (rand() - 0.5) * 2 * amount;
  return t >= 0 ? lighten(color, t) : darken(color, -t);
}

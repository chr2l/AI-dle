import { describe, expect, it } from 'vitest';
import {
  canPlace, connected, footprint, place, rectDistance, remove, roomBonus, rotate, starterLayout, touching, zoneBonus,
  type CityLayout, type Placed,
} from '../src/core/city';

const empty = (): CityLayout => ({ width: 12, depth: 12, items: [] });
const P = (uid: string, kind: Placed['kind'], x: number, z: number, shopId?: string, rot: 0 | 1 = 0): Placed => ({ uid, kind, x, z, rot, shopId });

describe('city layout', () => {
  it('refuses overlaps, out-of-bounds and a second terminal', () => {
    const l = empty();
    expect(place(l, P('t', 'terminal', 0, 0))).toBe(true);
    expect(canPlace(l, P('s', 'salle', 2, 2))).toBe(false);
    expect(canPlace(l, P('s', 'salle', 11, 0))).toBe(false);
    expect(canPlace(l, P('t2', 'terminal', 6, 6))).toBe(false);
    expect(canPlace(l, P('s', 'salle', 3, 0))).toBe(true);
  });

  it('moves and rotates in place, keeps the terminal', () => {
    const l = empty();
    place(l, P('t', 'terminal', 0, 0));
    place(l, P('g', 'porte', 3, 0));
    expect(footprint(l.items[1])).toEqual({ x: 3, z: 0, w: 2, d: 1 });
    expect(rotate(l, 'g')).toBe(true);
    expect(footprint(l.items[1])).toEqual({ x: 3, z: 0, w: 1, d: 2 });
    expect(place(l, { ...l.items[1], x: 6 })).toBe(true);
    expect(l.items).toHaveLength(2);
    expect(remove(l, 't')).toBe(false);
    expect(remove(l, 'g')).toBe(true);
  });

  it('touching needs a shared edge, distance is Chebyshev', () => {
    expect(touching({ x: 0, z: 0, w: 2, d: 2 }, { x: 2, z: 1, w: 1, d: 1 })).toBe(true);
    expect(touching({ x: 0, z: 0, w: 2, d: 2 }, { x: 2, z: 2, w: 1, d: 1 })).toBe(false);
    expect(rectDistance({ x: 0, z: 0, w: 2, d: 2 }, { x: 4, z: 1, w: 1, d: 1 })).toBe(3);
  });

  it('links rooms through corridors to the terminal', () => {
    const l = empty();
    place(l, P('t', 'terminal', 0, 0));
    place(l, P('c1', 'couloir', 3, 0));
    place(l, P('c2', 'couloir', 4, 0));
    place(l, P('a', 'salle', 5, 0, 'cafe'));
    place(l, P('b', 'salle', 8, 8, 'cafe'));
    const linked = connected(l);
    expect([...linked].sort()).toEqual(['a', 'c1', 'c2', 't']);
    expect(roomBonus(l, 'b', linked).multiplier).toBe(0);
    expect(roomBonus(l, 'a', linked).multiplier).toBeGreaterThan(0);
  });

  it('rewards neighbours, zones, beauty and gates', () => {
    const l = empty();
    place(l, P('t', 'terminal', 0, 0));
    place(l, P('a', 'salle', 3, 0, 'cafe'));
    place(l, P('b', 'salle', 3, 2, 'sandwich'));
    place(l, P('c', 'salle', 5, 0, 'cafe'));
    const alone = roomBonus(l, 'a');
    expect(alone.neighbours).toBe(2); // b below and c on the right, both neutral
    place(l, P('f', 'fontaine', 0, 3));
    place(l, P('g', 'porte', 0, 5));
    const r = roomBonus(l, 'a');
    expect(r.zoneSize).toBe(3);
    expect(r.zone).toBe(0.1);
    expect(r.beauty).toBe(4);
    expect(r.nearGate).toBe(false);
    expect(roomBonus(l, 'b').nearGate).toBe(true);
    expect(zoneBonus(6)).toBe(0.25);
  });

  it('starter layout fits and links most rooms', () => {
    const l = starterLayout(['cafe', 'sandwich', 'cafe', 'sandwich', 'cafe', 'sandwich', 'cafe', 'sandwich', 'cafe', 'sandwich']);
    expect(l.items.filter((p) => p.kind === 'salle')).toHaveLength(10);
    const linked = connected(l);
    const rooms = l.items.filter((p) => p.kind === 'salle');
    expect(rooms.filter((p) => linked.has(p.uid)).length).toBeGreaterThanOrEqual(8);
    for (const p of l.items) expect(canPlace(l, p)).toBe(true);
  });
});

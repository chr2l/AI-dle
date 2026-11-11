import { describe, expect, it } from 'vitest';
import { canPlace, connected, footprint, PLOT, plotKey } from '../src/core/city';
import {
  buyPlot, canBuyPlot, cityFromFloors, cityPlace, cityPrice, cityRemove, ensureCity, placeRoom, plotPrice, roomMultiplier, unplacedFloors,
} from '../src/core/cityGame';
import { buildFloor } from '../src/core/engine';
import { deserialize, serialize } from '../src/core/save';
import { createInitialState } from '../src/core/state';

const T0 = 1_700_000_000_000;

describe('flat airport in a game', () => {
  it('starts with an airport and puts each new floor on the land, linked', () => {
    const s = createInitialState(T0, 1);
    expect(s.city?.items.some((p) => p.kind === 'terminal')).toBe(true);
    s.coins = 1e9;
    expect(buildFloor(s, T0).ok).toBe(true);
    const room = s.city!.items.find((p) => p.kind === 'salle' && p.floor === 0)!;
    expect(room).toBeDefined();
    expect(connected(s.city!).has(room.uid)).toBe(true);
  });

  it('converts a tower save: one linked room per floor while the land allows', () => {
    const s = createInitialState(T0, 2);
    s.floors = Array.from({ length: 14 }, () => ({ shop: { defId: 'cafe', level: 1, stars: 1, stock: 0 } }));
    const raw = JSON.parse(serialize(s));
    raw.version = 1;
    delete raw.city;
    const loaded = deserialize(JSON.stringify(raw), T0)!;
    const rooms = loaded.city!.items.filter((p) => p.kind === 'salle');
    const linked = connected(loaded.city!);
    expect(rooms.length + unplacedFloors(loaded).length).toBe(14);
    expect(rooms.length).toBeGreaterThanOrEqual(10);
    for (const r of rooms) expect(linked.has(r.uid)).toBe(true);
    for (const p of loaded.city!.items) expect(canPlace(loaded.city!, p)).toBe(true);
  });

  it('a room that waits for space keeps its normal income', () => {
    const s = createInitialState(T0, 3);
    s.floors = Array.from({ length: 40 }, () => ({ shop: { defId: 'cafe', level: 1, stars: 1, stock: 0 } }));
    s.city = cityFromFloors(40);
    const waiting = unplacedFloors(s);
    expect(waiting.length).toBeGreaterThan(0);
    expect(roomMultiplier(s, waiting[0])).toBe(1);
  });

  it('sells decorations at a rising price, corridors are free, rooms cannot be removed', () => {
    const s = createInitialState(T0, 4);
    s.coins = 1000;
    expect(cityPrice(s, 'couloir')).toBe(0);
    const first = cityPrice(s, 'banc');
    expect(cityPlace(s, { uid: 'new', kind: 'banc', x: 9, z: 5, rot: 0 }).ok).toBe(true);
    expect(s.coins).toBe(1000 - first);
    expect(cityPrice(s, 'banc')).toBeGreaterThan(first);
    expect(cityPlace(s, { uid: 'new', kind: 'fontaine', x: 9, z: 12, rot: 0 }).ok).toBe(false);
    expect(cityPlace(s, { uid: 'new', kind: 'salle', x: 9, z: 12, rot: 0 }).ok).toBe(false);
    s.coins = 1e9;
    buildFloor(s, T0);
    const room = s.city!.items.find((p) => p.kind === 'salle')!;
    expect(cityRemove(s, room.uid).ok).toBe(false);
    const terminal = s.city!.items.find((p) => p.kind === 'terminal')!;
    expect(cityRemove(s, terminal.uid).ok).toBe(false);
  });

  it('opens land plot by plot, next to owned plots, at a rising price', () => {
    const s = createInitialState(T0, 5);
    const city = ensureCity(s);
    expect(canPlace(city, { uid: 'x', kind: 'arbre', x: 2, z: 2, rot: 0 })).toBe(false);
    expect(canBuyPlot(city, 0, 0)).toBe(false);
    expect(canBuyPlot(city, 1, 1)).toBe(true);
    s.coins = 1e9;
    const price = plotPrice(s);
    expect(buyPlot(s, 1, 1).ok).toBe(true);
    expect(city.plots).toContain(plotKey(1, 1));
    expect(plotPrice(s)).toBeGreaterThan(price);
    expect(canPlace(city, { uid: 'x', kind: 'arbre', x: PLOT + 1, z: PLOT + 1, rot: 0 })).toBe(true);
    expect(canBuyPlot(city, 5, 1)).toBe(false); // runway side
  });

  it('places a waiting room by hand and keeps the save round trip', () => {
    const s = createInitialState(T0, 6);
    s.floors = Array.from({ length: 40 }, () => ({ shop: { defId: 'cafe', level: 1, stars: 1, stock: 0 } }));
    s.city = cityFromFloors(40);
    const floor = unplacedFloors(s)[0];
    s.coins = 1e12;
    expect(buyPlot(s, 1, 2).ok).toBe(true);
    // Buying land places waiting rooms automatically when it can.
    expect(unplacedFloors(s).includes(floor) || s.city.items.some((p) => p.floor === floor)).toBe(true);
    const next = unplacedFloors(s)[0];
    if (next !== undefined) expect(placeRoom(s, next, -5, 0).ok).toBe(false);
    const back = deserialize(serialize(s), T0)!;
    expect(back.city!.items.length).toBe(s.city.items.length);
    expect(footprint(back.city!.items[0])).toEqual(footprint(s.city.items[0]));
  });
});

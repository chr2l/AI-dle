import { beforeEach, describe, expect, it } from 'vitest';
import { RESTOCK_TIERS } from '../src/core/data/shops';
import { destinationsFor } from '../src/core/destinations';
import {
  addCrewXp,
  addXp,
  assignCrew,
  buildFloor,
  buyPlane,
  collectFlight,
  doubleOffline,
  openShop,
  recruit,
  renamePlane,
  repairPlane,
  rerollShop,
  resolveEvent,
  restock,
  restockExpress,
  sendFlight,
  startResearch,
  swapFloors,
  tick,
  upgradePlane,
  upgradeShop,
} from '../src/core/engine';
import { buildCost, buildDuration, flightDuration, planeUpgradeCost, shopUpgradeCost, xpToNext } from '../src/core/formulas';
import { mulberry32 } from '../src/core/rng';
import { createInitialState } from '../src/core/state';
import { planeStats, shopPool, shopRate } from '../src/core/stats';
import type { CrewMember, Destination, GameState } from '../src/core/types';
import { cityPlace, ensureCity, floorBonus } from '../src/core/cityGame';

const T0 = 1_800_000_000_000;
const S = 1000;

/** Rng that always returns the same value (0 = best roll, 0.999 = worst). */
const fixed = (v: number) => () => v;
/** Rng replaying the given rolls, then repeating the last one. */
const seq = (...rolls: number[]) => {
  let i = 0;
  return () => rolls[Math.min(i++, rolls.length - 1)];
};

let state: GameState;
beforeEach(() => {
  state = createInitialState(T0, 42);
});

function builtFloorWithShop(defId = 'cafe'): number {
  state.floors.push({ shop: { defId, level: 1, stars: 1, stock: 0 } });
  return state.floors.length - 1;
}

const dest = (over: Partial<Destination> = {}): Destination => ({
  id: 'd', countryId: 'melodia', name: 'Doville', distance: 300, modifier: 'calme', ...over,
});

describe('formulas', () => {
  it('match the GDD', () => {
    expect(buildCost(1)).toBe(150);
    expect(buildCost(2)).toBe(218);
    expect(shopUpgradeCost('C', 1)).toBe(60);
    expect(shopUpgradeCost('L', 1)).toBe(252);
    expect(planeUpgradeCost(0, 0)).toBe(75);
    expect(flightDuration(300, 300)).toBe(150);
    expect(xpToNext(1)).toBe(150);
  });
});

describe('tower', () => {
  it('builds a floor over time and grants XP', () => {
    expect(buildFloor(state, T0).ok).toBe(true);
    expect(state.coins).toBe(300 - 150);
    expect(buildFloor(state, T0).ok).toBe(false); // one at a time
    tick(state, T0 + buildDuration(1) * S - 1);
    expect(state.floors[0].buildEndsAt).toBeDefined();
    tick(state, T0 + buildDuration(1) * S);
    expect(state.floors[0].buildEndsAt).toBeUndefined();
    expect(state.stats.floorsBuilt).toBe(1);
    expect(state.xp).toBe(10);
  });

  it('refuses floors beyond the level cap', () => {
    for (let i = 0; i < 9; i++) state.floors.push({});
    state.coins = 1e9;
    expect(buildFloor(state, T0)).toMatchObject({ ok: false });
  });

  it('draws a shop from the pool of the chosen category', () => {
    state.floors.push({});
    const res = openShop(state, 0, 'resto', fixed(0));
    expect(res.ok).toBe(true);
    expect(['cafe', 'sandwich']).toContain(state.floors[0].shop!.defId);
    expect(openShop(state, 0, 'resto').ok).toBe(false);
  });

  it('only offers country shops once discovered', () => {
    expect(shopPool(state).some((d) => d.id === 'disquaire')).toBe(false);
    state.discovered.push('melodia');
    expect(shopPool(state).some((d) => d.id === 'disquaire')).toBe(true);
    expect(shopPool(state).some((d) => d.id === 'karaoke')).toBe(false); // rare needs research
    expect(shopPool(state).some((d) => d.fusionOnly)).toBe(false);
  });

  it('rerolls once, for Miles', () => {
    state.floors.push({});
    openShop(state, 0, 'resto', fixed(0));
    const first = state.floors[0].shop!.defId;
    expect(rerollShop(state, 0, 'miles', fixed(0)).ok).toBe(true);
    expect(state.floors[0].shop!.defId).not.toBe(first);
    expect(state.miles).toBe(5);
    expect(rerollShop(state, 0, 'ad').ok).toBe(false);
  });

  it('sells until the stock runs out, even offline', () => {
    const i = builtFloorWithShop();
    expect(restock(state, i, 0, T0).ok).toBe(true);
    const rate = shopRate(state, i);
    expect(rate).toBe(1);
    tick(state, T0 + 10 * S); // still restocking
    expect(state.coins).toBe(300);
    tick(state, T0 + 20 * S + 60 * S); // restocked, sold for 60 s
    expect(state.coins).toBeCloseTo(360);
    const offline = tick(state, T0 + 10 * 3600 * S); // hours later: stock empty
    expect(state.coins).toBeCloseTo(300 + RESTOCK_TIERS[0].durationSec);
    expect(offline.coins).toBeCloseTo(120);
    expect(state.floors[i].shop!.stock).toBe(0);
    expect(doubleOffline(state, offline).ok).toBe(true);
    expect(doubleOffline(state, offline).ok).toBe(false);
    expect(state.coins).toBeCloseTo(300 + 180 + 120);
  });

  it('refuses restocking a shop that still has stock, and restocks instantly with an ad', () => {
    const i = builtFloorWithShop();
    expect(restockExpress(state, i, 1, T0).ok).toBe(true);
    expect(state.floors[i].shop!.stock).toBeCloseTo(RESTOCK_TIERS[1].durationSec);
    expect(restock(state, i, 0, T0).ok).toBe(false);
  });

  it('upgrades a shop and boosts its income', () => {
    const i = builtFloorWithShop();
    expect(upgradeShop(state, i).ok).toBe(true);
    expect(state.coins).toBe(240);
    expect(shopRate(state, i)).toBeCloseTo(1.25);
  });

  it('gives neighbouring rooms of the same element +10 % on the land', () => {
    const c = builtFloorWithShop('cafe');
    const a = builtFloorWithShop('disquaire');
    const b = builtFloorWithShop('karaoke');
    ensureCity(state); // a and b end up side by side, c alone
    const bonus = floorBonus(state, a)!;
    expect(bonus.neighbours).toBe(1);
    const base = shopRate(state, a) / bonus.multiplier;
    expect(bonus.multiplier).toBeCloseTo(1.1 * (bonus.nearGate ? 1.15 : 1) * (1 + Math.min(0.3, 0.03 * bonus.beauty)));
    // Swapping floors keeps every shop where it stands on the land.
    expect(swapFloors(state, b, c).ok).toBe(true);
    expect(floorBonus(state, a)!.multiplier).toBeCloseTo(bonus.multiplier);
    expect(shopRate(state, a)).toBeCloseTo(base * bonus.multiplier);
    // Moved away from the network, cut off from the terminal, it sells nothing.
    const room = state.city!.items.find((p) => p.kind === 'salle' && p.floor === a)!;
    expect(cityPlace(state, { ...room, x: 12, z: 4 }).ok).toBe(true);
    expect(shopRate(state, a)).toBe(0);
  });

  it('fills the lounge up to its capacity', () => {
    builtFloorWithShop();
    tick(state, T0 + 10 * S);
    expect(state.lounge.passengers).toBeCloseTo(3.5);
    tick(state, T0 + 3600 * S);
    expect(state.lounge.passengers).toBe(30);
  });
});

describe('progression', () => {
  it('levels up the airport', () => {
    expect(addXp(state, 150)).toBe(1);
    expect(state.level).toBe(2);
    expect(state.xp).toBe(0);
  });
});

describe('planes', () => {
  it('upgrades stats', () => {
    const plane = state.planes[0];
    state.coins = 1e6;
    for (const stat of ['speed', 'capacity', 'range', 'comfort', 'reliability'] as const) {
      expect(upgradePlane(state, plane.uid, stat).ok).toBe(true);
    }
    expect(planeStats(state, plane)).toMatchObject({ speed: 324, capacity: 9, comfort: 2, reliability: 54 });
    expect(planeStats(state, plane).range).toBeCloseTo(880);
    plane.upgrades.speed = 10;
    expect(upgradePlane(state, plane.uid, 'speed').ok).toBe(false);
  });

  it('buys planes within level and hangar limits', () => {
    state.coins = 1e6;
    expect(buyPlane(state, 'libellule').ok).toBe(false); // level 3
    state.level = 3;
    expect(buyPlane(state, 'libellule', mulberry32(1)).ok).toBe(true);
    expect(state.planes).toHaveLength(2);
    expect(state.coins).toBe(1e6 - 5000);
    expect(buyPlane(state, 'libellule').ok).toBe(true); // hangar 3 at level 3
    expect(buyPlane(state, 'libellule').ok).toBe(false);
  });

  it('renames a plane', () => {
    const plane = state.planes[0];
    expect(renamePlane(state, plane.uid, '  Le   Pélican ').ok).toBe(true);
    expect(plane.name).toBe('Le Pélican');
    expect(renamePlane(state, plane.uid, '   ').ok).toBe(false);
    expect(renamePlane(state, plane.uid, 'x'.repeat(17)).ok).toBe(false);
    expect(renamePlane(state, 'nope', 'A').ok).toBe(false);
  });
});

describe('crew', () => {
  it('recruits with coins and a free ad every 4 h', () => {
    state.coins = 1000;
    expect(recruit(state, 'coins', T0, mulberry32(3)).ok).toBe(true);
    expect(state.coins).toBe(500);
    expect(recruit(state, 'ad', T0).ok).toBe(true);
    expect(recruit(state, 'ad', T0 + 3600 * S).ok).toBe(false);
    expect(recruit(state, 'miles', T0).ok).toBe(false);
    expect(state.crew).toHaveLength(2);
  });

  it('levels up crew and their seat boosts the plane', () => {
    const pilot: CrewMember = {
      uid: 'c1', name: 'Jean Bon', role: 'pilot', rarity: 'C', element: 'melodia', traits: [], level: 1, xp: 0,
    };
    state.crew.push(pilot);
    expect(assignCrew(state, 'c1', state.planes[0].uid).ok).toBe(true);
    const before = planeStats(state, state.planes[0]).speed;
    expect(addCrewXp(pilot, 10_000)).toBeGreaterThan(0);
    expect(pilot.level).toBe(10); // capped for commons
    expect(planeStats(state, state.planes[0]).speed).toBeGreaterThan(before);
  });
});

describe('flights', () => {
  beforeEach(() => {
    state.lounge.passengers = 20;
  });

  it('flies, lands and pays tickets', () => {
    const plane = state.planes[0];
    expect(sendFlight(state, plane.uid, dest(), T0).ok).toBe(true);
    expect(state.lounge.passengers).toBe(12);
    expect(collectFlight(state, plane.uid, T0 + 10 * S).ok).toBe(false);
    expect(tick(state, T0 + 150 * S).flightsLanded).toBe(1);
    const coinsBefore = state.coins;
    const res = collectFlight(state, plane.uid, T0 + 150 * S, fixed(0.99)); // no event
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // (5 + 0.05 × 300) × 8 × 1.04
    expect(res.value.coins).toBe(166);
    expect(state.coins).toBeCloseTo(coinsBefore + 166);
    expect(state.resources.melodia).toBe(9);
    expect(state.discovered).toContain('melodia');
    expect(plane.flight).toBeUndefined();
  });

  it('refuses destinations out of range or not yet unlocked', () => {
    const plane = state.planes[0];
    expect(sendFlight(state, plane.uid, dest({ distance: 900 }), T0).ok).toBe(false);
    expect(sendFlight(state, plane.uid, dest({ countryId: 'bitopia', distance: 500 }), T0).ok).toBe(false);
  });

  it('resolves a choice event and credits the report afterwards', () => {
    const plane = state.planes[0];
    sendFlight(state, plane.uid, dest({ modifier: 'mystere' }), T0); // rare events only
    // Rolls: report id, then the event pick → « Porte des étoiles ».
    const res = collectFlight(state, plane.uid, T0 + 150 * S, seq(0.5, 0));
    if (!res.ok) throw new Error(res.error);
    const report = res.value;
    expect(report.event?.defId).toBe('g_portal');
    expect(report.pending).toBe(true);
    const coins = state.coins;
    expect(resolveEvent(state, report.id, 1, fixed(0.99)).ok).toBe(true);
    expect(report.pending).toBe(false);
    expect(report.event!.success).toBe(true);
    expect(report.resource).toBe(14); // 9 × 1.5
    expect(state.coins).toBeGreaterThan(coins);
    expect(resolveEvent(state, report.id, 0).ok).toBe(false);
  });

  it('can damage a plane, which then needs a repair', () => {
    const plane = state.planes[0];
    sendFlight(state, plane.uid, dest(), T0);
    // Rolls: report id, event happens, pick « Collision avec un oiseau » (2.5 / 18), avoid roll fails.
    const res = collectFlight(state, plane.uid, T0 + 150 * S, seq(0.5, 0, 2.5 / 18, 0.999));
    if (!res.ok) throw new Error(res.error);
    expect(res.value.event).toMatchObject({ defId: 'g_bird', outcome: { damage: true } });
    expect(plane.damaged).toBe(true);
    expect(sendFlight(state, plane.uid, dest(), T0 + 200 * S).ok).toBe(false);
    expect(repairPlane(state, plane.uid, 'coins', T0 + 200 * S).ok).toBe(true);
    tick(state, T0 + 200 * S + 600 * S);
    expect(plane.damaged).toBe(false);
  });

  it('repairs instantly with an ad', () => {
    state.planes[0].damaged = true;
    expect(repairPlane(state, state.planes[0].uid, 'ad', T0).ok).toBe(true);
    expect(state.planes[0].damaged).toBe(false);
  });

  it('serves country VIPs and fills the carnet', () => {
    const plane = state.planes[0];
    state.vips.push({ uid: 'v1', defId: 'rockeur', expiresAt: T0 + 30 * 60 * S, demand: { countryId: 'melodia', minComfort: 1 } });
    state.vips.push({ uid: 'v2', defId: 'diva', expiresAt: T0 + 30 * 60 * S, demand: { countryId: 'melodia', minComfort: 9 } });
    sendFlight(state, plane.uid, dest(), T0, ['v1', 'v2']);
    tick(state, T0 + 150 * S);
    const res = collectFlight(state, plane.uid, T0 + 150 * S, fixed(0.99));
    if (!res.ok) throw new Error(res.error);
    expect(res.value.vips.map((v) => v.satisfied)).toEqual([true, false]);
    expect(res.value.vipCoins).toBe(500);
    expect(state.carnet).toEqual({ rockeur: 1 });
    expect(state.vips).toHaveLength(0);
  });
});

describe('destinations', () => {
  it('are deterministic per 4 h window and stay in the ring band', () => {
    const a = destinationsFor(42, 'melodia', T0);
    expect(a).toHaveLength(3);
    expect(destinationsFor(42, 'melodia', T0 + 1000)).toEqual(a);
    for (const d of a) {
      expect(d.distance).toBeGreaterThanOrEqual(250);
      expect(d.distance).toBeLessThanOrEqual(700);
    }
    expect(new Set(a.map((d) => d.name)).size).toBe(3);
    expect(destinationsFor(42, 'melodia', T0 + 4 * 3600 * S)).not.toEqual(a);
  });
});

describe('research', () => {
  it('requires discovery and the previous tech, then completes over time', () => {
    state.coins = 1e6;
    state.resources.melodia = 1000;
    expect(startResearch(state, 'melodia_0', T0).ok).toBe(false);
    state.discovered.push('melodia');
    expect(startResearch(state, 'melodia_1', T0).ok).toBe(false);
    expect(startResearch(state, 'melodia_0', T0).ok).toBe(true);
    tick(state, T0 + 60 * S);
    expect(state.research).toEqual(['melodia_0']);
    expect(shopPool(state).some((d) => d.id === 'karaoke')).toBe(true);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { MISSIONS } from '../src/core/data/missions';
import { SHOP_BY_ID } from '../src/core/data/shops';
import { tick } from '../src/core/engine';
import { fusionResults, placePlan, planAsStar, startFusion } from '../src/core/fusion';
import { claimMission, currentMission, update } from '../src/core/game';
import { deserialize, load, save, serialize } from '../src/core/save';
import { createInitialState } from '../src/core/state';
import { countryVipDemand, guidePassenger, spawnVisitors, useVip } from '../src/core/visitors';
import type { GameState } from '../src/core/types';

const T0 = 1_800_000_000_000;
const S = 1000;
const fixed = (v: number) => () => v;

let state: GameState;
beforeEach(() => {
  state = createInitialState(T0, 42);
});

const withShop = (defId: string) => {
  state.floors.push({ shop: { defId, level: 1, stars: 1, stock: 0 } });
  return state.floors.length - 1;
};

describe('fusion', () => {
  it('can give double-element shops only from both parents', () => {
    const ids = fusionResults(SHOP_BY_ID.disquaire, SHOP_BY_ID.smoothie).map((d) => d.id);
    expect(ids).toContain('beachparty');
    expect(ids).toContain('karaoke');
    expect(ids).not.toContain('jazz');
    expect(ids).not.toContain('cafe');
  });

  it('runs over time and gives a blueprint to place or use as a star', () => {
    const a = withShop('disquaire');
    const b = withShop('smoothie');
    state.coins = 10_000;
    expect(startFusion(state, a, b, T0).ok).toBe(false); // level 3 needed
    state.level = 3;
    const res = startFusion(state, a, b, T0, fixed(0));
    expect(res.ok).toBe(true);
    expect(state.coins).toBe(10_000 - 600);
    tick(state, T0 + 240 * S);
    expect(state.plans).toHaveLength(1);
    expect(state.stats.fusions).toBe(1);

    state.plans = ['disquaire', 'karaoke'];
    expect(planAsStar(state, 0, a).ok).toBe(true);
    expect(state.floors[a].shop!.stars).toBe(2);
    state.floors.push({});
    expect(placePlan(state, 0, state.floors.length - 1).ok).toBe(true);
    expect(state.floors.at(-1)!.shop!.defId).toBe('karaoke');
    expect(state.plans).toHaveLength(0);
  });
});

describe('visitors', () => {
  it('spawns VIPs from shops, capped offline', () => {
    withShop('cafe');
    withShop('disquaire');
    spawnVisitors(state, T0 + 3600 * S, fixed(0));
    expect(state.vips.length).toBe(4);
    expect(state.vips.some((v) => v.demand?.countryId === 'melodia')).toBe(true);
    expect(state.timers.vipCheck).toBe(T0 + 3600 * S);
  });

  it('asks for the country module once researched', () => {
    expect(countryVipDemand(state, 'melodia')).toEqual({ countryId: 'melodia', minComfort: 4, moduleId: undefined });
    state.research.push('melodia_0', 'melodia_1');
    expect(countryVipDemand(state, 'melodia')?.moduleId).toBe('dancefloor');
  });

  it('uses power VIPs', () => {
    state.vips.push({ uid: 'v', defId: 'millionnaire', expiresAt: T0 + 60 * S });
    expect(useVip(state, 'v', T0).ok).toBe(true);
    expect(state.miles).toBe(15);
    expect(state.vips).toHaveLength(0);

    const i = withShop('cafe');
    state.vips.push({ uid: 'l', defId: 'livreur', expiresAt: T0 + 60 * S });
    expect(useVip(state, 'l', T0).ok).toBe(true);
    expect(state.floors[i].shop!.stock).toBeCloseTo(180);

    state.vips.push({ uid: 'i', defId: 'influenceuse', expiresAt: T0 + 60 * S });
    useVip(state, 'i', T0);
    tick(state, T0 + 10 * S);
    expect(state.lounge.passengers).toBeCloseTo(2 * 0.35 * 10);
  });

  it('pays a tip for guiding a passenger to the right floor', () => {
    withShop('cafe');
    withShop('kiosque');
    state.guide = { floor: 2, expiresAt: T0 + 60 * S };
    expect(guidePassenger(state, 2, T0, fixed(0.99))).toEqual({ ok: true, value: { coins: 10, miles: 0 } });
    expect(guidePassenger(state, 2, T0).ok).toBe(false);
  });

  it('runs through update()', () => {
    withShop('cafe');
    update(state, T0 + 61 * S, fixed(0));
    expect(state.vips.length).toBeGreaterThan(0);
    expect(state.guide).toBeDefined();
  });
});

describe('missions', () => {
  it('advance in order and pay Miles', () => {
    expect(currentMission(state)?.def.id).toBe(MISSIONS[0].id);
    expect(claimMission(state).ok).toBe(false);
    state.stats.floorsBuilt = 1;
    expect(claimMission(state).ok).toBe(true);
    expect(state.miles).toBe(12);
    expect(state.coins).toBe(400);
    expect(currentMission(state)?.def.id).toBe('shop');
  });
});

describe('save', () => {
  it('round-trips and fills missing fields', () => {
    state.coins = 1234;
    const copy = deserialize(serialize(state), T0);
    expect(copy).toEqual(state);

    const old = JSON.parse(serialize(state));
    delete old.stats.fusions;
    delete old.timers;
    const migrated = deserialize(JSON.stringify(old), T0)!;
    expect(migrated.stats.fusions).toBe(0);
    expect(migrated.timers.vipCheck).toBe(T0);
  });

  it('rejects broken or future saves', () => {
    expect(deserialize('nope', T0)).toBeNull();
    expect(deserialize(JSON.stringify({ ...state, version: 99 }), T0)).toBeNull();
  });

  it('uses the given storage', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(load(T0, storage)).toBeNull();
    save(state, storage);
    expect(load(T0, storage)?.seed).toBe(42);
  });
});

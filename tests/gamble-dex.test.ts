import { beforeEach, describe, expect, it } from 'vitest';
import { SHOP_BY_ID } from '../src/core/data/shops';
import { claimDexReward, dexClaimable, dexView } from '../src/core/dex';
import { openShop } from '../src/core/engine';
import { franchise } from '../src/core/prestige';
import {
  BOXES,
  PITY_BOXES,
  bronzeBoxCoins,
  boxOdds,
  openBox,
  rarityBet,
  rarityBetView,
} from '../src/core/gamble';
import { deserialize, serialize } from '../src/core/save';
import { createInitialState } from '../src/core/state';
import type { GameState } from '../src/core/types';

const T0 = 1_800_000_000_000;
const fixed = (v: number) => () => v;

let state: GameState;
beforeEach(() => {
  state = createInitialState(T0, 42);
});

describe('plan boxes', () => {
  it('shows odds that add up to 100 % and only lists reachable shops', () => {
    for (const box of BOXES) {
      const odds = boxOdds(state, box.id);
      expect(odds.reduce((s, o) => s + o.chance, 0)).toBeCloseTo(1);
      for (const o of odds) for (const d of o.shops) expect(d.elements).toEqual(['neutre']);
    }
    // No neutral legendary: the gold box falls back on epics until a country is discovered.
    expect(boxOdds(state, 'or').map((o) => o.rarity)).toEqual(['E']);
    state.discovered.push('infernia');
    expect(boxOdds(state, 'or').find((o) => o.rarity === 'L')?.shops.map((d) => d.id)).toEqual(['casino']);
  });

  it('charges the box, gives a plan and records the album', () => {
    state.coins = bronzeBoxCoins(1);
    const res = openBox(state, 'bronze', 'coins', T0, fixed(0));
    if (!res.ok) throw new Error(res.error);
    expect(state.coins).toBe(0);
    expect(state.plans).toEqual([res.value.defId]);
    expect(state.album).toContain(res.value.defId);
    expect(openBox(state, 'bronze', 'coins', T0).ok).toBe(false);
    expect(openBox(state, 'or', 'coins', T0).ok).toBe(false);
    expect(openBox(state, 'or', 'miles', T0).ok).toBe(false); // 10 Miles < 40
  });

  it('gives one free bronze box per ad every 6 h', () => {
    expect(openBox(state, 'bronze', 'ad', T0).ok).toBe(true);
    expect(openBox(state, 'bronze', 'ad', T0 + 1000).ok).toBe(false);
    expect(openBox(state, 'argent', 'ad', T0).ok).toBe(false);
    expect(openBox(state, 'bronze', 'ad', T0 + 6 * 3600 * 1000).ok).toBe(true);
  });

  it('guarantees a legendary after the pity count', () => {
    state.discovered.push('gourmandie');
    state.miles = 1e6;
    let legendary = -1;
    for (let i = 1; i <= PITY_BOXES; i++) {
      const res = openBox(state, 'argent', 'miles', T0, fixed(0)); // rng 0 → always the lowest rarity
      if (res.ok && res.value.rarity === 'L') {
        legendary = i;
        expect(res.value.pity).toBe(true);
      }
    }
    expect(legendary).toBe(PITY_BOXES);
    expect(state.gamble.pity).toBe(0);
    expect(state.stats.boxesOpened).toBe(PITY_BOXES);
  });
});

describe('rarity bet', () => {
  beforeEach(() => {
    state.floors.push({});
    openShop(state, 0, 'loisir', fixed(0)); // arcade (C)
  });

  it('climbs one rarity in the same category on a win', () => {
    const view = rarityBetView(state, 0)!;
    expect(view).toMatchObject({ from: 'C', to: 'R', chance: 0.4, riskyChance: undefined });
    state.coins = view.cost;
    const res = rarityBet(state, 0, 'sure', fixed(0));
    expect(res).toMatchObject({ ok: true, value: { won: true, from: 'C', to: 'R' } });
    const def = SHOP_BY_ID[state.floors[0].shop!.defId];
    expect(def).toMatchObject({ rarity: 'R', category: 'loisir' });
    expect(state.coins).toBe(0);
  });

  it('keeps the shop on a lost safe bet and drops one rarity on a lost risky bet', () => {
    state.coins = 1e6;
    rarityBet(state, 0, 'sure', fixed(0)); // → cinema (R)
    expect(rarityBet(state, 0, 'risquee', fixed(0.99)).ok).toBe(false); // no epic leisure shop yet
    state.discovered.push('bitopia'); // VR room (E)
    const lost = rarityBet(state, 0, 'sure', fixed(0.99));
    expect(lost).toMatchObject({ ok: true, value: { won: false, to: 'R' } });
    const risky = rarityBetView(state, 0)!;
    expect(risky.riskyChance).toBeCloseTo(0.375);
    const dropped = rarityBet(state, 0, 'risquee', fixed(0.99));
    expect(dropped).toMatchObject({ ok: true, value: { won: false, to: 'C' } });
    expect(SHOP_BY_ID[state.floors[0].shop!.defId].rarity).toBe('C');
  });

  it('is refused once the shop is in business', () => {
    state.floors[0].shop!.stock = 10;
    expect(rarityBetView(state, 0)).toBeUndefined();
    expect(rarityBet(state, 0, 'risquee').ok).toBe(false);
  });
});

describe('dex', () => {
  it('lists every collection with seen entries and completion rewards', () => {
    const view = dexView(state);
    expect(view.map((s) => s.id)).toEqual(['shops', 'vips', 'planes', 'countries', 'events']);
    const planes = view.find((s) => s.id === 'planes')!;
    expect(planes.found).toBe(1); // the starting Coucou
    expect(planes.milestones[0].reached).toBe(false); // 1/5 = 20 % < 25 %
  });

  it('pays each milestone once', () => {
    state.discovered.push('melodia', 'tropicalia'); // 3/8 countries
    expect(dexClaimable(state)).toBeGreaterThan(0);
    const miles = state.miles;
    expect(claimDexReward(state, 'countries', 0)).toEqual({ ok: true, value: 5 });
    expect(claimDexReward(state, 'countries', 0).ok).toBe(false);
    expect(claimDexReward(state, 'countries', 1).ok).toBe(false);
    expect(state.miles).toBe(miles + 5);
  });

  it('remembers VIPs, planes and events across a franchise and old saves', () => {
    state.vips.push({ uid: 'v', defId: 'promoteur', expiresAt: T0 + 1000 });
    state.dex.events.push('e_test');
    const vips = dexView(state).find((s) => s.id === 'vips')!;
    expect(vips.entries.find((e) => e.id === 'promoteur')?.seen).toBe(true);
    state.level = 12;
    state.stats.totalCoins = 4e6;
    const next = franchise(state, T0);
    if (!next.ok) throw new Error(next.error);
    expect(next.value.dex.vips).toContain('promoteur');
    const old = JSON.parse(serialize(state));
    delete old.dex;
    delete old.gamble;
    const loaded = deserialize(JSON.stringify(old), T0)!;
    expect(loaded.gamble.pity).toBe(0);
    expect(dexView(loaded).find((s) => s.id === 'planes')!.found).toBe(1);
  });
});

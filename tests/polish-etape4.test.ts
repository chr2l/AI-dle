import { describe, expect, it } from 'vitest';
import { BOOST_HOURS, PASS_ID, adBoost, adsLeftToday, buildFloor, createInitialState, finishBuild, grantPack, openShop, restock, shopPacks, shopRate, tick } from '../src/core';
import { CATEGORY_IDS } from '../src/core/data/shops';

const H = 3600_000;

describe('boutique', () => {
  it('le boost double les ventes, y compris hors ligne, puis s’arrête', () => {
    const now = 10 * H;
    const run = (boost: boolean) => {
      const s = createInitialState(now);
      s.coins = 1e6;
      buildFloor(s, now);
      finishBuild(s, now);
      openShop(s, 0, CATEGORY_IDS[0], () => 0.5);
      restock(s, 0, 2, now);
      s.floors[0].shop!.restock!.endsAt = now;
      if (boost) adBoost(s, now);
      s.lastTick = now;
      return tick(s, now + 2 * H).coins;
    };
    expect(run(true)).toBeCloseTo(run(false) * 2, 3);
  });

  it('se cumule jusqu’à 12 h', () => {
    const s = createInitialState(0);
    expect(adBoost(s, 0).ok).toBe(true);
    expect(adBoost(s, 0).ok).toBe(true);
    expect(adBoost(s, 0).ok).toBe(true);
    expect(s.boosts.coinsX2Until).toBe(3 * BOOST_HOURS * H);
    expect(adBoost(s, 0).ok).toBe(false);
  });

  it('le Pass donne +10 % et lève la limite de pubs', () => {
    const s = createInitialState(0);
    s.coins = 1e6;
    buildFloor(s, 0);
    finishBuild(s, 0);
    openShop(s, 0, CATEGORY_IDS[0], () => 0.5);
    const before = shopRate(s, 0);
    expect(grantPack(s, PASS_ID).ok).toBe(true);
    expect(shopRate(s, 0)).toBeCloseTo(before * 1.1);
    expect(adsLeftToday(s, 0)).toBe(Infinity);
    expect(grantPack(s, PASS_ID).ok).toBe(false);
    expect(shopPacks(s).some((p) => p.id === PASS_ID)).toBe(false);
  });

  it('le pack de départ attend le niveau 5', () => {
    const s = createInitialState(0);
    expect(shopPacks(s).some((p) => p.id === 'starter')).toBe(false);
    s.level = 5;
    expect(shopPacks(s).some((p) => p.id === 'starter')).toBe(true);
    const miles = s.miles;
    grantPack(s, 'starter');
    expect(s.miles).toBe(miles + 100);
    expect(shopPacks(s).some((p) => p.id === 'starter')).toBe(false);
  });
});

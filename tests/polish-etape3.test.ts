import { describe, expect, it } from 'vitest';
import { COLLECT_ALL_LEVEL, RESTOCK_ALL_LEVEL, buildFloor, collectAll, createInitialState, emptyFloors, finishBuild, openShop, restockAll } from '../src/core';
import { CATEGORY_IDS } from '../src/core/data/shops';
import { THEMES } from '../src/ui/music';
import { COUNTRIES } from '../src/core/data/countries';

const withShops = (n: number, now: number) => {
  const s = createInitialState(now);
  s.coins = 1e9;
  s.level = 10;
  for (let i = 0; i < n; i++) {
    buildFloor(s, now);
    finishBuild(s, now);
    openShop(s, i, CATEGORY_IDS[0], () => 0.5);
  }
  return s;
};

describe('confort du milieu de partie', () => {
  it('réapprovisionne tous les rayons vides d’un coup', () => {
    const now = 1_000_000;
    const s = withShops(3, now);
    expect(emptyFloors(s)).toEqual([0, 1, 2]);
    const res = restockAll(s, 1, now);
    expect(res.ok && res.value).toBe(3);
    expect(s.floors.every((f) => f.shop?.restock?.tier === 1)).toBe(true);
    expect(restockAll(s, 1, now).ok).toBe(false);
  });

  it('se débloque avec le niveau', () => {
    const now = 1_000_000;
    const s = withShops(2, now);
    s.level = RESTOCK_ALL_LEVEL - 1;
    expect(restockAll(s, 0, now).ok).toBe(false);
    s.level = COLLECT_ALL_LEVEL - 1;
    expect(collectAll(s, now).ok).toBe(false);
  });

  it('récupère tous les avions rentrés', () => {
    const now = 1_000_000;
    const s = withShops(0, now);
    expect(collectAll(s, now).ok).toBe(false);
  });
});

describe('musique', () => {
  it('a une ambiance pour chaque pays', () => {
    for (const c of COUNTRIES) expect(THEMES[c.id]).toBeDefined();
  });
});

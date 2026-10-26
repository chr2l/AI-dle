import { beforeEach, describe, expect, it } from 'vitest';
import { COUNTRIES } from '../src/core/data/countries';
import { SHOPS } from '../src/core/data/shops';
import { featuredCountry, featuredMult } from '../src/core/destinations';
import { openShop, tick } from '../src/core/engine';
import { DAY_MS, WEEK_MS } from '../src/core/formulas';
import { canFranchise, franchise, pendingStars } from '../src/core/prestige';
import {
  achievementViews,
  claimAchievement,
  claimDaily,
  claimQuest,
  claimQuestChest,
  dailyStatus,
  plannedNotifications,
  questViews,
} from '../src/core/retention';
import { deserialize, serialize } from '../src/core/save';
import { createInitialState } from '../src/core/state';
import { albumBonus, prestigeMult, shopRate } from '../src/core/stats';
import type { GameState } from '../src/core/types';

const T0 = 1_800_000_000_000;
const fixed = (v: number) => () => v;

let state: GameState;
beforeEach(() => {
  state = createInitialState(T0, 42);
});

describe('daily reward', () => {
  it('follows a 7-day streak that resets after a missed day', () => {
    expect(claimDaily(state, T0).ok).toBe(true);
    expect(state.coins).toBe(600); // 300 × level 1
    expect(claimDaily(state, T0 + 1000).ok).toBe(false);
    expect(dailyStatus(state, T0 + DAY_MS).streak).toBe(2);
    claimDaily(state, T0 + DAY_MS);
    expect(state.miles).toBe(13);
    expect(dailyStatus(state, T0 + 3 * DAY_MS)).toMatchObject({ available: true, streak: 1 });
  });

  it('gives a premium recruit on day 7', () => {
    for (let d = 0; d < 7; d++) claimDaily(state, T0 + d * DAY_MS, fixed(0.5));
    expect(state.daily.streak).toBe(7);
    expect(state.crew.some((c) => c.rarity !== 'C')).toBe(true);
  });
});

describe('daily quests', () => {
  it('rolls 3 quests a day, counts progress from the roll and pays a chest', () => {
    const quests = questViews(state, T0);
    expect(quests).toHaveLength(3);
    expect(questViews(state, T0 + 1000).map((q) => q.def.id)).toEqual(quests.map((q) => q.def.id));
    for (const q of quests) (state.stats[q.def.stat] as number) += q.goal;
    const miles = state.miles;
    for (let i = 0; i < 3; i++) expect(claimQuest(state, i, T0).ok).toBe(true);
    expect(claimQuest(state, 0, T0).ok).toBe(false);
    expect(claimQuestChest(state, T0).ok).toBe(true);
    expect(state.miles).toBe(miles + 3 * 3 + 5);
    expect(questViews(state, T0 + DAY_MS).every((q) => q.progress === 0)).toBe(true);
  });

  it('only offers quests the player can do', () => {
    for (let d = 0; d < 30; d++) {
      const ids = questViews(state, T0 + d * DAY_MS).map((q) => q.def.id);
      expect(ids).not.toContain('q_fusion');
    }
  });
});

describe('achievements', () => {
  it('are claimed once each', () => {
    state.discovered.push('melodia', 'tropicalia');
    expect(claimAchievement(state, 'countries_1')).toEqual({ ok: true, value: 3 });
    expect(claimAchievement(state, 'countries_1').ok).toBe(false);
    expect(claimAchievement(state, 'countries_2').ok).toBe(false);
    expect(achievementViews(state).length).toBeGreaterThan(30);
  });
});

describe('album', () => {
  it('records opened shops and rewards complete sets', () => {
    state.floors.push({});
    openShop(state, 0, 'resto', fixed(0));
    expect(state.album).toHaveLength(1);
    expect(albumBonus(state)).toBe(0);
    state.album = SHOPS.filter((d) => d.elements.includes('melodia') && !d.fusionOnly).map((d) => d.id);
    expect(albumBonus(state)).toBeCloseTo(0.03);
  });
});

describe('featured country', () => {
  it('changes every week and cycles through all countries', () => {
    const seen = new Set(Array.from({ length: 8 }, (_, w) => featuredCountry(T0 + w * WEEK_MS)));
    expect(seen.size).toBe(COUNTRIES.length);
    const c = featuredCountry(T0);
    expect(featuredMult(c, T0).resource).toBe(2);
    expect(featuredMult(COUNTRIES.find((x) => x.id !== c)!.id, T0).resource).toBe(1);
  });
});

describe('franchise', () => {
  it('needs level 12 and a new star, then restarts while keeping the long-term progress', () => {
    expect(canFranchise(state).ok).toBe(false);
    state.level = 12;
    state.stats.totalCoins = 30e6; // √30 → 5 stars
    state.miles = 99;
    state.carnet = { rockeur: 2 };
    state.album = ['cafe'];
    state.crew.push(
      { uid: 'l', name: 'L', role: 'pilot', rarity: 'L', element: 'neutre', traits: [], level: 12, xp: 0, planeUid: 'plane_1' },
      { uid: 'c', name: 'C', role: 'cabin', rarity: 'C', element: 'neutre', traits: [], level: 3, xp: 0 },
    );
    expect(pendingStars(state)).toBe(5);
    const res = franchise(state, T0);
    if (!res.ok) throw new Error(res.error);
    const next = res.value;
    expect(next.level).toBe(1);
    expect(next.coins).toBe(300);
    expect(next.floors).toHaveLength(0);
    expect(next.prestige).toMatchObject({ stars: 5, count: 1 });
    expect(next.miles).toBe(99);
    expect(next.crew.map((c) => c.uid)).toEqual(['l']);
    expect(next.crew[0].planeUid).toBeUndefined();
    expect(next.carnet).toEqual({ rockeur: 2 });
    expect(next.album).toEqual(['cafe']);
    expect(pendingStars(next)).toBe(0);
    expect(prestigeMult(next)).toBeCloseTo(1.25);
    next.floors.push({ shop: { defId: 'cafe', level: 1, stars: 1, stock: 0 } });
    expect(shopRate(next, 0)).toBeCloseTo(1.01 * 1.25); // Carnet +1 % kept, 5 stars
  });
});

describe('notifications and save', () => {
  it('plans notifications for the next events', () => {
    state.floors.push({ shop: { defId: 'cafe', level: 1, stars: 1, stock: 60 } });
    claimDaily(state, T0);
    const notes = plannedNotifications(state, T0);
    expect(notes.map((n) => n.id)).toEqual(['stock', 'daily']);
    expect(notes[0].at).toBe(T0 + 60_000);
  });

  it('fills the new fields when loading an older save', () => {
    const old = JSON.parse(serialize(state));
    delete old.prestige;
    delete old.album;
    delete old.daily;
    const loaded = deserialize(JSON.stringify(old), T0)!;
    expect(loaded.prestige.stars).toBe(0);
    expect(loaded.album).toEqual([]);
    tick(loaded, T0 + 1000);
  });
});

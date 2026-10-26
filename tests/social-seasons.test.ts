import { beforeEach, describe, expect, it } from 'vitest';
import { activeSeason, addSeasonPoints, nextSeason, seasonFlightPoints, syncSeason } from '../src/core/calendar';
import { SEASONS, SEASON_TRACK } from '../src/core/data/seasons';
import { SHOPS, SHOP_BY_ID } from '../src/core/data/shops';
import { DAY_MS, WEEK_MS, weekIndex } from '../src/core/formulas';
import { franchise } from '../src/core/prestige';
import { questViews } from '../src/core/retention';
import { deserialize, serialize } from '../src/core/save';
import { claimSeasonReward, seasonView } from '../src/core/seasons';
import {
  MemorySocialBackend,
  addFriend,
  claimWeeklyReward,
  friendsLeaderboard,
  openGifts,
  publicProfile,
  removeFriend,
  sendGift,
  visitFriend,
} from '../src/core/social';
import { createInitialState, playerCode } from '../src/core/state';
import type { GameState } from '../src/core/types';

const HALLOWEEN = Date.UTC(2026, 9, 26, 12); // 26 Oct 2026
const NEW_YEAR = Date.UTC(2027, 0, 2, 12); // still Noël 2026
const QUIET = Date.UTC(2026, 4, 10, 12); // 10 May: no season
const fixed = (v: number) => () => v;

describe('seasonal calendar', () => {
  it('finds the active season, including Noël over New Year', () => {
    expect(activeSeason(HALLOWEEN)?.def.id).toBe('halloween');
    expect(activeSeason(NEW_YEAR)).toMatchObject({ year: 2026 });
    expect(activeSeason(NEW_YEAR)?.def.id).toBe('noel');
    expect(activeSeason(QUIET)).toBeUndefined();
    expect(nextSeason(QUIET).def.id).toBe('fete_musique');
  });

  it('has a shop and an event for every season, kept out of the normal pool', () => {
    for (const s of SEASONS) {
      expect(SHOP_BY_ID[s.shopId]).toBeDefined();
      expect(SHOPS.some((d) => d.id === s.shopId)).toBe(false);
    }
  });

  it('gives flight points, doubled towards the theme country', () => {
    expect(seasonFlightPoints(HALLOWEEN, 2, 'infernia')).toBe(8);
    expect(seasonFlightPoints(HALLOWEEN, 2, 'melodia')).toBe(4);
    expect(seasonFlightPoints(QUIET, 2, 'infernia')).toBe(0);
  });
});

describe('seasonal track', () => {
  let state: GameState;
  beforeEach(() => {
    state = createInitialState(HALLOWEEN, 7);
  });

  it('claims each step once and resets with the next season', () => {
    addSeasonPoints(state, 1000, HALLOWEEN);
    expect(seasonView(state, HALLOWEEN)?.track.filter((t) => t.reached)).toHaveLength(5);
    const miles = state.miles;
    expect(claimSeasonReward(state, 0, HALLOWEEN).ok).toBe(true);
    expect(state.miles).toBe(miles + 5);
    expect(claimSeasonReward(state, 0, HALLOWEEN).ok).toBe(false);
    expect(claimSeasonReward(state, 5, HALLOWEEN).ok).toBe(false);
    expect(claimSeasonReward(state, 4, HALLOWEEN).ok).toBe(true);
    expect(state.plans).toContain('manoir');

    const cyber = Date.UTC(2026, 10, 22);
    expect(seasonView(state, cyber)).toMatchObject({ points: 0 });
    expect(state.season.claimed).toEqual([]);
  });

  it('keeps the trophy forever, even after a franchise', () => {
    addSeasonPoints(state, SEASON_TRACK.at(-1)!.points, HALLOWEEN);
    expect(claimSeasonReward(state, SEASON_TRACK.length - 1, HALLOWEEN).ok).toBe(true);
    expect(state.season.trophies).toEqual(['halloween-2026']);
    state.level = 12;
    state.stats.totalCoins = 4e6;
    const res = franchise(state, HALLOWEEN);
    if (!res.ok) throw new Error(res.error);
    expect(res.value.season.trophies).toEqual(['halloween-2026']);
  });

  it('ignores points outside a season', () => {
    addSeasonPoints(state, 100, QUIET);
    syncSeason(state, QUIET);
    expect(state.season).toMatchObject({ id: null, points: 0 });
  });
});

describe('social', () => {
  let me: GameState;
  let friend: GameState;
  const T = Date.UTC(2026, 9, 26, 10);
  beforeEach(() => {
    me = createInitialState(T, 1);
    friend = createInitialState(T, 2);
  });

  it('gives each player a stable, distinct friend code', () => {
    expect(me.social.code).toMatch(/^IP-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(playerCode(1)).toBe(me.social.code);
    expect(friend.social.code).not.toBe(me.social.code);
  });

  it('adds and removes friends, refusing self and duplicates', () => {
    expect(addFriend(me, publicProfile(me, T), T).ok).toBe(false);
    expect(addFriend(me, publicProfile(friend, T), T).ok).toBe(true);
    expect(addFriend(me, { ...publicProfile(friend, T), code: friend.social.code.toLowerCase() }, T).ok).toBe(false);
    expect(removeFriend(me, friend.social.code).ok).toBe(true);
    expect(me.social.friends).toHaveLength(0);
  });

  it('sends one gift per friend a day and opens at most 10 a day', async () => {
    const backend = new MemorySocialBackend();
    addFriend(friend, publicProfile(me, T), T);
    const gift = sendGift(friend, me.social.code, T);
    if (!gift.ok) throw new Error(gift.error);
    expect(sendGift(friend, me.social.code, T + 1000).ok).toBe(false);
    expect(sendGift(friend, me.social.code, T + DAY_MS).ok).toBe(true);
    await backend.deliverGift(gift.value);

    const many = [gift.value, ...Array.from({ length: 11 }, (_, i) => ({ ...gift.value, id: `g${i}` }))];
    const coins = me.coins;
    const res = openGifts(me, many, T);
    expect(res.opened).toHaveLength(10);
    expect(res.kept).toHaveLength(2);
    expect(me.coins).toBe(coins + 10 * 150);
    expect(openGifts(me, res.kept, T).opened).toHaveLength(0);
    expect(await backend.takeGifts(me.social.code)).toHaveLength(1);
    expect(friend.stats.giftsSent).toBe(2);
  });

  it('pays a tip once per friend a day when visiting', () => {
    addFriend(me, publicProfile(friend, T), T);
    const res = visitFriend(me, friend.social.code, T, fixed(0));
    expect(res).toEqual({ ok: true, value: { coins: 50, miles: 1 } });
    expect(visitFriend(me, friend.social.code, T + 1000).ok).toBe(false);
    expect(visitFriend(me, 'IP-NOPE-NOPE', T).ok).toBe(false);
    expect(me.stats.friendVisits).toBe(1);
  });

  it('ranks the week among friends and rewards the rank once', () => {
    me.stats.totalCoins += 5000;
    friend.stats.totalCoins += 9000;
    addFriend(me, publicProfile(friend, T), T);
    const board = friendsLeaderboard(me, T);
    expect(board.map((r) => r.me)).toEqual([false, true]);
    expect(board[0].score).toBe(9000);

    const nextWeek = T + WEEK_MS;
    expect(weekIndex(nextWeek)).toBe(weekIndex(T) + 1);
    const miles = me.miles;
    expect(claimWeeklyReward(me, nextWeek)).toEqual({ ok: true, value: 20 });
    expect(me.social.lastWeek).toMatchObject({ rank: 2, players: 2, score: 5000 });
    expect(me.miles).toBe(miles + 20);
    expect(claimWeeklyReward(me, nextWeek).ok).toBe(false);
    expect(friendsLeaderboard(me, nextWeek)[1].score).toBe(0); // stale profile
  });

  it('offers friend quests only once the player has friends', () => {
    for (let d = 0; d < 20; d++) {
      expect(questViews(me, T + d * DAY_MS).some((q) => q.def.needsFriends)).toBe(false);
    }
  });

  it('publishes profiles and a global weekly top through the backend', async () => {
    const backend = new MemorySocialBackend();
    friend.stats.totalCoins += 100;
    await backend.publish(publicProfile(me, T));
    await backend.publish(publicProfile(friend, T));
    expect((await backend.fetchProfiles([friend.social.code.toLowerCase()]))[0].name).toBe(friend.social.name);
    expect((await backend.topWeekly(weekIndex(T), 10)).map((p) => p.code)).toEqual([friend.social.code, me.social.code]);
  });

  it('survives a save round-trip and fills social fields of old saves', () => {
    addFriend(me, publicProfile(friend, T), T);
    expect(deserialize(serialize(me), T)!.social.friends).toHaveLength(1);
    const old = JSON.parse(serialize(me));
    delete old.social;
    delete old.season;
    const loaded = deserialize(JSON.stringify(old), T)!;
    expect(loaded.social.code).toBe(me.social.code);
    expect(loaded.season.trophies).toEqual([]);
  });
});

// Social (GDD §20): friends, gifts, visits and leaderboards.
// The engine stays offline-first: everything here works on profiles and gifts
// handed in by a SocialBackend (a real server later, MemorySocialBackend for now).
import { type Result } from './engine';
import { DAY_MS, weekIndex } from './formulas';
import { type Rng, uid } from './rng';
import type { Gift, GameState, PublicProfile } from './types';

const fail = (error: string): Result<never> => ({ ok: false, error });
const done: Result = { ok: true, value: undefined };

export const MAX_FRIENDS = 50;
export const MAX_GIFTS_RECEIVED_PER_DAY = 10;
export const giftCoins = (level: number) => 150 * level;
export const visitTip = (level: number) => 50 * level;
export const VISIT_MILE_CHANCE = 0.1;
/** Weekly friends leaderboard rewards by rank (1st, 2nd, 3rd, others). */
export const WEEKLY_RANK_MILES = [30, 20, 10, 5];

const dayIndex = (now: number) => Math.floor(now / DAY_MS);

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function setPlayerName(state: GameState, name: string): Result {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 20) return fail('Le nom doit faire entre 2 et 20 caractères.');
  state.social.name = clean;
  return done;
}

// --- Weekly score --------------------------------------------------------------

/**
 * Starts a new week when needed. Before resetting, ranks last week's score
 * among friends whose profile was published that same week.
 */
export function syncWeek(state: GameState, now: number) {
  const week = weekIndex(now);
  const w = state.social.week;
  if (w.index === week) return;
  if (w.index >= 0) {
    const score = state.stats.totalCoins - w.startCoins;
    const rivals = state.social.friends.filter((f) => f.profile.week === w.index).map((f) => f.profile.weeklyScore);
    const rank = 1 + rivals.filter((s) => s > score).length;
    state.social.lastWeek = { index: w.index, score, rank, players: rivals.length + 1, claimed: rivals.length === 0 };
  }
  state.social.week = { index: week, startCoins: state.stats.totalCoins };
}

export function weeklyScore(state: GameState, now: number): number {
  syncWeek(state, now);
  return Math.floor(state.stats.totalCoins - state.social.week.startCoins);
}

/** Reward for last week's rank among friends (only if there was at least one rival). */
export function claimWeeklyReward(state: GameState, now: number): Result<number> {
  syncWeek(state, now);
  const last = state.social.lastWeek;
  if (!last || last.claimed) return fail('Aucune récompense hebdomadaire à récupérer.');
  const miles = WEEKLY_RANK_MILES[Math.min(last.rank, WEEKLY_RANK_MILES.length) - 1];
  last.claimed = true;
  state.miles += miles;
  return { ok: true, value: miles };
}

// --- Profile -------------------------------------------------------------------

export function publicProfile(state: GameState, now: number): PublicProfile {
  return {
    code: state.social.code,
    name: state.social.name,
    level: state.level,
    stars: state.prestige.stars,
    weeklyScore: weeklyScore(state, now),
    week: weekIndex(now),
    totalCoins: Math.floor(state.stats.totalCoins),
    carnet: Object.keys(state.carnet).length,
    album: state.album.length,
    facadeColor: state.facadeColor,
    lobbyColor: state.lobbyColor,
    floors: state.floors
      .filter((f) => f.shop)
      .slice(0, 10)
      .map((f) => ({ defId: f.shop!.defId, level: f.shop!.level })),
    updatedAt: now,
  };
}

// --- Friends -------------------------------------------------------------------

export function addFriend(state: GameState, profile: PublicProfile, now: number): Result {
  const code = normalizeCode(profile.code);
  if (code === state.social.code) return fail('C’est votre propre code !');
  if (state.social.friends.some((f) => f.code === code)) return fail('Déjà dans vos amis.');
  if (state.social.friends.length >= MAX_FRIENDS) return fail(`${MAX_FRIENDS} amis au maximum.`);
  state.social.friends.push({ code, profile: { ...profile, code }, addedAt: now });
  return done;
}

export function removeFriend(state: GameState, code: string): Result {
  const before = state.social.friends.length;
  state.social.friends = state.social.friends.filter((f) => f.code !== normalizeCode(code));
  return state.social.friends.length < before ? done : fail('Ami introuvable.');
}

/** Replaces cached friend profiles with fresher ones from the backend. */
export function refreshFriends(state: GameState, profiles: PublicProfile[]) {
  for (const p of profiles) {
    const friend = state.social.friends.find((f) => f.code === normalizeCode(p.code));
    if (friend && p.updatedAt >= friend.profile.updatedAt) friend.profile = p;
  }
}

/** Friends + me, ranked by this week's score (stale profiles count 0). */
export function friendsLeaderboard(state: GameState, now: number): { code: string; name: string; score: number; me: boolean }[] {
  const week = weekIndex(now);
  const rows = [
    { code: state.social.code, name: state.social.name, score: weeklyScore(state, now), me: true },
    ...state.social.friends.map((f) => ({
      code: f.code,
      name: f.profile.name,
      score: f.profile.week === week ? f.profile.weeklyScore : 0,
      me: false,
    })),
  ];
  return rows.sort((a, b) => b.score - a.score);
}

// --- Gifts ---------------------------------------------------------------------

/** One gift per friend per day. Returns the gift for the backend to deliver. */
export function sendGift(state: GameState, code: string, now: number, rng: Rng = Math.random): Result<Gift> {
  const to = normalizeCode(code);
  if (!state.social.friends.some((f) => f.code === to)) return fail('Ce joueur n’est pas dans vos amis.');
  const day = dayIndex(now);
  if (state.social.gifts.day !== day) state.social.gifts = { day, sent: [], received: 0 };
  if (state.social.gifts.sent.includes(to)) return fail('Déjà envoyé aujourd’hui.');
  state.social.gifts.sent.push(to);
  state.stats.giftsSent++;
  return { ok: true, value: { id: uid('gift', rng), from: state.social.code, fromName: state.social.name, to, day } };
}

/** Opens received gifts: `150 × level` coins each, 10 a day at most (the rest stay for tomorrow). */
export function openGifts(state: GameState, gifts: Gift[], now: number): { opened: Gift[]; coins: number; kept: Gift[] } {
  const day = dayIndex(now);
  if (state.social.gifts.day !== day) state.social.gifts = { day, sent: [], received: 0 };
  const mine = gifts.filter((g) => g.to === state.social.code);
  const room = Math.max(0, MAX_GIFTS_RECEIVED_PER_DAY - state.social.gifts.received);
  const opened = mine.slice(0, room);
  const coins = opened.length * giftCoins(state.level);
  state.coins += coins;
  state.stats.totalCoins += coins;
  state.social.gifts.received += opened.length;
  return { opened, coins, kept: mine.slice(room) };
}

// --- Visits --------------------------------------------------------------------

/** Visiting a friend's airport leaves a tip once per friend per day. */
export function visitFriend(state: GameState, code: string, now: number, rng: Rng = Math.random): Result<{ coins: number; miles: number }> {
  const target = normalizeCode(code);
  if (!state.social.friends.some((f) => f.code === target)) return fail('Ce joueur n’est pas dans vos amis.');
  const day = dayIndex(now);
  if (state.social.visits.day !== day) state.social.visits = { day, codes: [] };
  if (state.social.visits.codes.includes(target)) return fail('Déjà visité aujourd’hui.');
  state.social.visits.codes.push(target);
  const coins = visitTip(state.level);
  const miles = rng() < VISIT_MILE_CHANCE ? 1 : 0;
  state.coins += coins;
  state.stats.totalCoins += coins;
  state.miles += miles;
  state.stats.friendVisits++;
  return { ok: true, value: { coins, miles } };
}

// --- Backend -------------------------------------------------------------------

/** What a social server must provide. Swap MemorySocialBackend for a real one. */
export interface SocialBackend {
  publish(profile: PublicProfile): Promise<void>;
  fetchProfiles(codes: string[]): Promise<PublicProfile[]>;
  deliverGift(gift: Gift): Promise<void>;
  /** Removes and returns the gifts waiting for this player. */
  takeGifts(code: string): Promise<Gift[]>;
  /** Global weekly leaderboard. */
  topWeekly(week: number, limit: number): Promise<PublicProfile[]>;
}

/** In-memory backend for development, tests and offline play. */
export class MemorySocialBackend implements SocialBackend {
  private profiles = new Map<string, PublicProfile>();
  private gifts: Gift[] = [];

  async publish(profile: PublicProfile) {
    this.profiles.set(profile.code, profile);
  }

  async fetchProfiles(codes: string[]) {
    return codes.map((c) => this.profiles.get(normalizeCode(c))).filter((p): p is PublicProfile => !!p);
  }

  async deliverGift(gift: Gift) {
    this.gifts.push(gift);
  }

  async takeGifts(code: string) {
    const mine = this.gifts.filter((g) => g.to === code);
    this.gifts = this.gifts.filter((g) => g.to !== code);
    return mine;
  }

  async topWeekly(week: number, limit: number) {
    return [...this.profiles.values()]
      .filter((p) => p.week === week)
      .sort((a, b) => b.weeklyScore - a.weeklyScore)
      .slice(0, limit);
  }
}

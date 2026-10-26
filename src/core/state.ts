import { COUNTRIES } from './data/countries';
import { PLANE_BY_ID } from './data/planes';
import { FIRST_NAMES } from './data/crew';
import { weekIndex } from './formulas';
import { hashString } from './rng';
import type { CountryId, GameState, GameStats, PlaneState } from './types';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Friend code derived from the player seed, e.g. "IP-7KQ2-M9XA". */
export function playerCode(seed: number): string {
  let h = hashString(`idleport:${seed}`);
  let h2 = hashString(`code:${seed}`);
  let out = '';
  for (let i = 0; i < 8; i++) {
    const src = i < 4 ? h : h2;
    out += CODE_ALPHABET[src % 32];
    if (i < 4) h = Math.floor(h / 32);
    else h2 = Math.floor(h2 / 32);
  }
  return `IP-${out.slice(0, 4)}-${out.slice(4)}`;
}

export function defaultPlayerName(seed: number): string {
  return `${FIRST_NAMES[seed % FIRST_NAMES.length]} ${(seed % 900) + 100}`;
}

export const SAVE_VERSION = 1;

export const STARTING_COINS = 300;
export const STARTING_MILES = 10;

export function emptyStats(): GameStats {
  return {
    floorsBuilt: 0, shopsOpened: 0, restocks: 0, flightsSent: 0, flightsCollected: 0, recruits: 0,
    crewAssigned: 0, planeUpgrades: 0, shopUpgrades: 0, researchDone: 0, fusions: 0, vipsServed: 0,
    vipsUsed: 0, guided: 0, planesBought: 0, totalCoins: 0, giftsSent: 0, friendVisits: 0,
    boxesOpened: 0, betsWon: 0,
  };
}

export function newPlane(uidStr: string, modelId: string, name: string, color: string): PlaneState {
  const model = PLANE_BY_ID[modelId];
  return {
    uid: uidStr,
    modelId,
    name,
    color,
    upgrades: { speed: 0, capacity: 0, range: 0, comfort: 0, reliability: 0 },
    modules: Array.from({ length: model.slots }, () => null),
    crew: {},
  };
}

export function createInitialState(now: number, seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  const resources = Object.fromEntries(COUNTRIES.map((c) => [c.id, 0])) as Record<CountryId, number>;
  return {
    version: SAVE_VERSION,
    seed,
    createdAt: now,
    lastTick: now,

    coins: STARTING_COINS,
    miles: STARTING_MILES,
    xp: 0,
    level: 1,
    resources,

    floors: [],
    plans: [],

    lounge: { level: 1, passengers: 0 },

    planes: [newPlane('plane_1', 'coucou', 'Coucou 1', PLANE_BY_ID.coucou.color)],
    crew: [],
    vips: [],
    reports: [],

    discovered: [],
    bonusShops: [],
    research: [],

    carnet: {},
    missionIndex: 0,
    stats: emptyStats(),

    boosts: {},
    cooldowns: {},
    timers: { vipCheck: now, guideCheck: now },

    facadeColor: '#f2e8d5',
    lobbyColor: '#d6e4f0',

    prestige: { stars: 0, count: 0, runStartedAt: now },
    album: [],
    daily: { streak: 0, claimedDay: -1 },
    quests: { day: -1, ids: [], base: {}, claimed: [], chestClaimed: false },
    achievements: [],

    gamble: { pity: 0 },
    dex: { vips: [], planes: [], events: [], claimed: [] },
    season: { id: null, year: 0, points: 0, claimed: [], trophies: [] },
    social: {
      name: defaultPlayerName(seed),
      code: playerCode(seed),
      friends: [],
      gifts: { day: -1, sent: [], received: 0 },
      visits: { day: -1, codes: [] },
      week: { index: weekIndex(now), startCoins: 0 },
    },
  };
}

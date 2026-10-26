import { COUNTRIES } from './data/countries';
import { PLANE_BY_ID } from './data/planes';
import type { CountryId, GameState, GameStats, PlaneState } from './types';

export const SAVE_VERSION = 1;

export const STARTING_COINS = 300;
export const STARTING_MILES = 10;

export function emptyStats(): GameStats {
  return {
    floorsBuilt: 0, shopsOpened: 0, restocks: 0, flightsSent: 0, flightsCollected: 0, recruits: 0,
    crewAssigned: 0, planeUpgrades: 0, shopUpgrades: 0, researchDone: 0, fusions: 0, vipsServed: 0,
    vipsUsed: 0, guided: 0, planesBought: 0, totalCoins: 0,
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
  };
}

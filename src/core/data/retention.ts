import { COUNTRIES } from './countries';
import { SHOPS } from './shops';
import type { GameState, GameStats } from '../types';

// --- Daily reward (7-day cycle) ----------------------------------------------

export type DailyReward =
  | { kind: 'coins'; perLevel: number }
  | { kind: 'miles'; amount: number }
  | { kind: 'recruit'; premium: boolean };

export const DAILY_REWARDS: DailyReward[] = [
  { kind: 'coins', perLevel: 300 },
  { kind: 'miles', amount: 3 },
  { kind: 'coins', perLevel: 600 },
  { kind: 'recruit', premium: false },
  { kind: 'miles', amount: 5 },
  { kind: 'coins', perLevel: 1200 },
  { kind: 'recruit', premium: true },
];

// --- Daily quests --------------------------------------------------------------

export interface QuestDef {
  id: string;
  text: string;
  stat: keyof GameStats;
  /** Goal, possibly scaled with the airport level. */
  goal: (level: number) => number;
  minLevel?: number;
  /** Only offered to players who have at least one friend. */
  needsFriends?: boolean;
}

export const QUESTS: QuestDef[] = [
  { id: 'q_collect', text: 'Collecter {n} vols', stat: 'flightsCollected', goal: (l) => 10 + 2 * l },
  { id: 'q_restock', text: 'Réapprovisionner {n} rayons', stat: 'restocks', goal: () => 8 },
  { id: 'q_shopup', text: 'Améliorer {n} magasins', stat: 'shopUpgrades', goal: () => 5 },
  { id: 'q_planeup', text: 'Améliorer {n} fois un avion', stat: 'planeUpgrades', goal: () => 3 },
  { id: 'q_guide', text: 'Guider {n} passagers', stat: 'guided', goal: () => 3 },
  { id: 'q_vipuse', text: 'Utiliser {n} VIP', stat: 'vipsUsed', goal: () => 1 },
  { id: 'q_vipserve', text: 'Satisfaire {n} VIP', stat: 'vipsServed', goal: () => 1, minLevel: 2 },
  { id: 'q_coins', text: 'Gagner {n} pièces', stat: 'totalCoins', goal: (l) => 2000 * l * l },
  { id: 'q_fusion', text: 'Lancer {n} fusion', stat: 'fusions', goal: () => 1, minLevel: 3 },
  { id: 'q_research', text: 'Terminer {n} recherche', stat: 'researchDone', goal: () => 1, minLevel: 2 },
  { id: 'q_gift', text: 'Envoyer {n} cadeaux à vos amis', stat: 'giftsSent', goal: () => 3, needsFriends: true },
  { id: 'q_visit', text: 'Visiter {n} aéroports amis', stat: 'friendVisits', goal: () => 2, needsFriends: true },
];
export const QUESTS_PER_DAY = 3;
export const QUEST_MILES = 3;
export const QUEST_COINS_PER_LEVEL = 200;
export const QUEST_CHEST_MILES = 5;

// --- Achievements (tiers) -----------------------------------------------------

export interface AchievementDef {
  id: string;
  text: string;
  goal: number;
  progress: (s: GameState) => number;
  miles: number;
}

const tiers = (
  base: string,
  text: string,
  goals: number[],
  progress: (s: GameState) => number,
  miles: number[],
): AchievementDef[] => goals.map((goal, i) => ({ id: `${base}_${i + 1}`, text: text.replace('{n}', goal.toLocaleString('fr-FR')), goal, progress, miles: miles[i] }));

const countryShops = SHOPS.filter((d) => !d.fusionOnly).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  ...tiers('floors', 'Construire {n} étages', [10, 25, 50, 100], (s) => s.stats.floorsBuilt, [5, 10, 20, 40]),
  ...tiers('flights', 'Effectuer {n} vols', [100, 1000, 10000, 50000], (s) => s.stats.flightsCollected, [5, 10, 20, 40]),
  ...tiers('coins', 'Gagner {n} pièces', [1e6, 1e8, 1e10, 1e12], (s) => s.stats.totalCoins, [5, 10, 20, 40]),
  ...tiers('carnet', 'Servir {n} VIP différents', [5, 10, 16], (s) => Object.keys(s.carnet).length, [10, 20, 50]),
  ...tiers('album', 'Ouvrir {n} magasins différents', [10, 20, countryShops, SHOPS.length], (s) => s.album.length, [5, 10, 25, 50]),
  ...tiers('countries', 'Visiter {n} pays', [2, 4, 6, COUNTRIES.length], (s) => s.discovered.length, [3, 5, 10, 20]),
  ...tiers('research', 'Terminer {n} recherches', [4, 16, 32], (s) => s.research.length, [5, 15, 30]),
  ...tiers('legend', 'Recruter {n} équipiers légendaires', [1, 3, 9], (s) => s.crew.filter((c) => c.rarity === 'L').length, [10, 20, 40]),
  ...tiers('franchise', 'Ouvrir {n} franchises', [1, 3, 10, 25], (s) => s.prestige.count, [20, 40, 80, 150]),
  ...tiers('friends', 'Avoir {n} amis', [1, 5, 20], (s) => s.social.friends.length, [5, 10, 20]),
  ...tiers('gifts', 'Envoyer {n} cadeaux', [10, 100, 1000], (s) => s.stats.giftsSent, [5, 15, 40]),
  ...tiers('seasons', 'Gagner {n} trophées saisonniers', [1, 5, 9], (s) => s.season.trophies.length, [10, 30, 80]),
  ...tiers('streak', 'Revenir {n} jours de suite', [7, 30, 100], (s) => s.daily.streak, [10, 30, 100]),
];

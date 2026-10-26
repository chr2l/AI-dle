import type { CountryId } from '../types';

export interface SeasonDef {
  id: string;
  name: string;
  emoji: string;
  /** Yearly UTC dates, inclusive. An end before the start wraps over New Year. */
  start: [month: number, day: number];
  end: [month: number, day: number];
  /** Flights to this country earn double points. */
  country: CountryId;
  currency: { name: string; emoji: string };
  /** Exclusive shop given as a plan by the reward track. */
  shopId: string;
  text: string;
}

export const SEASONS: SeasonDef[] = [
  { id: 'saint_valentin', name: 'Fête des amoureux', emoji: '💘', start: [2, 7], end: [2, 21], country: 'gourmandie', currency: { name: "Lettres d'amour", emoji: '💌' }, shopId: 'chocolatier', text: 'Les couples s’envolent pour Gourmandie.' },
  { id: 'carnaval', name: 'Carnaval', emoji: '🎭', start: [3, 1], end: [3, 14], country: 'melodia', currency: { name: 'Masques', emoji: '🎭' }, shopId: 'bal_masque', text: 'Mélodia défile en musique.' },
  { id: 'printemps', name: 'Fête du printemps', emoji: '🌷', start: [4, 1], end: [4, 21], country: 'nuagelande', currency: { name: 'Œufs', emoji: '🥚' }, shopId: 'jardin', text: 'Les îles de Nuagelande fleurissent.' },
  { id: 'fete_musique', name: 'Fête de la musique', emoji: '🎸', start: [6, 14], end: [6, 28], country: 'melodia', currency: { name: 'Billets de concert', emoji: '🎟️' }, shopId: 'scene_live', text: 'Concerts géants dans tout Mélodia.' },
  { id: 'ete', name: 'Grandes vacances', emoji: '🏖️', start: [7, 10], end: [8, 25], country: 'tropicalia', currency: { name: 'Poissons-clowns', emoji: '🐠' }, shopId: 'paillote', text: 'Tout le monde part à la plage.' },
  { id: 'rallye', name: 'Rallye des dunes', emoji: '🏁', start: [9, 15], end: [9, 30], country: 'desolande', currency: { name: 'Bidons', emoji: '⛽' }, shopId: 'station', text: 'Les bolides traversent Désolande.' },
  { id: 'halloween', name: 'Halloween', emoji: '🎃', start: [10, 20], end: [11, 3], country: 'infernia', currency: { name: 'Bonbons', emoji: '🍬' }, shopId: 'manoir', text: 'Les portes d’Infernia s’ouvrent aux touristes.' },
  { id: 'cyber_week', name: 'Semaine du Cyber', emoji: '💾', start: [11, 20], end: [12, 2], country: 'bitopia', currency: { name: 'Disquettes', emoji: '💾' }, shopId: 'arcade_neon', text: 'Soldes géantes à Bitopia.' },
  { id: 'noel', name: 'Noël polaire', emoji: '🎄', start: [12, 10], end: [1, 6], country: 'givrebourg', currency: { name: 'Paquets', emoji: '🎁' }, shopId: 'atelier_noel', text: 'Le Père Givre prépare sa tournée.' },
];

export const SEASON_BY_ID = Object.fromEntries(SEASONS.map((s) => [s.id, s])) as Record<string, SeasonDef>;

export type SeasonReward =
  | { kind: 'miles'; amount: number }
  | { kind: 'coins'; perLevel: number }
  | { kind: 'recruit'; premium: boolean }
  | { kind: 'shop' }
  | { kind: 'trophy'; miles: number };

/** Reward track, the same for every season. */
export const SEASON_TRACK: { points: number; reward: SeasonReward }[] = [
  { points: 50, reward: { kind: 'miles', amount: 5 } },
  { points: 150, reward: { kind: 'coins', perLevel: 2000 } },
  { points: 300, reward: { kind: 'recruit', premium: false } },
  { points: 600, reward: { kind: 'miles', amount: 10 } },
  { points: 1000, reward: { kind: 'shop' } },
  { points: 1600, reward: { kind: 'recruit', premium: true } },
  { points: 2500, reward: { kind: 'miles', amount: 25 } },
  { points: 4000, reward: { kind: 'trophy', miles: 40 } },
];

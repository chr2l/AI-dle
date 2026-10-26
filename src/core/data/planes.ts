import type { CountryId, StatKey } from '../types';

export interface PlaneModel {
  id: string;
  name: string;
  speed: number;
  capacity: number;
  range: number;
  comfort: number;
  reliability: number;
  slots: number;
  price: number;
  level: number;
  /** Voxel silhouette parameters for the renderer. */
  shape: { length: number; wingspan: number; engines: number; body: number };
  color: string;
}

export const PLANE_MODELS: PlaneModel[] = [
  {
    id: 'coucou', name: 'Coucou', speed: 300, capacity: 8, range: 800, comfort: 1, reliability: 50,
    slots: 1, price: 0, level: 1, shape: { length: 5, wingspan: 7, engines: 1, body: 1 }, color: '#ffd23f',
  },
  {
    id: 'libellule', name: 'Libellule', speed: 450, capacity: 16, range: 1800, comfort: 2, reliability: 55,
    slots: 1, price: 5000, level: 3, shape: { length: 7, wingspan: 9, engines: 2, body: 1 }, color: '#2ec4a6',
  },
  {
    id: 'albatros', name: 'Albatros', speed: 600, capacity: 30, range: 3500, comfort: 3, reliability: 60,
    slots: 2, price: 40000, level: 6, shape: { length: 9, wingspan: 11, engines: 2, body: 2 }, color: '#ffffff',
  },
  {
    id: 'baleine', name: 'Baleine', speed: 800, capacity: 60, range: 6000, comfort: 3, reliability: 65,
    slots: 2, price: 250000, level: 10, shape: { length: 11, wingspan: 13, engines: 4, body: 2 }, color: '#3fa7ff',
  },
  {
    id: 'colibri', name: 'Colibri Jet', speed: 950, capacity: 12, range: 8000, comfort: 8, reliability: 70,
    slots: 3, price: 1200000, level: 14, shape: { length: 8, wingspan: 8, engines: 2, body: 1 }, color: '#ff6fb5',
  },
];

export const PLANE_BY_ID = Object.fromEntries(PLANE_MODELS.map((p) => [p.id, p])) as Record<string, PlaneModel>;

export const STAT_INFO: Record<StatKey, { name: string; emoji: string; unit: string }> = {
  speed: { name: 'Vitesse', emoji: '💨', unit: 'km/h' },
  capacity: { name: 'Capacité', emoji: '👥', unit: 'pl.' },
  range: { name: 'Autonomie', emoji: '🗺️', unit: 'km' },
  comfort: { name: 'Confort', emoji: '🛋️', unit: '' },
  reliability: { name: 'Fiabilité', emoji: '🔧', unit: '%' },
};

export const STAT_KEYS = Object.keys(STAT_INFO) as StatKey[];
export const MAX_STAT_LEVEL = 10;

export interface ModuleDef {
  id: string;
  name: string;
  emoji: string;
  countryId: CountryId;
  desc: string;
  comfort?: number;
  speedPct?: number;
  rangePct?: number;
  reliability?: number;
  ticketPct?: number;
}

export const MODULES: ModuleDef[] = [
  { id: 'dancefloor', name: 'Dancefloor', emoji: '🪩', countryId: 'melodia', desc: '+3 confort', comfort: 3 },
  { id: 'cocktails', name: 'Bar à cocktails', emoji: '🍹', countryId: 'tropicalia', desc: '+2 confort, +10 % billets', comfort: 2, ticketPct: 0.1 },
  { id: 'cuisine', name: 'Cuisine étoilée', emoji: '👨‍🍳', countryId: 'gourmandie', desc: '+4 confort', comfort: 4 },
  { id: 'pilote_ia', name: 'Pilote IA', emoji: '🤖', countryId: 'bitopia', desc: '+10 % vitesse, +5 fiabilité', speedPct: 0.1, reliability: 5 },
  { id: 'cryo', name: 'Isolation cryo', emoji: '🧊', countryId: 'givrebourg', desc: '+10 fiabilité, +10 % autonomie', reliability: 10, rangePct: 0.1 },
  { id: 'blindage', name: 'Blindage de récup', emoji: '🛡️', countryId: 'desolande', desc: '+15 fiabilité', reliability: 15 },
  { id: 'vapeur', name: 'Moteurs à vapeur céleste', emoji: '🎈', countryId: 'nuagelande', desc: '+20 % vitesse, +20 % autonomie', speedPct: 0.2, rangePct: 0.2 },
  { id: 'reacteur', name: 'Réacteur infernal', emoji: '😈', countryId: 'infernia', desc: '+30 % vitesse, −5 fiabilité', speedPct: 0.3, reliability: -5 },
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<string, ModuleDef>;

export const PLANE_COLORS = ['#ffd23f', '#2ec4a6', '#ffffff', '#3fa7ff', '#ff6fb5', '#ff7a59', '#c86bfa', '#7cffcb'];

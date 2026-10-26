import type { CountryId } from '../types';

export interface CountryDef {
  id: CountryId;
  name: string;
  theme: string;
  emoji: string;
  ring: number;
  /** Angle (degrees) on the world map. */
  angle: number;
  color: string;
  palette: string[];
  resource: { name: string; emoji: string };
  /** Syllables used by the procedural destination name generator. */
  prefixes: string[];
  suffixes: string[];
}

export const COUNTRIES: CountryDef[] = [
  {
    id: 'melodia',
    name: 'Mélodia',
    theme: 'Le pays musical',
    emoji: '🎵',
    ring: 1,
    angle: 200,
    color: '#c86bfa',
    palette: ['#c86bfa', '#ffd23f', '#3d2c8d', '#ff6fb5'],
    resource: { name: 'Notes', emoji: '🎶' },
    prefixes: ['Do', 'Ré', 'Sol', 'La', 'Fa', 'Arpège', 'Tempo', 'Harmo', 'Vibra', 'Crescen'],
    suffixes: ['-sur-Gamme', 'ville', '-les-Basses', 'phonie', '-Majeur', '-mineur', 'dor', '-Port'],
  },
  {
    id: 'tropicalia',
    name: 'Tropicalia',
    theme: 'Le pays tropical',
    emoji: '🌴',
    ring: 1,
    angle: 340,
    color: '#2ec4a6',
    palette: ['#2ec4a6', '#ffcf5c', '#ff7a59', '#1d8a6e'],
    resource: { name: 'Coquillages', emoji: '🐚' },
    prefixes: ['Coco', 'Mangu', 'Papa', 'Lago', 'Bora', 'Ananaï', 'Hibis', 'Kawa'],
    suffixes: ['-Plage', 'nui', '-Lagon', 'cabana', '-les-Palmes', 'hiti', 'rica'],
  },
  {
    id: 'gourmandie',
    name: 'Gourmandie',
    theme: 'Le royaume gourmand',
    emoji: '🍰',
    ring: 2,
    angle: 120,
    color: '#ff9f5a',
    palette: ['#ff9f5a', '#ffe0b5', '#8b4a2b', '#ff5e7e'],
    resource: { name: 'Saveurs', emoji: '🧁' },
    prefixes: ['Choco', 'Brioch', 'Caramel', 'Pralin', 'Gratin', 'Fromag', 'Croust', 'Miel'],
    suffixes: ['-sur-Crème', 'ville', 'bourg', '-le-Fondant', '-aux-Pommes', 'ette'],
  },
  {
    id: 'bitopia',
    name: 'Bitopia',
    theme: 'Le pays digital',
    emoji: '💾',
    ring: 2,
    angle: 30,
    color: '#3fa7ff',
    palette: ['#3fa7ff', '#7cffcb', '#1b1f5e', '#ff4fd8'],
    resource: { name: 'Octets', emoji: '💠' },
    prefixes: ['Pixel', 'Giga', 'Byte', 'Cyber', 'Néo', 'Data', 'Algo', 'Quanta'],
    suffixes: ['-City', '.exe', 'polis', '-2.0', 'net', '-Cloud', 'tron'],
  },
  {
    id: 'givrebourg',
    name: 'Givrebourg',
    theme: "L'archipel de glace",
    emoji: '❄️',
    ring: 3,
    angle: 75,
    color: '#a8e6ff',
    palette: ['#a8e6ff', '#ffffff', '#4a7bd1', '#c7f0ff'],
    resource: { name: 'Cristaux', emoji: '💎' },
    prefixes: ['Givr', 'Frima', 'Blizz', 'Glaç', 'Polar', 'Nordh', 'Brrr', 'Iglou'],
    suffixes: ['heim', '-les-Glaces', 'vik', 'fjord', 'berg', 'ström'],
  },
  {
    id: 'desolande',
    name: 'Désolande',
    theme: 'Le pays désolé',
    emoji: '🏜️',
    ring: 3,
    angle: 255,
    color: '#b8a07a',
    palette: ['#b8a07a', '#7a5c3e', '#d9c6a0', '#8f8f8f'],
    resource: { name: 'Ferraille', emoji: '⚙️' },
    prefixes: ['Rouill', 'Poussi', 'Cendr', 'Ferr', 'Carcass', 'Dun', 'Sèch', 'Vid'],
    suffixes: ['-Gulch', 'ville', '-les-Ruines', 'tropole', '-Zone', 'creek'],
  },
  {
    id: 'nuagelande',
    name: 'Nuagelande',
    theme: 'Les îles flottantes',
    emoji: '☁️',
    ring: 4,
    angle: 165,
    color: '#f4f0ff',
    palette: ['#f4f0ff', '#ffc8f0', '#9ad5ff', '#fff3b0'],
    resource: { name: 'Vapeur', emoji: '💨' },
    prefixes: ['Cumul', 'Strat', 'Nimb', 'Zéphy', 'Plum', 'Céles', 'Brum', 'Azur'],
    suffixes: ['-les-Nues', 'ia', 'ciel', '-Haut', 'éther', 'ville'],
  },
  {
    id: 'infernia',
    name: 'Infernia',
    theme: 'Le pays des enfers',
    emoji: '🔥',
    ring: 4,
    angle: 300,
    color: '#ff4b3a',
    palette: ['#ff4b3a', '#2b0f1e', '#ffb03a', '#7a1630'],
    resource: { name: 'Braises', emoji: '🔥' },
    prefixes: ['Souf', 'Brais', 'Styx', 'Magm', 'Cendr', 'Diabl', 'Lucif', 'Tisonn'],
    suffixes: ['-les-Flammes', 'gehenne', 'ville', '-du-Gouffre', 'abysse', 'ardent'],
  },
];

export const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map((c) => [c.id, c])) as Record<
  CountryId,
  CountryDef
>;

/** Minimum airport level required for each ring. */
export const RING_LEVELS: Record<number, number> = { 1: 1, 2: 4, 3: 8, 4: 13 };

/** Distance band (km) for each ring. */
export const RING_DISTANCES: Record<number, [number, number]> = {
  1: [250, 700],
  2: [1100, 1700],
  3: [2500, 3400],
  4: [4500, 7500],
};

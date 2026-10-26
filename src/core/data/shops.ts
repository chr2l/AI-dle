import type { Element, Rarity, ShopCategory } from '../types';

export interface ShopDef {
  id: string;
  name: string;
  emoji: string;
  category: ShopCategory;
  rarity: Rarity;
  elements: Element[];
  /** Two main colors used by the voxel renderer. */
  colors: [string, string];
  /** Only obtainable through fusion. */
  fusionOnly?: boolean;
}

export const CATEGORIES: Record<ShopCategory, { name: string; emoji: string; products: string[] }> = {
  resto: { name: 'Restauration', emoji: '🍔', products: ['Cafés', 'Viennoiseries', 'Menus complets'] },
  boutique: { name: 'Boutique', emoji: '🛍️', products: ['Magazines', 'Souvenirs', 'Articles de luxe'] },
  detente: { name: 'Détente', emoji: '🛋️', products: ['Coussins', 'Huiles', 'Forfaits zen'] },
  service: { name: 'Services', emoji: '🧳', products: ['Tickets', 'Formulaires', 'Contrats'] },
  loisir: { name: 'Loisirs', emoji: '🎮', products: ['Jetons', 'Parties', 'Abonnements'] },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as ShopCategory[];

const s = (
  id: string,
  name: string,
  emoji: string,
  category: ShopCategory,
  rarity: Rarity,
  elements: Element[],
  colors: [string, string],
  fusionOnly = false,
): ShopDef => ({ id, name, emoji, category, rarity, elements, colors, fusionOnly });

export const SHOPS: ShopDef[] = [
  // Neutral shops — always in the pool.
  s('cafe', 'Café du Hall', '☕', 'resto', 'C', ['neutre'], ['#8b5a3c', '#f2e2c4']),
  s('sandwich', 'Sandwicherie', '🥪', 'resto', 'C', ['neutre'], ['#e8b04a', '#5aa55a']),
  s('kiosque', 'Kiosque à journaux', '📰', 'boutique', 'C', ['neutre'], ['#3d6fb5', '#f0f0f0']),
  s('souvenirs', 'Souvenirs', '🗼', 'boutique', 'C', ['neutre'], ['#d94f4f', '#ffd166']),
  s('duty', 'Duty Free', '🛍️', 'boutique', 'R', ['neutre'], ['#2b2d42', '#e0c068']),
  s('fauteuils', 'Fauteuils massants', '💺', 'detente', 'C', ['neutre'], ['#6c5ce7', '#dcd6ff']),
  s('salonvip', 'Salon VIP', '🥂', 'detente', 'E', ['neutre'], ['#1f1f2e', '#d4af37']),
  s('consigne', 'Consigne à bagages', '🧳', 'service', 'C', ['neutre'], ['#7f8c8d', '#f39c12']),
  s('change', 'Bureau de change', '💱', 'service', 'R', ['neutre'], ['#27ae60', '#ecf0f1']),
  s('arcade', "Salle d'arcade", '🕹️', 'loisir', 'C', ['neutre'], ['#9b59b6', '#00e5ff']),
  s('cinema', 'Mini-cinéma', '🎬', 'loisir', 'R', ['neutre'], ['#c0392b', '#2c2c2c']),

  // Mélodia
  s('disquaire', 'Disquaire', '💿', 'boutique', 'C', ['melodia'], ['#3d2c8d', '#ffd23f']),
  s('karaoke', 'Karaoké', '🎤', 'loisir', 'R', ['melodia'], ['#ff6fb5', '#3d2c8d']),
  s('luthier', 'Luthier', '🎻', 'boutique', 'E', ['melodia'], ['#8b4513', '#c86bfa']),
  // Tropicalia
  s('smoothie', 'Bar à smoothies', '🥤', 'resto', 'C', ['tropicalia'], ['#ff7a59', '#2ec4a6']),
  s('surf', 'Boutique de surf', '🏄', 'boutique', 'R', ['tropicalia'], ['#1d8a6e', '#ffcf5c']),
  s('spatropical', 'Spa tropical', '🌺', 'detente', 'E', ['tropicalia'], ['#2ec4a6', '#ff9ecf']),
  // Gourmandie
  s('patisserie', 'Pâtisserie', '🍰', 'resto', 'C', ['gourmandie'], ['#ff9fb2', '#ffe0b5']),
  s('fromagerie', 'Fromagerie', '🧀', 'boutique', 'R', ['gourmandie'], ['#ffd166', '#8b4a2b']),
  s('etoile', 'Restaurant étoilé', '⭐', 'resto', 'L', ['gourmandie'], ['#1f1f2e', '#ff9f5a']),
  // Bitopia
  s('cybercafe', 'Cyber-café', '🖥️', 'loisir', 'C', ['bitopia'], ['#1b1f5e', '#7cffcb']),
  s('repar', 'Réparation de smartphones', '📱', 'service', 'R', ['bitopia'], ['#3fa7ff', '#dfe6e9']),
  s('vr', 'Salle VR', '🥽', 'loisir', 'E', ['bitopia'], ['#ff4fd8', '#1b1f5e']),
  // Givrebourg
  s('glacier', 'Glacier', '🍦', 'resto', 'C', ['givrebourg'], ['#a8e6ff', '#ff9ecf']),
  s('doudounes', 'Doudounes & Co', '🧥', 'boutique', 'R', ['givrebourg'], ['#4a7bd1', '#ffffff']),
  s('sauna', 'Sauna nordique', '🧖', 'detente', 'E', ['givrebourg'], ['#a0522d', '#c7f0ff']),
  // Désolande
  s('brocante', 'Brocante', '🪑', 'boutique', 'C', ['desolande'], ['#7a5c3e', '#d9c6a0']),
  s('garage', 'Garage rouillé', '🔧', 'service', 'R', ['desolande'], ['#8f8f8f', '#c0662b']),
  s('cactus', 'Bar à cactus', '🌵', 'resto', 'E', ['desolande'], ['#5c8a3a', '#d9c6a0']),
  // Nuagelande
  s('barbapapa', 'Barbe à papa', '🍭', 'resto', 'C', ['nuagelande'], ['#ffc8f0', '#9ad5ff']),
  s('plumes', 'Boutique de plumes', '🪶', 'boutique', 'R', ['nuagelande'], ['#fff3b0', '#9ad5ff']),
  s('reves', 'Salon des rêves', '💤', 'detente', 'L', ['nuagelande'], ['#9ad5ff', '#f4f0ff']),
  // Infernia
  s('grill', 'Grill infernal', '🍖', 'resto', 'C', ['infernia'], ['#7a1630', '#ffb03a']),
  s('talismans', 'Boutique de talismans', '🧿', 'boutique', 'R', ['infernia'], ['#2b0f1e', '#ff4b3a']),
  s('casino', 'Casino des Enfers', '🎰', 'loisir', 'L', ['infernia'], ['#ff4b3a', '#ffd700']),

  // Fusion-only shops (two elements).
  s('jazz', 'Club de jazz', '🎷', 'resto', 'E', ['melodia', 'gourmandie'], ['#3d2c8d', '#ff9f5a'], true),
  s('beachparty', 'Beach party', '🏖️', 'loisir', 'E', ['melodia', 'tropicalia'], ['#ff6fb5', '#2ec4a6'], true),
  s('synthwave', 'Arcade synthwave', '🌆', 'loisir', 'E', ['melodia', 'bitopia'], ['#ff4fd8', '#3d2c8d'], true),
  s('robotcafe', 'Café des robots', '🤖', 'resto', 'E', ['bitopia', 'gourmandie'], ['#3fa7ff', '#ffe0b5'], true),
  s('iglobar', 'Igloo-bar', '🍹', 'resto', 'E', ['givrebourg', 'tropicalia'], ['#a8e6ff', '#ff7a59'], true),
  s('madgarage', 'Mad Garage', '🛻', 'service', 'L', ['desolande', 'bitopia'], ['#c0662b', '#7cffcb'], true),
  s('spavolcan', 'Spa volcanique', '♨️', 'detente', 'L', ['infernia', 'givrebourg'], ['#ff4b3a', '#a8e6ff'], true),
  s('opera', 'Opéra céleste', '🎭', 'loisir', 'L', ['nuagelande', 'melodia'], ['#f4f0ff', '#c86bfa'], true),
];

/** Seasonal exclusives (GDD §19): only obtainable as a plan from a seasonal reward track. Not in draws, fusion or album sets. */
export const SEASON_SHOPS: ShopDef[] = [
  s('chocolatier', 'Chocolatier des cœurs', '💝', 'resto', 'E', ['gourmandie'], ['#c2185b', '#5d3a1a']),
  s('bal_masque', 'Bal masqué', '🎭', 'loisir', 'E', ['melodia'], ['#7b1fa2', '#ffd23f']),
  s('jardin', 'Jardin suspendu', '🌷', 'detente', 'E', ['nuagelande'], ['#9ad5ff', '#ff9ecf']),
  s('scene_live', 'Scène live', '🎙️', 'loisir', 'L', ['melodia'], ['#1f1f2e', '#ff6fb5']),
  s('paillote', 'Paillote', '🛖', 'resto', 'E', ['tropicalia'], ['#c19a6b', '#2ec4a6']),
  s('station', 'Station-service rétro', '⛽', 'service', 'E', ['desolande'], ['#c0662b', '#d9c6a0']),
  s('manoir', 'Manoir hanté', '🏚️', 'loisir', 'L', ['infernia'], ['#2b0f1e', '#ff8c1a']),
  s('arcade_neon', 'Arcade néon', '🕹️', 'loisir', 'E', ['bitopia'], ['#ff4fd8', '#3fa7ff']),
  s('atelier_noel', 'Atelier du Père Givre', '🎅', 'boutique', 'L', ['givrebourg'], ['#c62828', '#ffffff']),
];

export const SHOP_BY_ID = Object.fromEntries([...SHOPS, ...SEASON_SHOPS].map((d) => [d.id, d])) as Record<string, ShopDef>;

export const RARITY_INFO: Record<Rarity, { name: string; weight: number; rate: number; rank: number; color: string }> = {
  C: { name: 'Commun', weight: 60, rate: 1.0, rank: 1, color: '#b0b8c8' },
  R: { name: 'Rare', weight: 28, rate: 1.6, rank: 2, color: '#4aa3ff' },
  E: { name: 'Épique', weight: 10, rate: 2.6, rank: 3, color: '#b45cff' },
  L: { name: 'Légendaire', weight: 2, rate: 4.2, rank: 4, color: '#ffb300' },
};

/** Restock products: time to restock and how long the stock lasts while selling. */
export const RESTOCK_TIERS = [
  { restockSec: 20, durationSec: 3 * 60 },
  { restockSec: 3 * 60, durationSec: 30 * 60 },
  { restockSec: 20 * 60, durationSec: 3 * 60 * 60 },
];

export const WALL_COLORS = ['#f2e8d5', '#d6e4f0', '#f7d6e0', '#d9f2d9', '#fff1b8', '#e3d9ff', '#3a3f5c', '#ffd9b3'];

// The Dex (GDD §23): every collection in one place, with completion rewards.
// Shops come from the album, VIPs from the Carnet plus every VIP seen at the
// airport, planes from every model ever owned, events from every event met.
import { COUNTRIES } from './data/countries';
import { EVENTS, SEASON_EVENTS } from './data/events';
import { PLANE_MODELS } from './data/planes';
import { SEASONS } from './data/seasons';
import { RARITY_INFO, SEASON_SHOPS, SHOPS } from './data/shops';
import { VIPS } from './data/vips';
import type { Result } from './engine';
import type { GameState, Rarity } from './types';

const fail = (error: string): Result<never> => ({ ok: false, error });

export type DexSectionId = 'shops' | 'vips' | 'planes' | 'countries' | 'events';

export interface DexEntry {
  id: string;
  name: string;
  emoji: string;
  rarity?: Rarity;
  seen: boolean;
  /** Shops: floors open now. VIPs: times served. Planes: owned now. Countries: resource stock. Events: 1 when met. */
  count: number;
  /** Where to find it, shown even when not seen yet. */
  hint?: string;
}

export interface DexSection {
  id: DexSectionId;
  name: string;
  emoji: string;
  found: number;
  total: number;
  entries: DexEntry[];
  milestones: { pct: number; miles: number; reached: boolean; claimed: boolean }[];
}

/** Completion rewards, the same for every section. */
export const DEX_MILESTONES = [
  { pct: 25, miles: 5 },
  { pct: 50, miles: 10 },
  { pct: 75, miles: 20 },
  { pct: 100, miles: 50 },
];

const COUNTRY_NAME = Object.fromEntries(COUNTRIES.map((c) => [c.id, c.name])) as Record<string, string>;
const SEASON_NAME = Object.fromEntries(SEASONS.map((s) => [s.id, s.name])) as Record<string, string>;

/** Remembers VIPs and planes currently at the airport (called by update()). */
export function recordSeen(state: GameState) {
  for (const v of state.vips) if (!state.dex.vips.includes(v.defId)) state.dex.vips.push(v.defId);
  for (const p of state.planes) if (!state.dex.planes.includes(p.modelId)) state.dex.planes.push(p.modelId);
}

function shopHint(id: string): string {
  const def = [...SHOPS, ...SEASON_SHOPS].find((d) => d.id === id)!;
  const season = SEASONS.find((s) => s.shopId === id);
  if (season) return `Exclusif : ${season.name}`;
  if (def.fusionOnly) return `Fusion : ${def.elements.map((e) => COUNTRY_NAME[e]).join(' + ')}`;
  const where = def.elements.includes('neutre') ? 'Partout' : COUNTRY_NAME[def.elements[0]];
  return `${where} · ${RARITY_INFO[def.rarity].name}`;
}

export function dexView(state: GameState): DexSection[] {
  recordSeen(state);
  const owned = (id: string) => state.floors.filter((f) => f.shop?.defId === id).length;
  const sections: Omit<DexSection, 'found' | 'total' | 'milestones'>[] = [
    {
      id: 'shops',
      name: 'Magasins',
      emoji: '🏬',
      entries: [...SHOPS, ...SEASON_SHOPS].map((d) => ({
        id: d.id, name: d.name, emoji: d.emoji, rarity: d.rarity,
        seen: state.album.includes(d.id), count: owned(d.id), hint: shopHint(d.id),
      })),
    },
    {
      id: 'vips',
      name: 'VIP',
      emoji: '⭐',
      entries: VIPS.map((v) => ({
        id: v.id, name: v.name, emoji: v.emoji,
        seen: state.dex.vips.includes(v.id) || (state.carnet[v.id] ?? 0) > 0,
        count: state.carnet[v.id] ?? 0,
        hint: v.countryId ? `Vient avec les magasins de ${COUNTRY_NAME[v.countryId]}` : 'Vient avec les magasins neutres',
      })),
    },
    {
      id: 'planes',
      name: 'Avions',
      emoji: '✈️',
      entries: PLANE_MODELS.map((m) => ({
        id: m.id, name: m.name, emoji: '✈️',
        seen: state.dex.planes.includes(m.id), count: state.planes.filter((p) => p.modelId === m.id).length,
        hint: `Niveau ${m.level}`,
      })),
    },
    {
      id: 'countries',
      name: 'Pays',
      emoji: '🗺️',
      entries: COUNTRIES.map((c) => ({
        id: c.id, name: c.name, emoji: c.emoji,
        seen: state.discovered.includes(c.id), count: Math.floor(state.resources[c.id] ?? 0),
        hint: `Anneau ${c.ring}`,
      })),
    },
    {
      id: 'events',
      name: 'Événements',
      emoji: '📜',
      entries: [...EVENTS, ...SEASON_EVENTS].map((e) => ({
        id: e.id, name: e.title, emoji: e.emoji,
        seen: state.dex.events.includes(e.id), count: state.dex.events.includes(e.id) ? 1 : 0,
        hint: e.season ? `Saison : ${SEASON_NAME[e.season]}` : e.rare ? 'Destination Mystère' : e.country === 'any' ? 'Partout' : COUNTRY_NAME[e.country],
      })),
    },
  ];
  return sections.map((s) => {
    const found = s.entries.filter((e) => e.seen).length;
    const total = s.entries.length;
    return {
      ...s,
      found,
      total,
      milestones: DEX_MILESTONES.map((m, i) => ({
        ...m,
        reached: found * 100 >= m.pct * total,
        claimed: state.dex.claimed.includes(`${s.id}:${i}`),
      })),
    };
  });
}

export function claimDexReward(state: GameState, sectionId: DexSectionId, index: number): Result<number> {
  const section = dexView(state).find((s) => s.id === sectionId);
  const milestone = section?.milestones[index];
  if (!section || !milestone) return fail('Récompense inconnue.');
  if (milestone.claimed) return fail('Déjà récupérée.');
  if (!milestone.reached) return fail(`Complétez ${milestone.pct} % de la section ${section.name}.`);
  state.dex.claimed.push(`${sectionId}:${index}`);
  state.miles += milestone.miles;
  return { ok: true, value: milestone.miles };
}

/** Rewards ready to claim, for a badge on the Dex button. */
export function dexClaimable(state: GameState): number {
  return dexView(state).reduce((n, s) => n + s.milestones.filter((m) => m.reached && !m.claimed).length, 0);
}

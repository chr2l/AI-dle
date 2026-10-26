import type { CountryId, CrewRole, Rarity } from '../types';

export const ROLE_INFO: Record<CrewRole, { name: string; emoji: string; desc: string }> = {
  pilot: { name: 'Pilote', emoji: '👨‍✈️', desc: 'Vitesse' },
  cabin: { name: 'Cabine', emoji: '💁', desc: 'Confort' },
  mechanic: { name: 'Mécano', emoji: '🧑‍🔧', desc: 'Fiabilité' },
};

export const ROLES = Object.keys(ROLE_INFO) as CrewRole[];

export const CREW_RARITY: Record<Rarity, { maxLevel: number; power: number }> = {
  C: { maxLevel: 10, power: 1 },
  R: { maxLevel: 20, power: 1.5 },
  E: { maxLevel: 30, power: 2.2 },
  L: { maxLevel: 40, power: 3 },
};

export interface TraitDef {
  id: string;
  name: string;
  desc: string;
  /** Bonus to event success chance in this country. */
  country?: CountryId;
  countryBonus?: number;
  speedPct?: number;
  coinsPct?: number;
  xpPct?: number;
  repairPct?: number;
  luck?: number;
}

export const TRAITS: TraitDef[] = [
  { id: 'melomane', name: 'Mélomane', desc: '+10 % réussite à Mélodia', country: 'melodia', countryBonus: 0.1 },
  { id: 'bronze', name: 'Bronzé', desc: '+10 % réussite à Tropicalia', country: 'tropicalia', countryBonus: 0.1 },
  { id: 'gourmet', name: 'Gourmet', desc: '+10 % réussite à Gourmandie', country: 'gourmandie', countryBonus: 0.1 },
  { id: 'geek', name: 'Geek', desc: '+10 % réussite à Bitopia', country: 'bitopia', countryBonus: 0.1 },
  { id: 'frileux', name: 'Frileux', desc: '−10 % réussite à Givrebourg', country: 'givrebourg', countryBonus: -0.1 },
  { id: 'survivaliste', name: 'Survivaliste', desc: '+10 % réussite à Désolande', country: 'desolande', countryBonus: 0.1 },
  { id: 'reveur', name: 'Rêveur', desc: '+10 % réussite à Nuagelande', country: 'nuagelande', countryBonus: 0.1 },
  { id: 'ignifuge', name: 'Ignifugé', desc: '+10 % réussite à Infernia', country: 'infernia', countryBonus: 0.1 },
  { id: 'chanceux', name: 'Chanceux', desc: '+5 % réussite partout', luck: 0.05 },
  { id: 'leve_tot', name: 'Lève-tôt', desc: '+10 % vitesse', speedPct: 0.1 },
  { id: 'bavard', name: 'Bavard', desc: '+10 % billets', coinsPct: 0.1 },
  { id: 'econome', name: 'Économe', desc: '−25 % coût de réparation', repairPct: -0.25 },
  { id: 'veteran', name: 'Vétéran', desc: '+20 % XP', xpPct: 0.2 },
];

export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t])) as Record<string, TraitDef>;

export const FIRST_NAMES = [
  'Jean', 'Lucie', 'Paco', 'Inès', 'Hugo', 'Zoé', 'Bruno', 'Maya', 'Gaston', 'Nina', 'Ravi', 'Léa',
  'Otto', 'Yumi', 'Kofi', 'Elsa', 'Marco', 'Aïcha', 'Igor', 'Rosa', 'Tom', 'Sacha', 'Lou', 'Noé',
];

export const LAST_NAMES = [
  'Bon', 'Nuage', 'Hélice', 'Carlingue', 'Décollage', 'Altitude', 'Kérosène', 'Cumulus', 'Tarmac',
  'Boussole', 'Radar', 'Volant', 'Plané', 'Turbine', 'Escale', 'Aileron', 'Hublot', 'Piste',
];

/** Odds by recruitment kind. */
export const RECRUIT_ODDS: Record<'standard' | 'premium', Record<Rarity, number>> = {
  standard: { C: 70, R: 25, E: 4.5, L: 0.5 },
  premium: { C: 0, R: 60, E: 33, L: 7 },
};

export const PREMIUM_RECRUIT_MILES = 30;

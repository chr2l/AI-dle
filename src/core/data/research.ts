import type { CountryId } from '../types';

export interface DecoDef {
  id: string;
  name: string;
  emoji: string;
  countryId: CountryId;
  desc: string;
  arrivalsPct?: number;
  shopIncomePct?: number;
  ticketPct?: number;
  loungeCap?: number;
  repairPct?: number;
  flightSpeedPct?: number;
  vipChancePct?: number;
}

export const DECOS: DecoDef[] = [
  { id: 'scene', name: 'Scène du hall', emoji: '🎸', countryId: 'melodia', desc: '+10 % arrivées de passagers', arrivalsPct: 0.1 },
  { id: 'palmiers', name: 'Palmiers & hamacs', emoji: '🌴', countryId: 'tropicalia', desc: '+5 % revenus des magasins', shopIncomePct: 0.05 },
  { id: 'fontaine', name: 'Fontaine de chocolat', emoji: '🍫', countryId: 'gourmandie', desc: '+8 % revenus des magasins', shopIncomePct: 0.08 },
  { id: 'ecrans', name: 'Écrans géants', emoji: '📺', countryId: 'bitopia', desc: '+8 % prix des billets', ticketPct: 0.08 },
  { id: 'sculpture', name: 'Sculpture de glace', emoji: '🧊', countryId: 'givrebourg', desc: '+20 places en salle d’embarquement', loungeCap: 20 },
  { id: 'carcasse', name: "Carcasse d'avion vintage", emoji: '🛩️', countryId: 'desolande', desc: '−30 % coût de réparation', repairPct: -0.3 },
  { id: 'montgolfiere', name: 'Montgolfière suspendue', emoji: '🎈', countryId: 'nuagelande', desc: '+5 % vitesse des vols', flightSpeedPct: 0.05 },
  { id: 'brasero', name: 'Brasero éternel', emoji: '🔥', countryId: 'infernia', desc: '+30 % chance de VIP', vipChancePct: 0.3 },
];

export const DECO_BY_ID = Object.fromEntries(DECOS.map((d) => [d.id, d])) as Record<string, DecoDef>;

export type TechEffect =
  | { type: 'shop'; shopId: string; resourcePct?: number }
  | { type: 'module'; moduleId: string }
  | { type: 'deco'; decoId: string };

export interface TechDef {
  id: string;
  countryId: CountryId;
  /** Position in the country's tree (0..3), drives cost and duration. */
  k: number;
  name: string;
  emoji: string;
  effect: TechEffect;
}

const TREE: Record<CountryId, [string, string, string, string]> = {
  melodia: ['karaoke', 'dancefloor', 'scene', 'luthier'],
  tropicalia: ['surf', 'cocktails', 'palmiers', 'spatropical'],
  gourmandie: ['fromagerie', 'cuisine', 'fontaine', 'etoile'],
  bitopia: ['repar', 'pilote_ia', 'ecrans', 'vr'],
  givrebourg: ['doudounes', 'cryo', 'sculpture', 'sauna'],
  desolande: ['garage', 'blindage', 'carcasse', 'cactus'],
  nuagelande: ['plumes', 'vapeur', 'montgolfiere', 'reves'],
  infernia: ['talismans', 'reacteur', 'brasero', 'casino'],
};

const TECH_NAMES: Record<CountryId, [string, string, string, string]> = {
  melodia: ['Échanges culturels', 'Acoustique de cabine', 'Scène ouverte', 'Maîtres luthiers'],
  tropicalia: ['Culture surf', 'Mixologie', 'Ambiance plage', 'Rituels de bien-être'],
  gourmandie: ['Affinage', 'Gastronomie aérienne', 'Art chocolatier', 'Haute cuisine'],
  bitopia: ['Micro-soudure', 'Intelligence artificielle', 'Affichage géant', 'Réalité virtuelle'],
  givrebourg: ['Textiles polaires', 'Cryogénie', 'Sculpture sur glace', 'Bains nordiques'],
  desolande: ['Mécanique de fortune', 'Récupération', 'Archéologie aérienne', 'Mixologie du désert'],
  nuagelande: ['Plumasserie', 'Vapeur céleste', 'Aérostation', 'Onirologie'],
  infernia: ['Occultisme', 'Combustion infernale', 'Feu éternel', 'Jeux interdits'],
};

const TECH_EMOJIS = ['🏪', '🔩', '🏛️', '✨'];

export const TECHS: TechDef[] = (Object.keys(TREE) as CountryId[]).flatMap((countryId) =>
  TREE[countryId].map((ref, k): TechDef => {
    const effect: TechEffect =
      k === 1 ? { type: 'module', moduleId: ref } : k === 2 ? { type: 'deco', decoId: ref } : { type: 'shop', shopId: ref, resourcePct: k === 0 ? 0.1 : undefined };
    return {
      id: `${countryId}_${k}`,
      countryId,
      k,
      name: TECH_NAMES[countryId][k],
      emoji: TECH_EMOJIS[k],
      effect,
    };
  }),
);

export const TECH_BY_ID = Object.fromEntries(TECHS.map((t) => [t.id, t])) as Record<string, TechDef>;

import type { CountryId } from '../types';

export type VipPower = 'finish_build' | 'restock_all' | 'arrivals_x2' | 'flights_half' | 'miles';

export interface VipDef {
  id: string;
  name: string;
  emoji: string;
  /** Power VIPs act instantly; country VIPs carry a flight request. */
  power?: VipPower;
  countryId?: CountryId;
  line: string;
}

export const VIPS: VipDef[] = [
  { id: 'promoteur', name: 'Le Promoteur', emoji: '🏗️', power: 'finish_build', line: 'Je termine votre chantier en un claquement de doigts !' },
  { id: 'livreur', name: 'Le Livreur', emoji: '📦', power: 'restock_all', line: 'Livraison express pour tous les rayons vides !' },
  { id: 'influenceuse', name: "L'Influenceuse", emoji: '🤳', power: 'arrivals_x2', line: 'Je poste une story : deux fois plus de passagers pendant 10 min !' },
  { id: 'controleur', name: 'Le Contrôleur aérien', emoji: '🎧', power: 'flights_half', line: 'Je vous ouvre un couloir prioritaire : −50 % sur les vols en cours.' },
  { id: 'millionnaire', name: 'Le Millionnaire', emoji: '💰', power: 'miles', line: 'Tenez, quelques Miles pour la route. (+5 ✈️)' },

  { id: 'rockeur', name: 'Le Rockeur', emoji: '🎸', countryId: 'melodia', line: 'Je dois rentrer jouer à Mélodia, et je veux danser pendant le vol !' },
  { id: 'diva', name: 'La Diva', emoji: '🎤', countryId: 'melodia', line: 'Ma tournée reprend à Mélodia. Confort exigé, darling.' },
  { id: 'surfeuse', name: 'La Surfeuse', emoji: '🏄', countryId: 'tropicalia', line: 'La houle est parfaite à Tropicalia, on y va ?' },
  { id: 'touriste', name: 'Le Touriste à fleurs', emoji: '🌺', countryId: 'tropicalia', line: "J'ai déjà ma chemise, il me manque l'avion !" },
  { id: 'critique', name: 'La Critique gastronomique', emoji: '🧐', countryId: 'gourmandie', line: 'Je note aussi les repas en vol. Attention.' },
  { id: 'patissier', name: 'Le Pâtissier', emoji: '🧁', countryId: 'gourmandie', line: 'Mon soufflé ne supportera pas les secousses !' },
  { id: 'hackeuse', name: 'La Hackeuse', emoji: '💻', countryId: 'bitopia', line: 'Bitopia, et vite. Pas de questions.' },
  { id: 'streamer', name: 'Le Streamer', emoji: '🎮', countryId: 'bitopia', line: 'Salut le chat ! On décolle pour Bitopia !' },
  { id: 'explorateur', name: "L'Explorateur polaire", emoji: '🧭', countryId: 'givrebourg', line: 'Les glaces de Givrebourg m’appellent.' },
  { id: 'patineuse', name: 'La Patineuse', emoji: '⛸️', countryId: 'givrebourg', line: 'Mon championnat commence demain à Givrebourg !' },
  { id: 'ferrailleur', name: 'Le Ferrailleur', emoji: '🔧', countryId: 'desolande', line: 'Il paraît qu’il y a de la belle ferraille à Désolande.' },
  { id: 'nomade', name: 'La Nomade', emoji: '🐪', countryId: 'desolande', line: 'Je rentre chez moi, au milieu de nulle part.' },
  { id: 'poete', name: 'Le Poète rêveur', emoji: '📜', countryId: 'nuagelande', line: 'Emmenez-moi là où les nuages ont des rives…' },
  { id: 'aeronaute', name: "L'Aéronaute", emoji: '🎈', countryId: 'nuagelande', line: 'Mon ballon m’attend à Nuagelande.' },
  { id: 'demon', name: 'Le Démon en vacances', emoji: '😈', countryId: 'infernia', line: 'Fin des congés… retour à Infernia. Il fait trop froid ici.' },
  { id: 'sorciere', name: 'La Sorcière', emoji: '🧙', countryId: 'infernia', line: 'Un sabbat m’attend à Infernia. Pas de balai, pas de chance.' },
];

export const VIP_BY_ID = Object.fromEntries(VIPS.map((v) => [v.id, v])) as Record<string, VipDef>;
export const POWER_VIPS = VIPS.filter((v) => v.power);

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
  /**
   * The famous figure this VIP winks at, as a parody (silhouette, hair,
   * outfit, signature prop, twisted name) — never a real name or a copy of
   * a copyrighted character. The voxel look lives in src/render/models/vip.ts.
   */
  nod: string;
}

export const VIPS: VipDef[] = [
  { id: 'promoteur', name: 'Baron Béton', emoji: '🏗️', power: 'finish_build', line: 'Je termine votre chantier en un claquement de doigts. Et un cigare.', nod: 'le magnat du BTP à casque doré et cigare' },
  { id: 'livreur', name: 'Mercurio Colis', emoji: '📦', power: 'restock_all', line: 'Livraison express pour tous les rayons vides ! J\'ai des ailes aux chevilles.', nod: 'Mercure, messager des dieux au casque ailé' },
  { id: 'influenceuse', name: 'Stella Story', emoji: '🤳', power: 'arrivals_x2', line: 'Je poste une story : deux fois plus de passagers pendant 10 min !', nod: 'la star des réseaux, blond platine et perche à selfie' },
  { id: 'controleur', name: 'Major Tom-Tom', emoji: '🎧', power: 'flights_half', line: 'Ground control à la tour : −50 % sur les vols en cours.', nod: 'l\'astronaute perdu de la chanson spatiale des années 70' },
  { id: 'millionnaire', name: 'Lord Crésus', emoji: '💰', power: 'miles', line: 'Tenez, quelques Miles pour la route. (+5 ✈️)', nod: 'le roi Crésus en haut-de-forme, monocle et canne' },

  { id: 'rockeur', name: 'Elvoxel', emoji: '🎸', countryId: 'melodia', line: 'Thank you very much ! Mélodia m\'attend, et je veux danser pendant le vol.', nod: 'le King du rock : banane noire, rouflaquettes, combinaison blanche à paillettes' },
  { id: 'diva', name: 'Marylou Vocalise', emoji: '🎤', countryId: 'melodia', line: 'Ma tournée reprend à Mélodia. Confort exigé, darling.', nod: 'la blonde platine des années 50 en robe blanche, rouge à lèvres et micro' },
  { id: 'surfeuse', name: 'Kelly Swell', emoji: '🏄', countryId: 'tropicalia', line: 'La houle est parfaite à Tropicalia, on y va ?', nod: 'la championne de surf blonde et sa planche' },
  { id: 'touriste', name: 'Gérard Flash', emoji: '🌺', countryId: 'tropicalia', line: 'J\'ai déjà ma chemise à fleurs, il me manque l\'avion !', nod: 'le touriste de comédie : chemise hawaïenne, bob et appareil photo' },
  { id: 'critique', name: 'Lady Michétoile', emoji: '🧐', countryId: 'gourmandie', line: 'Je note aussi les repas en vol. Trois étoiles ou rien.', nod: 'la critique aux étoiles, monocle et carnet' },
  { id: 'patissier', name: 'Chef Ganache', emoji: '🧁', countryId: 'gourmandie', line: 'Mon soufflé ne supportera pas les secousses !', nod: 'le grand chef à toque géante et moustache en guidon' },
  { id: 'hackeuse', name: 'Néo-Lise', emoji: '💻', countryId: 'bitopia', line: 'Bitopia, et vite. Pas de questions. Pilule bleue ou rouge ?', nod: 'la hackeuse des films cyber : manteau noir, lunettes noires' },
  { id: 'streamer', name: 'xX_PewPixel_Xx', emoji: '🎮', countryId: 'bitopia', line: 'Salut le chat ! On décolle pour Bitopia !', nod: 'le streamer star : casque gamer, casquette à l\'envers, manette' },
  { id: 'explorateur', name: 'Capitaine Banquise', emoji: '🧭', countryId: 'givrebourg', line: 'Les glaces de Givrebourg m\'appellent. Rendez-vous au pôle.', nod: 'l\'explorateur polaire du début du XXᵉ siècle : parka à fourrure et lunettes' },
  { id: 'patineuse', name: 'Axelle Triplé', emoji: '⛸️', countryId: 'givrebourg', line: 'Mon championnat commence demain à Givrebourg !', nod: 'la reine du patinage en tenue pailletée' },
  { id: 'ferrailleur', name: 'Max Rouille', emoji: '🔧', countryId: 'desolande', line: 'Il paraît qu\'il y a de la belle ferraille à Désolande.', nod: 'le guerrier de la route post-apocalyptique : cuir, épaulette, lunettes' },
  { id: 'nomade', name: 'Laurence d\'Arabesque', emoji: '🐪', countryId: 'desolande', line: 'Je rentre chez moi, au milieu des dunes.', nod: 'l\'aventurier du désert en robes et keffieh blancs' },
  { id: 'poete', name: 'Victor Plume', emoji: '📜', countryId: 'nuagelande', line: 'Emmenez-moi là où les nuages ont des rives…', nod: 'le grand poète romantique à barbe blanche et plume' },
  { id: 'aeronaute', name: 'Phileas Fog', emoji: '🎈', countryId: 'nuagelande', line: 'Le tour du monde en 80 vols : prochaine étape, Nuagelande.', nod: 'le gentleman voyageur du roman de Jules Verne' },
  { id: 'demon', name: 'Méphisto Bronzé', emoji: '😈', countryId: 'infernia', line: 'Fin des congés… retour à Infernia. Il fait trop froid ici.', nod: 'Méphistophélès, le diable de Faust, en vacances' },
  { id: 'sorciere', name: 'Morgane la Fée', emoji: '🧙', countryId: 'infernia', line: 'Un sabbat m\'attend à Infernia. Pas de balai, pas de chance.', nod: 'la fée-sorcière des légendes arthuriennes, chapeau pointu et balai' },
];

export const VIP_BY_ID = Object.fromEntries(VIPS.map((v) => [v.id, v])) as Record<string, VipDef>;
export const POWER_VIPS = VIPS.filter((v) => v.power);

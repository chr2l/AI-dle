// Guided first steps: from the current onboarding mission (GDD §11) and the
// state, says which tab to open, which button to touch (its data-tuto key)
// and why. Pure, so it can be tested without a DOM.
import * as G from '../core';
import type { GameState } from '../core';
import { VIP_BY_ID } from '../core/data/vips';

export type Tab = 'tour' | 'vols' | 'equipe' | 'objectifs' | 'amis';

export interface GuideStep {
  tab: Tab;
  /** data-tuto key of the button to highlight on that tab. */
  target?: string;
  /** Sub-view of the Vols tab. */
  view?: 'avions' | 'pays' | 'recherche';
  text: string;
}

const idle = (s: GameState) => s.planes.filter((p) => !p.flight && !p.damaged);

export function guideStep(s: GameState, now: number): GuideStep | null {
  const mission = G.currentMission(s);
  if (!mission) return null;
  if (mission.done) return { tab: 'tour', target: 'mission', text: 'Mission accomplie ! Récupérez votre récompense.' };
  const building = s.floors.some((f) => f.buildEndsAt !== undefined);
  const landed = s.planes.find((p) => p.flight && p.flight.endsAt <= now);
  switch (mission.def.id) {
    case 'build':
    case 'build3':
      return building
        ? { tab: 'tour', target: 'rush-build', text: 'Le chantier avance tout seul. Attendez la fin du chrono, ou finissez-le tout de suite avec des Miles ✈️.' }
        : { tab: 'tour', target: 'build', text: 'Montez tout en haut (🏙️) et touchez « Construire » : chaque étage accueille un magasin.' };
    case 'shop':
      if (building) return { tab: 'tour', target: 'rush-build', text: 'Votre étage est en chantier. Dès qu’il est fini, vous pourrez y ouvrir un magasin.' };
      return { tab: 'tour', target: 'open', text: 'Étage prêt ! Touchez « Ouvrir un magasin » en bas de l’écran et choisissez un type de commerce.' };
    case 'restock':
      return { tab: 'tour', target: 'restock', text: 'Rayons vides ! Allez sur l’étage marqué ❗ (ascenseur à droite) et commandez un produit.' };
    case 'send':
      return idle(s).length
        ? { tab: 'vols', target: 'send', text: 'Des passagers 👥 attendent dans la salle d’embarquement. Touchez « Envoyer » et choisissez une destination.' }
        : { tab: 'vols', text: 'Vos avions sont occupés : attendez leur retour.' };
    case 'collect':
      return landed
        ? { tab: 'vols', target: 'collect', text: 'Votre avion est rentré ! Touchez « Récupérer » pour encaisser billets et ressources.' }
        : { tab: 'vols', target: 'rush-flight', text: 'Votre avion est en vol. Revenez à la fin du chrono pour le récupérer.' };
    case 'recruit':
      return { tab: 'equipe', target: 'recruit', text: 'Recrutez un équipier : il donnera un bonus à l’avion où vous l’affecterez.' };
    case 'assign':
      return { tab: 'equipe', target: 'assign', text: 'Touchez « Affecter » pour placer votre équipier dans un avion au sol.' };
    case 'upgrade':
      return { tab: 'vols', target: 'upgrade-plane', text: 'Améliorez une caractéristique de votre avion avec le bouton ⬆️ (vitesse, places, autonomie…).' };
    case 'shopup':
      return { tab: 'tour', target: 'upgrade-shop', text: 'Allez sur un magasin avec l’ascenseur et touchez « Améliorer » : il vendra plus vite.' };
    case 'research':
      return s.researching
        ? { tab: 'vols', view: 'recherche', target: 'rush-research', text: 'Recherche en cours : revenez à la fin du chrono.' }
        : { tab: 'vols', view: 'recherche', target: 'research', text: 'Dans « Recherche », lancez une technologie d’un pays visité (pièces + ressources du pays).' };
    case 'ring2':
      return { tab: 'vols', target: 'send', text: 'Atteignez le niveau 4 puis envoyez un avion vers Gourmandie ou Bitopia.' };
    case 'fusion':
      return { tab: 'tour', target: 'fusion', text: 'Montez tout en haut (🏙️) et touchez « Fusion » pour obtenir le plan d’un magasin plus rare.' };
    case 'vip':
      return { tab: 'tour', text: 'Quand un VIP arrive dans le hall, emmenez-le dans le pays qu’il demande avec un avion assez confortable.' };
    default:
      return { tab: 'tour', text: `${mission.def.text} (${mission.progress}/${mission.def.goal}).` };
  }
}

/** Small counters shown on the tab buttons: things waiting for the player. */
export function tabBadges(s: GameState, now: number): Record<Tab, number> {
  const tour =
    s.floors.filter((f) => f.shop && !f.shop.restock && f.shop.stock <= 1e-6).length +
    s.floors.filter((f) => f.buildEndsAt === undefined && !f.shop).length +
    (s.guide ? 1 : 0) +
    s.vips.filter((v) => VIP_POWER(v.defId)).length +
    (s.level >= 2 && G.freeBoxReadyAt(s) <= now ? 1 : 0);
  const vols =
    s.planes.filter((p) => p.flight && p.flight.endsAt <= now).length +
    s.reports.filter((r) => r.pending).length +
    (s.lounge.passengers >= 1 ? idle(s).length : 0);
  const freeAt = s.cooldowns.free_recruit ?? 0;
  const equipe = freeAt <= now && s.crew.length < G.MAX_CREW ? 1 : 0;
  const mission = G.currentMission(s);
  const daily = G.dailyStatus(s, now);
  G.refreshQuests(s, now);
  const quests = G.questViews(s, now).filter((q) => q.done && !q.claimed).length;
  const chest = !s.quests.chestClaimed && s.quests.claimed.every(Boolean) ? 1 : 0;
  const achievements = G.achievementViews(s).filter((a) => a.done && !a.claimed).length;
  const season = G.seasonView(s, now)?.track.filter((t) => t.reached && !t.claimed).length ?? 0;
  const dex = s.level >= 2 ? G.dexClaimable(s) : 0;
  const objectifs = (mission?.done ? 1 : 0) + (daily.available ? 1 : 0) + quests + chest + achievements + season + dex;
  const last = s.social.lastWeek;
  const amis = last && !last.claimed ? 1 : 0;
  return { tour, vols, equipe, objectifs, amis };
}

const VIP_POWER = (id: string) => !!VIP_BY_ID[id]?.power;

/**
 * Progressive unlocking: the game opens one tab or feature at a time,
 * following the onboarding missions (GDD §11) or the airport level for
 * players who skip them.
 */
export const FEATURES = {
  objectifs: { name: 'Objectifs', icon: '🎯', text: 'Missions, cadeau du jour, quêtes et succès : de quoi gagner des Miles ✈️.', when: (s: GameState) => s.missionIndex >= 1 || s.level >= 2 },
  vols: { name: 'Vols', icon: '✈️', text: 'Vos avions emmènent les passagers vers les pays : billets et ressources au retour.', when: (s: GameState) => s.missionIndex >= 3 || s.level >= 2 },
  equipe: { name: 'Équipe', icon: '👨‍✈️', text: 'Recrutez pilotes, hôtes et mécanos pour rendre vos avions meilleurs.', when: (s: GameState) => s.missionIndex >= 6 || s.level >= 3 },
  recherche: { name: 'Recherche', icon: '🔬', text: 'Dans Vols : dépensez les ressources des pays pour débloquer magasins, équipements et décorations.', when: (s: GameState) => s.missionIndex >= 10 || s.level >= 3 },
  labo: { name: 'Laboratoire', icon: '🧪', text: 'Dans Tour : fusionnez deux magasins pour obtenir un magasin plus rare.', when: (s: GameState) => s.level >= G.FUSION_LEVEL },
  amis: { name: 'Amis', icon: '👋', text: 'Codes ami, cadeaux, visites et classement de la semaine.', when: (s: GameState) => s.level >= 3 },
  saison: { name: 'Événements', icon: '🎉', text: 'Dans Objectifs : les événements saisonniers et leurs récompenses exclusives.', when: (s: GameState) => s.level >= 2 },
  boites: { name: 'Boîtes de plans', icon: '🎁', text: 'Dans Tour (🏙️ vue d’ensemble) : ouvrez des boîtes pour gagner des magasins plus ou moins rares, ou pariez sur la rareté d’un magasin neuf.', when: (s: GameState) => s.level >= 2 },
  dex: { name: 'Dex', icon: '📖', text: 'Dans Objectifs : votre collection de magasins, VIP, avions, pays et événements, avec des Miles à chaque palier.', when: (s: GameState) => s.level >= 2 },
  franchise: { name: 'Franchise', icon: '🌟', text: 'Dans Tour : recommencez avec des étoiles de prestige qui augmentent tous vos gains.', when: (s: GameState) => s.level >= G.FRANCHISE_LEVEL - 2 },
} as const;

export type Feature = keyof typeof FEATURES;

export function unlocked(s: GameState): Set<Feature> {
  return new Set((Object.keys(FEATURES) as Feature[]).filter((f) => FEATURES[f].when(s)));
}

export const isTabOpen = (tab: Tab, open: Set<Feature>) => tab === 'tour' || open.has(tab as Feature);

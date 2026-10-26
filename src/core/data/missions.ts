import type { GameState } from '../types';

export interface MissionDef {
  id: string;
  text: string;
  goal: number;
  progress: (s: GameState) => number;
  miles: number;
  coins?: number;
}

const RING_2 = ['gourmandie', 'bitopia'] as const;

/** Onboarding chain (GDD §11), done in order. */
export const MISSIONS: MissionDef[] = [
  { id: 'build', text: 'Construire un étage', goal: 1, progress: (s) => s.stats.floorsBuilt, miles: 2, coins: 100 },
  { id: 'shop', text: 'Ouvrir un magasin', goal: 1, progress: (s) => s.stats.shopsOpened, miles: 2 },
  { id: 'restock', text: 'Réapprovisionner un rayon', goal: 1, progress: (s) => s.stats.restocks, miles: 2 },
  { id: 'send', text: 'Envoyer un vol', goal: 1, progress: (s) => s.stats.flightsSent, miles: 2 },
  { id: 'collect', text: 'Collecter un avion', goal: 1, progress: (s) => s.stats.flightsCollected, miles: 3 },
  { id: 'build3', text: 'Avoir 3 étages', goal: 3, progress: (s) => s.stats.floorsBuilt, miles: 3 },
  { id: 'recruit', text: 'Recruter un équipier', goal: 1, progress: (s) => s.stats.recruits, miles: 3, coins: 500 },
  { id: 'assign', text: 'Assigner un équipier à un avion', goal: 1, progress: (s) => s.stats.crewAssigned, miles: 3 },
  { id: 'upgrade', text: 'Améliorer un avion', goal: 1, progress: (s) => s.stats.planeUpgrades, miles: 3 },
  { id: 'shopup', text: 'Améliorer un magasin', goal: 1, progress: (s) => s.stats.shopUpgrades, miles: 3 },
  { id: 'research', text: 'Terminer une recherche', goal: 1, progress: (s) => s.stats.researchDone, miles: 5 },
  { id: 'level4', text: "Atteindre le niveau d'aéroport 4", goal: 4, progress: (s) => s.level, miles: 5 },
  { id: 'ring2', text: "Visiter un pays de l'anneau 2", goal: 1, progress: (s) => (RING_2.some((c) => s.discovered.includes(c)) ? 1 : 0), miles: 5 },
  { id: 'fusion', text: 'Fusionner deux magasins', goal: 1, progress: (s) => s.stats.fusions, miles: 5 },
  { id: 'vip', text: 'Satisfaire un VIP', goal: 1, progress: (s) => s.stats.vipsServed, miles: 10 },
];

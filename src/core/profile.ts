// Career statistics shown on the profile screen (plan de polish IP-28).
import type { GameState } from './types';

export interface CareerLine {
  icon: string;
  label: string;
  value: number;
  /** Shown as a coin amount (formatted by the interface). */
  coins?: boolean;
}

/** Days since the airport opened, counting the first day as day 1. */
export const daysPlayed = (state: GameState, now: number) => Math.max(1, Math.floor((now - state.createdAt) / 86_400_000) + 1);

export function careerLines(state: GameState, now: number): CareerLine[] {
  const s = state.stats;
  const lines: CareerLine[] = [
    { icon: '📅', label: 'Jours d’exploitation', value: daysPlayed(state, now) },
    { icon: '🪙', label: 'Pièces gagnées', value: Math.floor(s.totalCoins), coins: true },
    { icon: '🏗️', label: 'Étages construits', value: s.floorsBuilt },
    { icon: '🏪', label: 'Magasins ouverts', value: s.shopsOpened },
    { icon: '📦', label: 'Réapprovisionnements', value: s.restocks },
    { icon: '🛫', label: 'Vols effectués', value: s.flightsSent },
    { icon: '🛩️', label: 'Avions achetés', value: s.planesBought },
    { icon: '🧑‍✈️', label: 'Membres d’équipage recrutés', value: s.recruits },
    { icon: '🌟', label: 'VIP servis', value: s.vipsServed },
    { icon: '🌍', label: 'Pays découverts', value: state.discovered.length },
    { icon: '🔬', label: 'Recherches terminées', value: s.researchDone },
    { icon: '🧬', label: 'Fusions', value: s.fusions },
    { icon: '🎁', label: 'Boîtes ouvertes', value: s.boxesOpened },
    { icon: '🏢', label: 'Franchises', value: state.prestige.count },
  ];
  // Keep the screen short: lines at zero only for the basics.
  return lines.filter((l, i) => i < 6 || l.value > 0);
}

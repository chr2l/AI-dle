// Mid-game conveniences (plan de polish IP-14): once the tower and the fleet
// grow, collecting planes and restocking shelves one by one becomes a chore.
// These group the same actions; they cost the same and give the same rewards.
import { RESTOCK_TIERS } from './data/shops';
import { type Result, collectFlight, restock } from './engine';
import type { Rng } from './rng';
import type { FlightReport, GameState } from './types';

/** Level that unlocks « Tout récupérer » (Vols). */
export const COLLECT_ALL_LEVEL = 4;
/** Level that unlocks « Tout réapprovisionner » (Tour). */
export const RESTOCK_ALL_LEVEL = 6;

export const landedPlanes = (state: GameState, now: number) => state.planes.filter((p) => p.flight && p.flight.endsAt <= now);

/** Floors whose shop is empty and not being restocked. */
export const emptyFloors = (state: GameState) =>
  state.floors.flatMap((f, i) => (f.shop && !f.shop.restock && f.shop.stock <= 1e-6 ? [i] : []));

/** Collects every landed plane. Reports with an event choice stay pending, as with one plane. */
export function collectAll(state: GameState, now: number, rng: Rng = Math.random): Result<FlightReport[]> {
  if (state.level < COLLECT_ALL_LEVEL) return { ok: false, error: `Niveau ${COLLECT_ALL_LEVEL} requis.` };
  const planes = landedPlanes(state, now);
  if (!planes.length) return { ok: false, error: 'Aucun avion à récupérer.' };
  const reports: FlightReport[] = [];
  for (const p of planes) {
    const res = collectFlight(state, p.uid, now, rng);
    if (res.ok) reports.push(res.value);
  }
  return { ok: true, value: reports };
}

/** Restocks every empty shop with the same product size. Returns how many floors. */
export function restockAll(state: GameState, tier: number, now: number): Result<number> {
  if (state.level < RESTOCK_ALL_LEVEL) return { ok: false, error: `Niveau ${RESTOCK_ALL_LEVEL} requis.` };
  if (!RESTOCK_TIERS[tier]) return { ok: false, error: 'Produit inconnu.' };
  const floors = emptyFloors(state);
  if (!floors.length) return { ok: false, error: 'Aucun rayon vide.' };
  let n = 0;
  for (const i of floors) if (restock(state, i, tier, now).ok) n++;
  return { ok: true, value: n };
}

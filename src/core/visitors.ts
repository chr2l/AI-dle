// Hall visitors: VIPs (GDD §5) and passengers to guide (GDD §4.7).
import { COUNTRY_BY_ID } from './data/countries';
import { MODULES } from './data/planes';
import { SHOP_BY_ID } from './data/shops';
import { POWER_VIPS, VIPS, VIP_BY_ID } from './data/vips';
import { type Result, finishBuild, restockExpress, speedUpFlight, unlockedRing } from './engine';
import {
  ARRIVALS_X2_SECONDS,
  COUNTRY_VIP_CHANCE,
  COUNTRY_VIP_STAY_SECONDS,
  GUIDE_CHANCE,
  GUIDE_CHECK_SECONDS,
  GUIDE_MILE_CHANCE,
  GUIDE_STAY_SECONDS,
  MAX_VIPS_WAITING,
  MAX_VISITOR_CHECKS,
  MILLIONAIRE_MILES,
  POWER_VIP_CHANCE,
  POWER_VIP_STAY_SECONDS,
  VIP_CHECK_SECONDS,
  guideTip,
  vipMinComfort,
} from './formulas';
import { type Rng, pick, uid } from './rng';
import { decoBonuses, researchedModules } from './stats';
import type { CountryId, GameState, VipState } from './types';

const fail = (error: string): Result<never> => ({ ok: false, error });
const done: Result = { ok: true, value: undefined };

/** Number of periodic checks due since `last`, and the new reference time. */
function dueChecks(last: number, now: number, periodSec: number): [number, number] {
  const due = Math.floor((now - last) / (periodSec * 1000));
  if (due <= 0) return [0, last];
  return [Math.min(due, MAX_VISITOR_CHECKS), last + due * periodSec * 1000];
}

export function countryVipDemand(state: GameState, countryId: CountryId): VipState['demand'] {
  const ring = COUNTRY_BY_ID[countryId].ring;
  const module = MODULES.find((m) => m.countryId === countryId);
  const researched = module && researchedModules(state).has(module.id);
  return { countryId, minComfort: vipMinComfort(ring), moduleId: researched ? module.id : undefined };
}

function spawnVips(state: GameState, now: number, rng: Rng) {
  const chanceMult = 1 + decoBonuses(state).vipChancePct;
  const shops = state.floors.map((f) => f.shop && SHOP_BY_ID[f.shop.defId]).filter((d) => !!d);
  const waiting = () => state.vips.filter((v) => v.expiresAt > now).length;

  const neutral = shops.filter((d) => d.elements.includes('neutre')).length;
  if (waiting() < MAX_VIPS_WAITING && rng() < neutral * POWER_VIP_CHANCE * chanceMult) {
    const def = pick(rng, POWER_VIPS);
    state.vips.push({ uid: uid('vip', rng), defId: def.id, expiresAt: now + POWER_VIP_STAY_SECONDS * 1000 });
  }

  const ring = unlockedRing(state);
  const byCountry = new Map<CountryId, number>();
  for (const d of shops) {
    for (const e of d.elements) {
      if (e !== 'neutre' && COUNTRY_BY_ID[e].ring <= ring) byCountry.set(e, (byCountry.get(e) ?? 0) + 1);
    }
  }
  for (const [countryId, count] of byCountry) {
    if (waiting() >= MAX_VIPS_WAITING || rng() >= count * COUNTRY_VIP_CHANCE * chanceMult) continue;
    const defs = VIPS.filter((v) => v.countryId === countryId);
    state.vips.push({
      uid: uid('vip', rng),
      defId: pick(rng, defs).id,
      expiresAt: now + COUNTRY_VIP_STAY_SECONDS * 1000,
      demand: countryVipDemand(state, countryId),
    });
  }
}

function spawnGuide(state: GameState, now: number, rng: Rng) {
  if (state.guide && state.guide.expiresAt > now) return;
  delete state.guide;
  const floors = state.floors.map((f, i) => (f.shop ? i + 1 : 0)).filter((n) => n > 0);
  if (floors.length === 0 || rng() >= GUIDE_CHANCE) return;
  state.guide = { floor: pick(rng, floors), expiresAt: now + GUIDE_STAY_SECONDS * 1000 };
}

/** Runs the periodic VIP and guide rolls that are due (called by `update`). */
export function spawnVisitors(state: GameState, now: number, rng: Rng = Math.random) {
  const [vipChecks, vipRef] = dueChecks(state.timers.vipCheck, now, VIP_CHECK_SECONDS);
  for (let i = 0; i < vipChecks; i++) spawnVips(state, now, rng);
  state.timers.vipCheck = vipRef;

  const [guideChecks, guideRef] = dueChecks(state.timers.guideCheck, now, GUIDE_CHECK_SECONDS);
  if (guideChecks > 0) spawnGuide(state, now, rng);
  state.timers.guideCheck = guideRef;
  if (state.guide && state.guide.expiresAt <= now) delete state.guide;
}

/** Taps a power VIP waiting in the hall. */
export function useVip(state: GameState, vipUid: string, now: number): Result {
  const vip = state.vips.find((v) => v.uid === vipUid && v.expiresAt > now);
  const power = vip && VIP_BY_ID[vip.defId]?.power;
  if (!vip || !power) return fail('Ce VIP ne peut pas être utilisé.');
  switch (power) {
    case 'finish_build': {
      const res = finishBuild(state, now);
      if (!res.ok) return res;
      break;
    }
    case 'restock_all': {
      const empty = state.floors
        .map((f, i) => (f.shop && !f.shop.restock && f.shop.stock <= 1e-6 ? i : -1))
        .filter((i) => i >= 0);
      if (empty.length === 0) return fail('Aucun rayon vide.');
      for (const i of empty) restockExpress(state, i, 0, now);
      break;
    }
    case 'arrivals_x2':
      state.boosts.arrivalsX2Until = Math.max(now, state.boosts.arrivalsX2Until ?? 0) + ARRIVALS_X2_SECONDS * 1000;
      break;
    case 'flights_half': {
      const flying = state.planes.filter((p) => p.flight && p.flight.endsAt > now);
      if (flying.length === 0) return fail('Aucun vol en cours.');
      for (const p of flying) speedUpFlight(state, p.uid, now, false);
      break;
    }
    case 'miles':
      state.miles += MILLIONAIRE_MILES;
      break;
  }
  state.vips = state.vips.filter((v) => v.uid !== vipUid);
  state.stats.vipsUsed++;
  return done;
}

/** Guides the waiting passenger to their floor: tip and a small chance of 1 Mile. */
export function guidePassenger(state: GameState, floor: number, now: number, rng: Rng = Math.random): Result<{ coins: number; miles: number }> {
  const guide = state.guide;
  if (!guide || guide.expiresAt <= now) return fail('Aucun passager à guider.');
  delete state.guide;
  if (floor !== guide.floor) return fail('Mauvais étage, le passager est reparti vexé.');
  const coins = guideTip(guide.floor);
  const miles = rng() < GUIDE_MILE_CHANCE ? 1 : 0;
  state.coins += coins;
  state.stats.totalCoins += coins;
  state.miles += miles;
  state.stats.guided++;
  return { ok: true, value: { coins, miles } };
}

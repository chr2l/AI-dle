// Economy simulation: a scripted player plays several days of game time and
// we print the pacing (level, floors, income, fleet, countries).
// Run with `npm run simulate`. Not part of `npm test`.
import { test } from 'vitest';
import { COUNTRIES } from '../src/core/data/countries';
import { PLANE_MODELS } from '../src/core/data/planes';
import { RARITY_INFO, SHOP_BY_ID } from '../src/core/data/shops';
import { TECHS } from '../src/core/data/research';
import { VIP_BY_ID } from '../src/core/data/vips';
import { CATEGORY_IDS } from '../src/core/data/shops';
import { destinationsFor } from '../src/core/destinations';
import {
  assignCrew,
  buildFloor,
  buyPlane,
  canFly,
  optionChance,
  collectFlight,
  openShop,
  recruit,
  repairPlane,
  resolveEvent,
  restock,
  sendFlight,
  startResearch,
  unlockedRing,
  upgradeLounge,
  upgradePlane,
  upgradeShop,
} from '../src/core/engine';
import { EVENT_BY_ID } from '../src/core/data/events';
import { buildCost, flightDuration, hangarSize, maxFloors, planeUpgradeCost, recruitCost, researchCost, shopUpgradeCost, ticketIncome } from '../src/core/formulas';
import { startFusion } from '../src/core/fusion';
import { claimMission, update } from '../src/core/game';
import { mulberry32 } from '../src/core/rng';
import { createInitialState } from '../src/core/state';
import { loungeCap, planeStats, totalShopRate } from '../src/core/stats';
import type { Destination, GameState, StatKey } from '../src/core/types';
import { useVip } from '../src/core/visitors';

const DAYS = 10;
/** Player sessions: `SESSION_MIN` minutes online every `GAP_MIN` minutes, 8 h of sleep per day. */
const SESSION_MIN = 10;
const GAP_MIN = 90;
const STEP_S = 10;

const T0 = Date.UTC(2027, 0, 1, 8);
const rng = mulberry32(1234);

function bestDestination(state: GameState, planeUid: string, now: number): Destination | undefined {
  const plane = state.planes.find((p) => p.uid === planeUid)!;
  const stats = planeStats(state, plane);
  const ring = unlockedRing(state);
  let best: Destination | undefined;
  let bestScore = -1;
  for (const c of COUNTRIES) {
    if (c.ring > ring) continue;
    for (const d of destinationsFor(state.seed, c.id, now)) {
      if (!canFly(state, plane, d).ok) continue;
      const pax = Math.min(stats.capacity, Math.floor(state.lounge.passengers));
      let score = ticketIncome(d.distance, pax, stats.comfort) / flightDuration(d.distance, stats.speed);
      if (!state.discovered.includes(c.id)) score *= 10;
      if (score > bestScore) {
        best = d;
        bestScore = score;
      }
    }
  }
  return best;
}

const milesFrom: Record<string, number> = {};
const track = (state: GameState, key: string, fn: () => unknown) => {
  const before = state.miles;
  fn();
  milesFrom[key] = (milesFrom[key] ?? 0) + Math.max(0, state.miles - before);
};

function playSession(state: GameState, now: number, leaving: boolean) {
  track(state, 'missions', () => { while (claimMission(state).ok); });

  // Hall VIPs with a power: use them right away.
  for (const v of [...state.vips]) if (VIP_BY_ID[v.defId].power) track(state, 'vip:' + v.defId, () => useVip(state, v.uid, now));

  // Flights.
  for (const p of state.planes) {
    if (p.flight && p.flight.endsAt <= now) {
      const before = state.miles;
      const res = collectFlight(state, p.uid, now, rng);
      const report = res.ok ? res.value : undefined;
      const key = report?.event ? 'ev:' + report.event.defId : 'collect';
      milesFrom[key] = (milesFrom[key] ?? 0) + state.miles - before;
      if (report?.pending) {
        const options = EVENT_BY_ID[report.event!.defId].options!;
        const scored = options.map((o, i) => ({ i, c: optionChance(state, p, report.countryId, o.chance) }));
        const pickIdx = scored.find((s) => s.c >= 0.6)?.i ?? scored.sort((a, b) => b.c - a.c)[0].i;
        track(state, key, () => resolveEvent(state, report.id, pickIdx, rng));
      }
    }
    if (p.damaged && p.repairEndsAt === undefined) repairPlane(state, p.uid, 'coins', now);
  }
  for (const p of state.planes) {
    if (p.flight || p.damaged) continue;
    const dest = bestDestination(state, p.uid, now);
    if (!dest) continue;
    const vips = state.vips
      .filter((v) => v.demand?.countryId === dest.countryId && planeStats(state, p).comfort >= v.demand.minComfort && !v.demand.moduleId)
      .map((v) => v.uid);
    sendFlight(state, p.uid, dest, now, vips);
  }

  // Shops: restock (big when leaving), open, build.
  state.floors.forEach((f, i) => {
    if (f.shop && !f.shop.restock && f.shop.stock <= 1e-6) restock(state, i, leaving ? 2 : 1, now);
    if (f.buildEndsAt === undefined && !f.shop) {
      const cats = [...CATEGORY_IDS].sort(() => rng() - 0.5);
      for (const c of cats) if (openShop(state, i, c, rng).ok) break;
      restock(state, i, leaving ? 2 : 0, now);
    }
  });

  // Spending, cheapest useful thing first, a few times.
  for (let k = 0; k < 60; k++) {
    const options: { cost: number; act: () => boolean }[] = [];
    if (state.floors.length < maxFloors(state.level) && !state.floors.some((f) => f.buildEndsAt))
      options.push({ cost: buildCost(state.floors.length + 1) * 0.7, act: () => buildFloor(state, now).ok });
    if (state.planes.length < hangarSize(state.level)) {
      const model = [...PLANE_MODELS].reverse().find((m) => m.level <= state.level && m.price > 0);
      if (model) options.push({ cost: model.price, act: () => buyPlane(state, model.id, rng).ok });
    }
    const seats = state.planes.length * 3;
    if (state.crew.length < seats) options.push({ cost: recruitCost(state.level), act: () => recruit(state, 'coins', now, rng).ok });
    if (state.lounge.passengers >= loungeCap(state) - 1)
      options.push({ cost: 400 * 2 ** (state.lounge.level - 1), act: () => upgradeLounge(state).ok });
    if (!state.researching) {
      const tech = TECHS.find((t) => !state.research.includes(t.id) && state.discovered.includes(t.countryId) &&
        (t.k === 0 || state.research.includes(`${t.countryId}_${t.k - 1}`)) &&
        state.resources[t.countryId] >= researchCost(COUNTRIES.find((c) => c.id === t.countryId)!.ring, t.k).resource);
      if (tech) options.push({ cost: researchCost(COUNTRIES.find((c) => c.id === tech.countryId)!.ring, tech.k).coins, act: () => startResearch(state, tech.id, now).ok });
    }
    for (const p of state.planes) {
      for (const stat of ['speed', 'capacity', 'comfort', 'range', 'reliability'] as StatKey[]) {
        if (p.upgrades[stat] >= 10) continue;
        options.push({ cost: planeUpgradeCost(PLANE_MODELS.find((m) => m.id === p.modelId)!.price, p.upgrades[stat]) * 1.5, act: () => upgradePlane(state, p.uid, stat).ok });
      }
    }
    state.floors.forEach((f, i) => {
      if (f.shop && f.shop.level < 20)
        options.push({ cost: shopUpgradeCost(SHOP_BY_ID[f.shop.defId].rarity, f.shop.level) / RARITY_INFO[SHOP_BY_ID[f.shop.defId].rarity].rate, act: () => upgradeShop(state, i).ok });
    });
    if (state.level >= 3 && !state.fusion && state.floors.filter((f) => f.shop).length >= 2) {
      const shops = state.floors.map((f, i) => (f.shop ? i : -1)).filter((i) => i >= 0);
      options.push({ cost: 3000, act: () => startFusion(state, shops[0], shops[1], now, rng).ok });
    }
    options.sort((a, b) => a.cost - b.cost);
    const next = options.find((o) => o.cost <= state.coins);
    if (!next || !next.act()) break;
  }
  // Plans: place on empty floors.
  state.floors.forEach((f) => {
    if (!f.shop && f.buildEndsAt === undefined && state.plans.length) {
      f.shop = { defId: state.plans.shift()!, level: 1, stars: 1, stock: 0 };
    }
  });
  // Crew: fill empty seats.
  for (const c of state.crew.filter((c) => !c.planeUid)) {
    const plane = state.planes.find((p) => !p.flight && !p.crew[c.role]);
    if (plane) assignCrew(state, c.uid, plane.uid);
  }
}

test('economy pacing', () => {
  const state = createInitialState(T0, 99);
  const rows: string[] = [];
  const levelAt: Record<number, number> = {};
  const end = T0 + DAYS * 24 * 3600 * 1000;
  let nextReport = T0 + 6 * 3600 * 1000;
  for (let now = T0; now <= end; now += STEP_S * 1000) {
    const minuteOfDay = ((now - T0) / 60000) % (24 * 60);
    const awake = minuteOfDay < 16 * 60;
    const inSession = awake && minuteOfDay % GAP_MIN < SESSION_MIN;
    update(state, now, rng);
    if (inSession) {
      const leaving = minuteOfDay % GAP_MIN >= SESSION_MIN - STEP_S / 60;
      playSession(state, now, leaving);
    }
    if (!(state.level in levelAt)) levelAt[state.level] = now;
    if (now >= nextReport) {
      nextReport += 24 * 3600 * 1000;
      rows.push(
        [
          `${((now - T0) / 3600000).toFixed(0).padStart(4)} h`,
          `niv ${String(state.level).padStart(2)}`,
          `étages ${String(state.floors.length).padStart(2)}`,
          `${totalShopRate(state).toFixed(1).padStart(6)} 🪙/s`,
          `🪙 ${Math.floor(state.coins).toString().padStart(9)}`,
          `✈️ ${String(state.miles).padStart(4)}`,
          `avions ${state.planes.map((p) => p.modelId).join(',')}`,
          `équipage ${state.crew.length}`,
          `pays ${state.discovered.length}`,
          `recherches ${state.research.length}`,
          `mission ${state.missionIndex}`,
        ].join(' · '),
      );
    }
  }
  console.log(rows.join('\n'));
  console.log(
    'Niveau atteint après (h) :',
    Object.entries(levelAt).map(([l, t]) => `${l}:${((t - T0) / 3600000).toFixed(1)}`).join('  '),
  );
  console.log('Miles :', JSON.stringify(Object.entries(milesFrom).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])));
  console.log('Stats :', JSON.stringify(state.stats));
});

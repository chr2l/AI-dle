// Pure balancing formulas from docs/GDD.md. Durations are in seconds.
import { RARITY_INFO } from './data/shops';
import type { Rarity } from './types';

// --- Tower (GDD §4) ----------------------------------------------------------

/** Cost of building floor n (1-based). */
export const buildCost = (n: number) => Math.round(150 * 1.45 ** (n - 1));
export const buildDuration = (n: number) => Math.min(6 * 3600, 15 * n ** 1.3);
export const maxFloors = (level: number) => 6 + 3 * level;

export const MAX_SHOP_LEVEL = 20;
export const MAX_STARS = 5;
export const REROLL_MILES = 5;
export const shopUpgradeCost = (rarity: Rarity, level: number) =>
  Math.round(RARITY_INFO[rarity].rate * 60 * 1.7 ** (level - 1));
export const ADJACENCY_BONUS = 0.1;
export const TRAFFIC_BONUS = 0.1;
export const CARNET_BONUS = 0.01;

export const arrivalsPerSec = (shops: number) => 0.3 + 0.05 * shops;
export const loungeCapacity = (loungeLevel: number) => 20 + 10 * loungeLevel;
export const loungeUpgradeCost = (loungeLevel: number) => Math.round(400 * 2 ** (loungeLevel - 1));
export const MAX_LOUNGE_LEVEL = 10;

// --- Airport level (GDD §10) -------------------------------------------------

export const xpToNext = (level: number) => Math.round(150 * level ** 2);
/** Spending builds reputation (√cost / 4), so coins always turn into progression, with diminishing returns. */
export const spendXp = (cost: number) => Math.round(Math.sqrt(cost) / 4);
export const hangarSize = (level: number) => 2 + Math.floor(level / 3);
export const FUSION_LEVEL = 3;

// --- Planes & flights (GDD §6, §8) -----------------------------------------

export const planeUpgradeCost = (price: number, level: number) =>
  Math.round(Math.max(500, price) * 0.15 * 1.5 ** level);
export const UPGRADE_STEP = { speed: 0.08, capacity: 0.1, range: 0.1, comfort: 1, reliability: 4 } as const;
export const MAX_RELIABILITY = 99;

/** Round trip duration. */
export const flightDuration = (distance: number, speed: number) => (distance / speed) * 150;
export const ticketIncome = (distance: number, passengers: number, comfort: number) =>
  (5 + 0.05 * distance) * passengers * (1 + 0.04 * comfort);
export const resourceIncome = (passengers: number, ring: number) => (5 + 0.5 * passengers) * ring;
export const flightXp = (ring: number) => 5 * ring;
export const flightCrewXp = (ring: number) => 10 * ring;

export const repairCost = (price: number) => Math.round(Math.max(500, price) * 0.1);
export const REPAIR_SECONDS = 10 * 60;

export const MODIFIER_INFO = {
  calme: { name: 'Calme', weight: 50, coins: 1, resource: 1 },
  festival: { name: 'Festival', weight: 15, coins: 1, resource: 1.5 },
  ruee: { name: 'Ruée', weight: 15, coins: 1.5, resource: 1 },
  tempete: { name: 'Tempête', weight: 10, coins: 2, resource: 2 },
  mystere: { name: 'Mystère', weight: 0, coins: 1, resource: 1 },
} as const;
export const MYSTERY_CHANCE = 0.1;
export const DESTINATIONS_PER_COUNTRY = 3;
export const DESTINATION_WINDOW_MS = 4 * 3600 * 1000;

// --- Events (GDD §8.4) -------------------------------------------------------

export const EVENT_CHANCE = 0.7;
/** Short hops roll fewer events (×0.25 under ~4 min, full chance from 15 min), so quick ring-1 loops do not farm Miles. */
export const eventChance = (durationSec: number) => EVENT_CHANCE * Math.min(1, Math.max(0.25, durationSec / 900));
/** Chance to dodge a malus per point of reliability. */
export const AVOID_PER_RELIABILITY = 0.006;
export const AFFINITY_BONUS = 0.15;
export const MODULE_EVENT_BONUS = 0.15;

// --- VIP (GDD §5.2) ----------------------------------------------------------

export const vipCoins = (ring: number) => 500 * 3 ** (ring - 1);
export const vipResource = (ring: number) => 20 * ring;
export const VIP_MILES = 3;
export const VIP_XP = 40;

// --- Crew (GDD §7) -----------------------------------------------------------

export const recruitCost = (level: number) => 500 * level;
export const MAX_CREW = 30;
export const FREE_RECRUIT_COOLDOWN_MS = 4 * 3600 * 1000;
export const crewXpToNext = (level: number) => Math.round(20 * level ** 1.5);
/** Seat bonuses per (power × level). Not in the GDD yet: tuned so a level 40 legend gives +60 % speed. */
export const PILOT_SPEED_PER_POINT = 0.005;
export const CABIN_COMFORT_PER_POINT = 0.1;
export const MECHANIC_RELIABILITY_PER_POINT = 0.5;

// --- Research (GDD §9) -------------------------------------------------------

export const researchCost = (ring: number, k: number) => ({
  resource: Math.round(15 * ring * 2.2 ** k),
  coins: Math.round(500 * 3 ** (ring - 1) * 2 ** k),
});
export const researchDuration = (ring: number, k: number) => 60 * 2.5 ** k * ring;
export const RESEARCH_XP = 30;

// --- Fusion (GDD §4.6) -------------------------------------------------------

export const fusionCost = (rankA: number, rankB: number) => 300 * (rankA + rankB);
export const fusionDuration = (rankA: number, rankB: number) => 120 * (rankA + rankB);

// --- Visitors: VIPs and guided passengers (GDD §4.7, §5) ---------------------

export const VIP_CHECK_SECONDS = 60;
/** Per neutral shop, per check. */
export const POWER_VIP_CHANCE = 0.005;
/** Cap on the per-check chance, whatever the number of shops. */
export const MAX_VIP_CHANCE = 0.05;
/** Per country shop, per check. */
export const COUNTRY_VIP_CHANCE = 0.01;
export const MAX_VIPS_WAITING = 4;
export const POWER_VIP_STAY_SECONDS = 10 * 60;
export const COUNTRY_VIP_STAY_SECONDS = 30 * 60;
export const vipMinComfort = (ring: number) => 2 + 2 * ring;
export const ARRIVALS_X2_SECONDS = 10 * 60;
export const MILLIONAIRE_MILES = 5;

export const GUIDE_CHECK_SECONDS = 30;
export const GUIDE_CHANCE = 0.25;
export const GUIDE_STAY_SECONDS = 60;
export const guideTip = (floor: number) => 5 * floor;
export const GUIDE_MILE_CHANCE = 0.05;

/** Offline catch-up is capped so a long absence does not flood the hall. */
export const MAX_VISITOR_CHECKS = 10;

// --- Miles speed-ups (GDD §3) ------------------------------------------------

/** 1 Mile per started 10 minutes remaining. */
export const rushCost = (remainingSec: number) => Math.max(1, Math.ceil(remainingSec / 600));

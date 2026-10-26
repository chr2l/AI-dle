export type Rarity = 'C' | 'R' | 'E' | 'L';

export type CountryId =
  | 'melodia'
  | 'tropicalia'
  | 'gourmandie'
  | 'bitopia'
  | 'givrebourg'
  | 'desolande'
  | 'nuagelande'
  | 'infernia';

/** Element = a country affinity, or 'neutre' for generic content. */
export type Element = CountryId | 'neutre';

export type ShopCategory = 'resto' | 'boutique' | 'detente' | 'service' | 'loisir';

export type StatKey = 'speed' | 'capacity' | 'range' | 'comfort' | 'reliability';

export type CrewRole = 'pilot' | 'cabin' | 'mechanic';

export type DestinationModifier = 'calme' | 'festival' | 'ruee' | 'tempete' | 'mystere';

export type PayMethod = 'coins' | 'miles' | 'ad';

// ---------------------------------------------------------------------------
// Runtime state (serialized in the save)
// ---------------------------------------------------------------------------

export interface ShopState {
  defId: string;
  level: number;
  stars: number;
  /** Goods on the shelves, expressed in coins still to be earned. */
  stock: number;
  restock?: { tier: number; endsAt: number };
}

export interface FloorState {
  /** Construction in progress until this timestamp. */
  buildEndsAt?: number;
  shop?: ShopState;
  rerollUsed?: boolean;
  wallColor?: string;
}

export interface Destination {
  id: string;
  countryId: CountryId;
  name: string;
  distance: number;
  modifier: DestinationModifier;
}

export interface FlightState {
  destination: Destination;
  departAt: number;
  endsAt: number;
  passengers: number;
  vipUids: string[];
  tailwindUsed: boolean;
}

export interface PlaneState {
  uid: string;
  modelId: string;
  name: string;
  color: string;
  upgrades: Record<StatKey, number>;
  modules: (string | null)[];
  crew: Partial<Record<CrewRole, string>>;
  flight?: FlightState;
  damaged?: boolean;
  repairEndsAt?: number;
}

export interface CrewMember {
  uid: string;
  name: string;
  role: CrewRole;
  rarity: Rarity;
  element: Element;
  traits: string[];
  level: number;
  xp: number;
  planeUid?: string;
}

export interface VipState {
  uid: string;
  defId: string;
  expiresAt: number;
  demand?: { countryId: CountryId; minComfort: number; moduleId?: string };
}

export interface Outcome {
  text: string;
  coinsMult?: number;
  resourceMult?: number;
  miles?: number;
  rep?: number;
  crewXp?: number;
  damage?: boolean;
  unlockShop?: string;
  /** A VIP of the visited country comes back with the plane and waits in the hall. */
  vip?: boolean;
  /** Seasonal currency (only during the event's season). */
  seasonPoints?: number;
}

export interface VipResult {
  defId: string;
  satisfied: boolean;
  reason?: string;
}

export interface FlightReport {
  id: string;
  planeUid: string;
  countryId: CountryId;
  destName: string;
  passengers: number;
  coins: number;
  resource: number;
  xp: number;
  crewXp: number;
  vips: VipResult[];
  vipCoins: number;
  vipMiles: number;
  vipResource: number;
  /** A choice event is waiting for the player: rewards are not applied yet. */
  pending?: boolean;
  /** Seasonal points earned by this flight (event outcome included once settled). */
  seasonPoints?: number;
  /** « Double récolte » already used. */
  doubled?: boolean;
  event?: {
    defId: string;
    /** Outcome already decided (bonus/malus) or after the player's choice. */
    outcome?: Outcome;
    avoided?: boolean;
    choice?: number;
    success?: boolean;
  };
}

export interface OfflineSummary {
  seconds: number;
  coins: number;
  flightsLanded: number;
}

export interface GameStats {
  floorsBuilt: number;
  shopsOpened: number;
  restocks: number;
  flightsSent: number;
  flightsCollected: number;
  recruits: number;
  crewAssigned: number;
  planeUpgrades: number;
  shopUpgrades: number;
  researchDone: number;
  fusions: number;
  vipsServed: number;
  vipsUsed: number;
  guided: number;
  planesBought: number;
  totalCoins: number;
  giftsSent: number;
  friendVisits: number;
  boxesOpened: number;
  betsWon: number;
}

export interface GameState {
  version: number;
  seed: number;
  createdAt: number;
  lastTick: number;

  coins: number;
  miles: number;
  xp: number;
  level: number;
  resources: Record<CountryId, number>;

  floors: FloorState[];
  plans: string[];
  fusion?: { a: string; b: string; resultId: string; endsAt: number };

  lounge: { level: number; passengers: number };
  guide?: { floor: number; expiresAt: number };

  planes: PlaneState[];
  crew: CrewMember[];
  vips: VipState[];
  reports: FlightReport[];

  discovered: CountryId[];
  bonusShops: string[];
  research: string[];
  researching?: { techId: string; endsAt: number };

  carnet: Record<string, number>;
  missionIndex: number;
  stats: GameStats;

  boosts: { arrivalsX2Until?: number };
  cooldowns: Record<string, number>;
  timers: { vipCheck: number; guideCheck: number };

  facadeColor: string;
  lobbyColor: string;

  // --- Long-term & retention (kept across Franchise) ---------------------------
  prestige: { stars: number; count: number; runStartedAt: number };
  /** Every shop ever opened, for the album. */
  album: string[];
  daily: { streak: number; claimedDay: number };
  quests: { day: number; ids: string[]; base: Record<string, number>; claimed: boolean[]; chestClaimed: boolean };
  achievements: string[];

  /** Current seasonal event progress (GDD §19). */
  season: { id: string | null; year: number; points: number; claimed: number[]; trophies: string[] };
  social: SocialState;

  /** Plan boxes (GDD §22): boxes opened since the last legendary, for the pity timer. */
  gamble: { pity: number };
  /** What the Dex remembers beyond album and Carnet (GDD §23). */
  dex: { vips: string[]; planes: string[]; events: string[]; claimed: string[] };
}

// --- Social (GDD §20) -----------------------------------------------------------

/** What other players can see. Published to the social backend. */
export interface PublicProfile {
  code: string;
  name: string;
  level: number;
  stars: number;
  /** Coins earned during `week`. */
  weeklyScore: number;
  week: number;
  totalCoins: number;
  carnet: number;
  album: number;
  facadeColor: string;
  lobbyColor: string;
  /** Up to 10 floors, bottom first, to draw the friend's tower. */
  floors: { defId: string; level: number }[];
  updatedAt: number;
}

export interface Gift {
  id: string;
  from: string;
  fromName: string;
  to: string;
  day: number;
}

export interface SocialState {
  name: string;
  code: string;
  friends: { code: string; profile: PublicProfile; addedAt: number }[];
  gifts: { day: number; sent: string[]; received: number };
  visits: { day: number; codes: string[] };
  week: { index: number; startCoins: number };
  lastWeek?: { index: number; score: number; rank: number; players: number; claimed: boolean };
}

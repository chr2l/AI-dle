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
}

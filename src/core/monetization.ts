// Every ad / in-app purchase goes through here (GDD §13).
// Current version: no SDK plugged in, every rewarded ad succeeds immediately.

export type AdSlot =
  | 'skip_build'
  | 'restock_express'
  | 'tailwind'
  | 'double_collect'
  | 'free_recruit'
  | 'reroll_shop'
  | 'offline_x2'
  | 'repair';

/** Shows a rewarded ad and resolves true when the reward must be granted. */
export async function showRewardedAd(_slot: AdSlot): Promise<boolean> {
  return true;
}

export interface IapPack {
  id: string;
  name: string;
  miles?: number;
  coins?: number;
}

export const IAP_PACKS: IapPack[] = [
  { id: 'miles_small', name: 'Poignée de Miles', miles: 50 },
  { id: 'miles_big', name: 'Valise de Miles', miles: 300 },
  { id: 'coins_big', name: 'Coffre de pièces', coins: 50000 },
];

/** Buys an in-app pack and resolves true when the content must be granted. */
export async function purchase(_packId: string): Promise<boolean> {
  return true;
}

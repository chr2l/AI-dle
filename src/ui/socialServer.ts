// Client of the social server (server/social, plan de polish IP-17). The
// address is set at build time (VITE_SOCIAL_URL); without it the game keeps
// MemorySocialBackend and friend codes can't be found. The player proves who
// they are with a random key kept in the save (state.social.key).
import type { SocialBackend } from '../core/social';
import type { GameState, Gift, PublicProfile } from '../core/types';

export const SOCIAL_URL: string = import.meta.env.VITE_SOCIAL_URL ?? '';

/** The player's secret key, drawn once and saved with the game. */
export function socialKey(state: GameState): string {
  if (!state.social.key) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    state.social.key = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return state.social.key;
}

export class HttpSocialBackend implements SocialBackend {
  constructor(
    private url: string,
    private key: () => string,
  ) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(this.url.replace(/\/$/, '') + path, {
      ...init,
      headers: { 'content-type': 'application/json', 'x-idleport-key': this.key() },
    });
    if (!res.ok) throw new Error(`social ${path}: ${res.status}`);
    return (await res.json()) as T;
  }

  async publish(profile: PublicProfile) {
    await this.call('/profile', { method: 'PUT', body: JSON.stringify(profile) });
  }

  async fetchProfiles(codes: string[]) {
    if (!codes.length) return [];
    return this.call<PublicProfile[]>(`/profiles?codes=${encodeURIComponent(codes.join(','))}`);
  }

  async deliverGift(gift: Gift) {
    await this.call('/gifts', { method: 'POST', body: JSON.stringify(gift) });
  }

  async takeGifts(code: string) {
    return this.call<Gift[]>('/gifts/take', { method: 'POST', body: JSON.stringify({ code }) });
  }

  async topWeekly(week: number, limit: number) {
    return this.call<PublicProfile[]>(`/top?week=${week}&limit=${limit}`);
  }
}

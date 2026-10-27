import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import schema from '../server/social/schema.sql?raw';
import worker from '../server/social/worker.js';
import { createInitialState, publicProfile } from '../src/core';
import { HttpSocialBackend } from '../src/ui/socialServer';

/** Just enough of Cloudflare D1 over node:sqlite to run the worker. */
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => db.prepare(sql).run(...args),
  });
  return { prepare: (sql: string) => stmt(sql) };
}

/** A backend talking to the worker in memory, as one phone with its own key. */
function phone(env: unknown, key: string) {
  const fetchFn = (url: string, init?: RequestInit) => worker.fetch(new Request(url, init), env);
  const real = globalThis.fetch;
  const backend = new HttpSocialBackend('https://social.test/', () => key);
  // Each call swaps fetch for the in-memory worker.
  return new Proxy(backend, {
    get(target, prop) {
      const v = Reflect.get(target, prop);
      if (typeof v !== 'function') return v;
      return async (...args: unknown[]) => {
        globalThis.fetch = fetchFn as typeof fetch;
        try {
          return await v.apply(target, args);
        } finally {
          globalThis.fetch = real;
        }
      };
    },
  });
}

describe('Serveur social', () => {
  const now = Date.UTC(2026, 9, 27, 12);
  const alice = createInitialState(now, 1);
  const bob = createInitialState(now, 2);
  alice.social.name = 'Alice';
  bob.social.name = 'Bob';

  it('publie, retrouve les profils et protège un code par sa clé', async () => {
    const env = { DB: d1() };
    const a = phone(env, 'a'.repeat(32));
    await a.publish(publicProfile(alice, now));
    const [p] = await a.fetchProfiles([alice.social.code, 'IP-ZZZZ-ZZZZ']);
    expect(p.name).toBe('Alice');
    const thief = phone(env, 'x'.repeat(32));
    await expect(thief.publish({ ...publicProfile(alice, now), name: 'Pirate' })).rejects.toThrow(/403/);
    expect((await a.fetchProfiles([alice.social.code]))[0].name).toBe('Alice');
  });

  it('livre un cadeau par jour, que seul le destinataire peut prendre', async () => {
    const env = { DB: d1() };
    const a = phone(env, 'a'.repeat(32));
    const b = phone(env, 'b'.repeat(32));
    await a.publish(publicProfile(alice, now));
    await b.publish(publicProfile(bob, now));
    const gift = { id: 'g1', from: alice.social.code, fromName: 'Alice', to: bob.social.code, day: 1 };
    await a.deliverGift(gift);
    await a.deliverGift({ ...gift, id: 'g2' });
    await expect(b.deliverGift({ ...gift, id: 'g3' })).rejects.toThrow(/403/);
    await expect(a.takeGifts(bob.social.code)).rejects.toThrow(/403/);
    expect(await b.takeGifts(bob.social.code)).toEqual([gift]);
    expect(await b.takeGifts(bob.social.code)).toEqual([]);
  });

  it('classe la semaine par pièces gagnées', async () => {
    const env = { DB: d1() };
    const a = phone(env, 'a'.repeat(32));
    const b = phone(env, 'b'.repeat(32));
    const pa = publicProfile(alice, now);
    await a.publish({ ...pa, weeklyScore: 10 });
    await b.publish({ ...publicProfile(bob, now), weeklyScore: 99 });
    expect((await a.topWeekly(pa.week, 10)).map((p) => p.name)).toEqual(['Bob', 'Alice']);
  });
});

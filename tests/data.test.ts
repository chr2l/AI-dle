import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../src/core/data/countries';
import { EVENTS } from '../src/core/data/events';
import { SHOP_BY_ID } from '../src/core/data/shops';

describe('events data', () => {
  it('has unique ids', () => {
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
  });

  it('gives every country bonus, malus and choice events', () => {
    for (const c of COUNTRIES) {
      const kinds = new Set(EVENTS.filter((e) => e.country === c.id).map((e) => e.kind));
      expect([...kinds].sort(), c.id).toEqual(['bonus', 'choice', 'malus']);
    }
  });

  it('has rare events for Mystère destinations', () => {
    expect(EVENTS.some((e) => e.rare)).toBe(true);
  });

  it('is well formed', () => {
    for (const e of EVENTS) {
      if (e.kind === 'choice') {
        expect(e.options?.length, e.id).toBe(2);
        for (const o of e.options!) {
          expect(o.chance, e.id).toBeGreaterThan(0);
          expect(o.chance, e.id).toBeLessThanOrEqual(1);
          if (o.chance < 1) expect(o.fail, `${e.id} needs a fail outcome`).toBeDefined();
        }
      } else {
        expect(e.outcome, e.id).toBeDefined();
      }
      const outcomes = [e.outcome, ...(e.options ?? []).flatMap((o) => [o.success, o.fail])];
      for (const o of outcomes) if (o?.unlockShop) expect(SHOP_BY_ID[o.unlockShop], e.id).toBeDefined();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { createInitialState, buildFloor } from '../src/core';
import { outOfNight, reminders } from '../src/ui/notify';
import { problemReport, track } from '../src/ui/telemetry';

const at = (h: number, m = 0, day = 10) => new Date(2026, 9, day, h, m).getTime();

describe('rappels', () => {
  it('ne réveille personne la nuit', () => {
    expect(outOfNight(at(14))).toBe(at(14));
    expect(outOfNight(at(23, 30))).toBe(at(8, 0, 11));
    expect(outOfNight(at(3))).toBe(at(8));
    expect(outOfNight(at(21, 59))).toBe(at(21, 59));
  });

  it('respecte les types coupés et ignore ce qui arrive dans la minute', () => {
    const now = at(12);
    const s = createInitialState(now);
    buildFloor(s, now);
    s.floors[0].buildEndsAt = now + 10 * 60_000;
    expect(reminders(s, now).map((r) => r.id)).toContain('build');
    expect(reminders(s, now, ['build']).map((r) => r.id)).not.toContain('build');
    expect(reminders(s, s.floors[0].buildEndsAt! - 30_000).map((r) => r.id)).not.toContain('build');
  });
});

describe('statistiques', () => {
  it('garde les événements sur le téléphone sans adresse de collecte', () => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] };
    track('mission', { m: 3 });
    const queue = JSON.parse(store['idleport.telemetry']);
    expect(queue[0].e).toBe('mission');
    expect(queue[0].id).toMatch(/^[a-z0-9]+$/);
    expect(problemReport('0.1.0', 'Niveau 3')).toContain('Aucune erreur');
  });
});

import { describe, expect, it } from 'vitest';
import { careerLines, createInitialState, daysPlayed } from '../src/core';
import { daylight, lighting, Weather, WEATHER } from '../src/render/daylight';

const at = (h: number, m = 0) => new Date(2026, 9, 27, h, m);

describe('jour et nuit', () => {
  it('plein jour de 8 h à 19 h, nuit de 21 h à 6 h, transitions entre les deux', () => {
    expect(daylight(at(12))).toBe(1);
    expect(daylight(at(8))).toBe(1);
    expect(daylight(at(23))).toBe(0);
    expect(daylight(at(3))).toBe(0);
    expect(daylight(at(7))).toBeCloseTo(0.5);
    expect(daylight(at(20))).toBeCloseTo(0.5);
  });

  it('la nuit assombrit la teinte et le ciel, le jour les laisse intacts', () => {
    const day = lighting(1, '#8fd3ff');
    expect(day.tint.r).toBeCloseTo(1);
    expect(day.sky.getHexString()).toBe('8fd3ff');
    const night = lighting(0, '#8fd3ff');
    expect(night.tint.r).toBeLessThan(0.6);
    expect(night.sky.getHex()).not.toBe(day.sky.getHex());
  });

  it('météo : neige à Givrebourg, rien à Mélodia, particules qui suivent la caméra', () => {
    expect(WEATHER.givrebourg).toBe('snow');
    expect(WEATHER.melodia).toBeUndefined();
    const w = new Weather();
    w.set('snow');
    w.tick(5, { x: 100, y: 50, z: 0 });
    const pos = w.points.geometry.getAttribute('position');
    for (let i = 0; i < 20; i++) expect(Math.abs(pos.getX(i) - 100)).toBeLessThanOrEqual(70);
    w.set(null);
    expect(w.points.visible).toBe(false);
  });
});

describe('profil', () => {
  it('compte les jours et cache les lignes avancées à zéro', () => {
    const now = Date.UTC(2026, 9, 27);
    const s = createInitialState(now);
    expect(daysPlayed(s, now)).toBe(1);
    expect(daysPlayed(s, now + 3 * 86_400_000)).toBe(4);
    const labels = careerLines(s, now).map((l) => l.label);
    expect(labels).toContain('Pièces gagnées');
    expect(labels).not.toContain('Franchises');
    s.prestige.count = 2;
    expect(careerLines(s, now).find((l) => l.label === 'Franchises')?.value).toBe(2);
  });
});

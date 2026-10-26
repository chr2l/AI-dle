import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../../src/core/data/countries';
import { AirportScene, FLIGHT_TIMING, flightPose } from '../../src/render/airport';
import { buildSceneryModel, RUNWAY_CENTER_Z, SCENERY } from '../../src/render/models/scenery';

const TOTAL = FLIGHT_TIMING.roll + FLIGHT_TIMING.climb;

describe('flight paths', () => {
  it('takes off: rolls on the runway, then climbs away along +x', () => {
    const start = flightPose('takeoff', 0);
    const rolling = flightPose('takeoff', FLIGHT_TIMING.roll * 0.8);
    const end = flightPose('takeoff', TOTAL);
    expect(start.y).toBe(0);
    expect(rolling.y).toBe(0);
    expect(rolling.x).toBeGreaterThan(start.x);
    expect(end.y).toBeGreaterThan(100);
    expect(end.x).toBeGreaterThan(rolling.x);
    expect(end.done).toBe(true);
    expect(flightPose('takeoff', 1).done).toBe(false);
  });

  it('lands: comes down from the sky, touches down, then rolls along +x', () => {
    const first = flightPose('landing', 0);
    const touch = flightPose('landing', FLIGHT_TIMING.climb);
    const last = flightPose('landing', TOTAL);
    expect(first.y).toBeGreaterThan(100);
    expect(touch.y).toBeCloseTo(0);
    expect(last.y).toBe(0);
    expect(last.x).toBeGreaterThan(touch.x);
    expect(touch.x).toBeGreaterThan(first.x);
    expect(last.done).toBe(true);
  });

  it('keeps ground rolls on the runway', () => {
    for (const kind of ['takeoff', 'landing'] as const)
      for (let t = 0; t <= TOTAL; t += 0.5) {
        const p = flightPose(kind, t);
        if (p.y === 0) expect(p.x).toBeGreaterThanOrEqual(SCENERY.runway.x0);
        if (p.y === 0) expect(p.x).toBeLessThanOrEqual(SCENERY.runway.x1);
      }
    expect(RUNWAY_CENTER_Z).toBeGreaterThan(SCENERY.apron.z1);
  });
});

describe('scenery', () => {
  it('builds a themed land for every country and the neutral one', () => {
    const neutral = buildSceneryModel('neutre');
    expect(neutral.count()).toBeGreaterThan(SCENERY.width * SCENERY.depth);
    for (const c of COUNTRIES) {
      const g = buildSceneryModel(c.id);
      expect(Array.from(g.cells)).not.toEqual(Array.from(neutral.cells));
    }
  });

  it('leaves the tower footprint free', () => {
    const g = buildSceneryModel('tropicalia');
    for (let x = 0; x < 24; x++) for (let z = 0; z < 10; z++) expect(g.get(x - SCENERY.origin.x, 1, z - SCENERY.origin.z)).toBe(-1);
  });
});

describe('AirportScene', () => {
  it('parks grounded planes and animates takeoffs and landings of the fleet', () => {
    const scene = new AirportScene([1e9, 1e9]); // no ambient traffic
    const fleet = [
      { uid: 'a', modelId: 'coucou', flying: false },
      { uid: 'b', modelId: 'libellule', flying: false },
    ];
    scene.sync(fleet, 0);
    expect(scene.parkedCount).toBe(2);

    fleet[0].flying = true;
    scene.sync(fleet, 1000);
    expect(scene.parkedCount).toBe(1);
    expect(scene.activeFlights).toEqual([{ kind: 'takeoff', uid: 'a' }]);
    scene.tick(1000 + TOTAL * 1000 + 1);
    expect(scene.activeFlights).toEqual([]);

    fleet[0].flying = false;
    scene.sync(fleet, 60_000);
    expect(scene.activeFlights).toEqual([{ kind: 'landing', uid: 'a' }]);
    expect(scene.parkedCount).toBe(1); // parks once the landing is over
    scene.tick(60_000 + TOTAL * 1000 + 1);
    expect(scene.parkedCount).toBe(2);
  });

  it('adds ambient traffic over time', () => {
    const scene = new AirportScene([1, 2]);
    scene.tick(10_000);
    scene.tick(12_100);
    expect(scene.activeFlights.length).toBeGreaterThan(0);
    expect(scene.activeFlights.every((f) => f.uid === null)).toBe(true);
  });
});

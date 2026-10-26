import { beforeEach, describe, expect, it } from 'vitest';
import { buildFloor, openShop, tick } from '../src/core/engine';
import { claimMission } from '../src/core/game';
import { createInitialState } from '../src/core/state';
import type { GameState } from '../src/core/types';
import { guideStep, tabBadges, unlocked } from '../src/ui/tutorial';

const T0 = 1_800_000_000_000;

let state: GameState;
beforeEach(() => {
  state = createInitialState(T0, 42);
});

describe('guided first steps', () => {
  it('follows the onboarding missions', () => {
    expect(guideStep(state, T0)).toMatchObject({ tab: 'tour', target: 'build' });
    buildFloor(state, T0);
    expect(guideStep(state, T0)).toMatchObject({ tab: 'tour', target: 'rush-build' });
    tick(state, T0 + 3600_000);
    expect(guideStep(state, T0 + 3600_000)).toMatchObject({ target: 'mission' });
    claimMission(state);
    expect(guideStep(state, T0 + 3600_000)).toMatchObject({ tab: 'tour', target: 'open' });
    openShop(state, 0, 'resto');
    claimMission(state);
    expect(guideStep(state, T0 + 3600_000)).toMatchObject({ tab: 'tour', target: 'restock' });
  });

  it('points the research mission to the research view', () => {
    state.missionIndex = 10;
    expect(guideStep(state, T0)).toMatchObject({ tab: 'vols', view: 'recherche', target: 'research' });
  });
});

describe('progressive unlocking', () => {
  it('opens tabs with the missions, or the level for players who skip them', () => {
    expect([...unlocked(state)]).toEqual([]);
    state.missionIndex = 3;
    expect(unlocked(state)).toEqual(new Set(['objectifs', 'vols']));
    state.missionIndex = 0;
    state.level = 3;
    expect(unlocked(state)).toEqual(new Set(['objectifs', 'vols', 'equipe', 'recherche', 'labo', 'amis', 'saison']));
    state.level = 10;
    expect(unlocked(state).has('franchise')).toBe(true);
  });
});

describe('tab badges', () => {
  it('counts what waits for the player', () => {
    buildFloor(state, T0);
    tick(state, T0 + 3600_000);
    const badges = tabBadges(state, T0 + 3600_000);
    expect(badges.tour).toBe(1); // empty floor
    expect(badges.objectifs).toBeGreaterThanOrEqual(2); // mission done + daily gift
  });
});

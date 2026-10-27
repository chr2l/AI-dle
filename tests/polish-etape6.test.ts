import { describe, expect, it } from 'vitest';
import { buildFigure, buildVipModel, GUIDE_LOOK, VIP_LOOKS } from '../src/render/models/vip';

describe('Capucine, la guide', () => {
  it('est une figurine complète, hors de la liste des VIP', () => {
    const g = buildFigure(GUIDE_LOOK);
    expect(g.count()).toBeGreaterThan(100);
    expect(Object.keys(VIP_LOOKS)).not.toContain('guide');
  });

  it('les VIP sont construits comme avant', () => {
    const id = Object.keys(VIP_LOOKS)[0];
    expect(buildVipModel(id).count()).toBe(buildFigure(VIP_LOOKS[id]).count());
  });
});

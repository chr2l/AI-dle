import { describe, expect, it } from 'vitest';
import { iconize } from '../src/ui/icons';

const show = (html: string) => iconize(html).replace(/<svg class="([^"]*)"[^]*?<\/svg>/g, '[$1]');

describe('iconize', () => {
  it('swaps interface emojis in text only, never inside tags', () => {
    expect(show('<b data-x="🪙">120 🪙 · 5 ✈️</b>')).toBe('<b data-x="🪙">120 [ic ic-gold] · 5 [ic ic-sky]</b>');
  });

  it('keeps ZWJ sequences whole', () => {
    expect(show('🧑‍🔧 🔧')).toBe('[ic] [ic]');
    expect(show('👩‍🍳')).toBe('👩‍🍳');
  });
});

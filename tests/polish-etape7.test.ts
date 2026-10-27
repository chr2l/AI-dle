import { afterEach, describe, expect, it } from 'vitest';
import { setLang, t, translateHtmlText, translateTag } from '../src/i18n';
import { EN_DATA } from '../src/i18n/en-data';
import { EN_UI } from '../src/i18n/en-ui';
import { SHOPS, CATEGORIES } from '../src/core/data/shops';
import { COUNTRIES } from '../src/core/data/countries';
import { MISSIONS } from '../src/core/data/missions';
import { dec, fmt } from '../src/ui/widgets';

afterEach(() => setLang('fr'));

describe('Version anglaise', () => {
  it('suit la langue du téléphone en auto', () => {
    setLang('auto', 'fr-FR');
    expect(t('Envoyer en vol')).toBe('Envoyer en vol');
    setLang('auto', 'en-GB');
    expect(t('Envoyer en vol')).toBe('Send on a flight');
  });

  it('traduit les phrases avec emoji, nombres et valeurs', () => {
    setLang('en');
    expect(t('🛫 Envoyer en vol')).toBe('🛫 Send on a flight');
    expect(t('Construire l’étage 9')).toBe('Build floor 9');
    expect(t('Collecter 3 vols')).toBe('Collect 3 flights');
    expect(t('Fiabilité 55 : 33 % de chances d’éviter un incident')).toBe('Reliability 55: 33% chance of avoiding an incident');
    expect(t('Votre tour · 8/33 étages')).toBe('Your tower · 8/33 floors');
    expect(t('En vol vers 🎵 Tempo-Port')).toBe('Flying to 🎵 Tempo-Port');
    expect(t('Niveau {level} · {floors} étages', { level: 3, floors: 5 })).toBe('Level 3 · 5 floors');
  });

  it('laisse le texte inconnu en français', () => {
    setLang('en');
    expect(t('Phrase jamais traduite')).toBe('Phrase jamais traduite');
  });

  it('traduit le texte HTML et les attributs lisibles', () => {
    setLang('en');
    expect(translateHtmlText('Ouvrir l&#39;étage'.replace('&#39;', "'"))).toBe("Ouvrir l'étage");
    expect(translateHtmlText('L&#39;avion est en vol.')).toBe('The plane is flying.');
    expect(translateTag('<button aria-label="Réglages" data-act="x">')).toBe('<button aria-label="Settings" data-act="x">');
  });

  it('les nombres suivent la langue', () => {
    expect(fmt(2_480_000)).toBe('2,4\u202fM');
    setLang('en');
    expect(fmt(2_480_000)).toBe('2.4M');
    expect(fmt(2_931)).toBe('2,931');
    expect(fmt(3e9)).toBe('3B');
    expect(dec(17.3)).toBe('17.3');
  });

  it('les entrées gardent leurs valeurs à remplir', () => {
    for (const [fr, en] of Object.entries({ ...EN_DATA, ...EN_UI })) {
      expect(en.length, fr).toBeGreaterThan(0);
      const names = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(names(en), fr).toBe(names(fr));
    }
  });

  it('les données du jeu sont toutes traduites', () => {
    const texts = [...SHOPS.map((s) => s.name), ...Object.values(CATEGORIES).flatMap((c) => [c.name, ...c.products]), ...COUNTRIES.flatMap((c) => [c.name, c.theme, c.resource.name]), ...MISSIONS.map((m) => m.text)];
    const all = { ...EN_DATA, ...EN_UI };
    expect(texts.filter((s) => !(s in all))).toEqual([]);
  });
});

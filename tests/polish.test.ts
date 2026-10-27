import { describe, expect, it } from 'vitest';
import { BACKUP_KEY, SAVE_KEY, createInitialState, exportCode, importCode, load, pickSave, save, serialize, type SaveStorage } from '../src/core';
import { fmt, perSec } from '../src/ui/widgets';

const memory = (): SaveStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

describe('sauvegarde blindée', () => {
  it('garde la sauvegarde précédente en secours', () => {
    const st = memory();
    const s = createInitialState(1000);
    save(s, st);
    expect(st.data[BACKUP_KEY]).toBeUndefined();
    s.coins = 999;
    save(s, st);
    expect(JSON.parse(st.data[BACKUP_KEY]).coins).toBe(300);
    expect(JSON.parse(st.data[SAVE_KEY]).coins).toBe(999);
  });

  it('repart du secours si la sauvegarde est tronquée', () => {
    const st = memory();
    const s = createInitialState(1000);
    save(s, st);
    s.coins = 500;
    save(s, st);
    st.data[SAVE_KEY] = st.data[SAVE_KEY].slice(0, 40);
    expect(load(2000, st)?.coins).toBe(300);
  });

  it('ne remplace pas un bon secours par une sauvegarde illisible', () => {
    const st = memory();
    save(createInitialState(1000), st);
    const good = st.data[SAVE_KEY];
    st.data[SAVE_KEY] = '{oups';
    save(createInitialState(1000), st);
    expect(st.data[BACKUP_KEY]).toBeUndefined();
    st.data[BACKUP_KEY] = good;
    st.data[SAVE_KEY] = '{oups';
    save(createInitialState(1000), st);
    expect(st.data[BACKUP_KEY]).toBe(good);
  });

  it('choisit la copie la plus avancée', () => {
    const a = createInitialState(1000);
    const b = createInitialState(1000);
    b.lastTick = 5000;
    b.coins = 42;
    expect(pickSave([serialize(a), null, 'cassé', serialize(b)], 6000)?.coins).toBe(42);
    expect(pickSave([null, 'x'], 6000)).toBeNull();
  });

  it('exporte et réimporte un code de sauvegarde', async () => {
    const s = createInitialState(1000);
    s.coins = 123_456;
    s.miles = 77;
    const code = await exportCode(s);
    expect(code.startsWith('IDLEPORT')).toBe(true);
    const back = await importCode(` ${code.slice(0, 20)}\n${code.slice(20)} `, 2000);
    expect(back?.coins).toBe(123_456);
    expect(back?.miles).toBe(77);
    expect(await importCode('IDLEPORT1.abc', 2000)).toBeNull();
    expect(await importCode('bonjour', 2000)).toBeNull();
  });
});

describe('chiffres en français', () => {
  const n = (t: string) => t.replace(/ /g, ' ');
  it('sépare les milliers et utilise les unités françaises', () => {
    expect(n(fmt(950))).toBe('950');
    expect(n(fmt(9999))).toBe('9 999');
    expect(n(fmt(12_400))).toBe('12,4 k');
    expect(n(fmt(3_050_000_000))).toBe('3 Md');
    expect(n(fmt(3_050_000_000, true))).toBe('3,05 Md');
    expect(n(fmt(2.5e12))).toBe('2,5 Bn');
    expect(n(fmt(999_999))).toBe('999 k');
    expect(n(fmt(4e21))).toBe('4 Td');
    expect(n(fmt(4e24))).toBe('4 aa');
  });
  it('affiche les débits avec une virgule', () => {
    expect(perSec(1.25)).toBe('1,3');
    expect(n(perSec(25_000))).toBe('25 k');
  });
});

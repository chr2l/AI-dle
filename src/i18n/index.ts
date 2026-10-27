// English version (plan de polish IP-18). The game is written in French and
// stays French in the code: the English dictionary is keyed on the French
// text itself (gettext style), with {placeholders} for the parts that vary.
// Every HTML string already goes through iconize() before reaching the page,
// so translation happens there, text segment by text segment, for the
// interface and for the messages coming from the engine alike. A segment
// with no English entry stays in French (the screens script lists them).
import { EN_DATA } from './en-data';
import { EN_UI } from './en-ui';

export type Lang = 'fr' | 'en';

let lang: Lang = 'fr';
export const currentLang = () => lang;

/** Picks the language: the player's choice, else the phone's (French for French speakers, English otherwise). */
export function setLang(choice: 'auto' | Lang, phone = typeof navigator === 'undefined' ? 'fr' : navigator.language) {
  lang = choice === 'auto' ? (/^fr\b/i.test(phone) ? 'fr' : 'en') : choice;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  cache.clear();
}

const DICT: Record<string, string> = { ...EN_DATA, ...EN_UI };

interface Pattern {
  re: RegExp;
  names: string[];
  out: string;
  weight: number;
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Entries with {placeholders}, the most specific (longest fixed text) first. */
const PATTERNS: Pattern[] = Object.entries(DICT)
  .filter(([fr]) => /\{\w+\}/.test(fr))
  .map(([fr, out]) => {
    const names: string[] = [];
    const re = new RegExp(
      '^' + fr.split(/(\{\w+\})/).map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (!m) return escRe(part);
        names.push(m[1]);
        return '(.+?)';
      }).join('') + '$',
      's',
    );
    return { re, names, out, weight: fr.replace(/\{\w+\}/g, '').length };
  })
  .sort((a, b) => b.weight - a.weight);

const cache = new Map<string, string>();
/** French segments seen without an English entry (read by scripts/screens.mjs). */
export const missing = new Set<string>();
if (typeof window !== 'undefined') (window as unknown as { idleportMissing: Set<string> }).idleportMissing = missing;

function fill(out: string, values: Record<string, string>): string {
  return out.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');
}

/** A value captured by a pattern: a name or a word gets its own entry, numbers stay. */
const inner = (v: string) => DICT[v] ?? v;

function lookup(text: string): string | null {
  const hit = DICT[text];
  if (hit !== undefined) return hit;
  for (const p of PATTERNS) {
    const m = p.re.exec(text);
    if (!m) continue;
    const values: Record<string, string> = {};
    p.names.forEach((n, i) => (values[n] = inner(m[i + 1])));
    return fill(p.out, values);
  }
  return null;
}

/** Text with letters worth translating (not only numbers, symbols or emoji). */
const WORDY = /\p{L}{2,}/u;

/** Translates one plain-text phrase; returns it unchanged in French or when unknown. */
export function t(text: string, values?: Record<string, string | number>): string {
  let out = text;
  if (lang !== 'fr') out = translate(text);
  return values ? out.replace(/\{(\w+)\}/g, (all, k: string) => (k in values ? String(values[k]) : all)) : out;
}

function translate(text: string): string {
  const cached = cache.get(text);
  if (cached !== undefined) return cached;
  const lead = /^\s*/.exec(text)![0];
  const trail = /\s*$/.exec(text)![0];
  const core = text.slice(lead.length, text.length - trail.length);
  let out = core;
  if (WORDY.test(core)) {
    const direct = lookup(core);
    if (direct !== null) out = direct;
    else if (core.includes(' · ')) out = core.split(' · ').map((part) => translate(part)).join(' · ');
    else if (/^\S+ \S/u.test(core) && !WORDY.test(core.split(' ')[0])) {
      // « 🛫 Décollage » : an emoji or a number before the phrase.
      const [head, ...rest] = core.split(' ');
      out = `${head} ${translate(rest.join(' '))}`;
    } else if (/\S \S+$/u.test(core) && !WORDY.test(core.split(' ').at(-1)!)) {
      // « Décollage ! 🛫 » : an emoji or a number after the phrase.
      const words = core.split(' ');
      const tail = words.pop()!;
      out = `${translate(words.join(' '))} ${tail}`;
    } else missing.add(core);
  }
  const result = lead + out + trail;
  cache.set(text, result);
  return result;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e]);
const encode = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Translates the text of an HTML segment (no tags inside). */
export function translateHtmlText(text: string): string {
  if (lang === 'fr' || !WORDY.test(text)) return text;
  return encode(translate(decode(text)));
}

/** Translates the attributes a player can read or hear (aria-label, title, placeholder, data-why). */
export function translateTag(tag: string): string {
  if (lang === 'fr') return tag;
  return tag.replace(/\b(aria-label|title|placeholder|data-why)="([^"]*)"/g, (_, attr: string, v: string) => `${attr}="${translateHtmlText(v)}"`);
}

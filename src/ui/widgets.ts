// HTML building blocks of the interface. Every action button says what it
// does and what it costs; a button that cannot be used stays tappable and
// explains why (data-why) instead of silently doing nothing.
import { iconize } from './icons';

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** French short scale names: k, M (million), Md (milliard), Bn (billion)… then aa, ab… */
const UNITS = ['k', 'M', 'Md', 'Bn', 'Bd', 'Tn', 'Td'];
const unit = (i: number) => (i < UNITS.length ? UNITS[i] : String.fromCharCode(97 + Math.floor((i - UNITS.length) / 26) % 26, 97 + ((i - UNITS.length) % 26)));
/** Narrow no-break space: French thousands separator and number/unit gap. */
const NNBSP = '\u202f';

/**
 * Amount in French: « 9 999 », « 12,4 k », « 3,05 Md ». `precise` keeps
 * three significant digits (HUD counter, so it visibly rolls).
 */
export function fmt(n: number, precise = false): string {
  const v = Math.floor(n);
  if (Math.abs(v) < 10_000) return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  let x = v;
  let i = -1;
  while (Math.abs(x) >= 1000) {
    x /= 1000;
    i++;
  }
  const abs = Math.abs(x);
  const digits = precise ? (abs < 10 ? 2 : abs < 100 ? 1 : 0) : abs < 100 ? 1 : 0;
  // Truncate rather than round, so 999,96 k never shows as « 1000,0 k ».
  const f = 10 ** digits;
  const shown = (Math.floor(x * f) / f).toFixed(digits).replace('.', ',').replace(/,0+$/, '');
  return `${shown}${NNBSP}${unit(i)}`;
}

/** Decimal number in French (« 1,5 »). */
export const dec = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',');

/** Per-second rate: one decimal while small, then like fmt(). */
export const perSec = (n: number) => (n < 1000 ? dec(n) : fmt(n));

export function dur(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}

export interface BtnOpts {
  act: string;
  args?: unknown[];
  label: string;
  /** Second line: price, duration or gain. */
  sub?: string;
  /** Why the action is unavailable; the button then explains instead of acting. */
  why?: string | false;
  /** main = yellow call to action, ad = rewarded ad, rush = paid with Miles. */
  kind?: 'main' | 'ad' | 'rush' | 'ghost' | 'ok' | 'danger';
  small?: boolean;
  wide?: boolean;
  /** Tutorial key (see tutorial.ts). */
  tuto?: string;
}

export function button(o: BtnOpts): string {
  const cls = [o.kind ?? '', o.small ? 'small' : '', o.wide ? 'wide' : '', o.why ? 'locked' : ''].filter(Boolean).join(' ');
  const attrs = o.why ? ` data-why="${esc(o.why)}"` : ` data-act="${o.act}" data-args="${esc(JSON.stringify(o.args ?? []))}"`;
  return (
    `<button class="${cls}"${attrs}${o.tuto ? ` data-tuto="${o.tuto}"` : ''}>` +
    `<span class="v">${o.why ? '🔒 ' : ''}${o.label}</span>${o.sub ? `<span class="c">${o.sub}</span>` : ''}</button>`
  );
}

/** Missing amount of a currency, as a lock reason. */
export const lack = (have: number, need: number, unit: string) => (have < need ? `Il manque ${fmt(need - have)} ${unit}` : false);

/** Progress bar from the elapsed share of a timer. */
export function bar(done: number, cls = ''): string {
  const pct = Math.max(0, Math.min(100, done * 100));
  return `<div class="bar ${cls}"><i style="width:${pct.toFixed(1)}%"></i></div>`;
}

export const timerBar = (endsAt: number, totalMs: number, now: number, cls = '') =>
  bar(totalMs > 0 ? 1 - (endsAt - now) / totalMs : 1, cls);

/** Section title with an optional ⓘ help button. */
export const section = (title: string, help?: string) =>
  `<h3>${title}${help ? `<button class="info" data-act="help" data-args="${esc(JSON.stringify([help]))}" aria-label="Aide">ⓘ</button>` : ''}</h3>`;

/** Level as filled pips, e.g. upgrade levels of a plane stat. */
export function pips(level: number, max: number): string {
  let html = '<span class="pips">';
  for (let i = 0; i < max; i++) html += `<i${i < level ? ' class="on"' : ''}></i>`;
  return html + '</span>';
}

export const chip = (text: string, cls = '') => `<span class="chip ${cls}">${text}</span>`;

/** Bottom sheet header with a close cross. */
export const sheetHead = (title: string, sub = '') =>
  `<div class="sheet-head"><div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div><button class="x" data-act="close" aria-label="Fermer">✕</button></div>`;

/**
 * Updates `target` to the given HTML in place: nodes that did not change are
 * kept, so CSS animations do not restart every second, scroll positions hold
 * and a finger on a button is not lost under a redraw.
 */
export function morph(target: Element, html: string) {
  const tpl = document.createElement('template');
  tpl.innerHTML = iconize(html);
  morphChildren(target, tpl.content);
}

function morphChildren(from: Node, to: Node) {
  const next = [...to.childNodes];
  let cur = from.firstChild;
  for (const n of next) {
    if (!cur) {
      from.appendChild(n);
      continue;
    }
    if (cur.nodeType !== n.nodeType || cur.nodeName !== n.nodeName) {
      from.replaceChild(n, cur);
      cur = n.nextSibling;
      continue;
    }
    if (cur.nodeType === Node.TEXT_NODE) {
      if (cur.nodeValue !== n.nodeValue) cur.nodeValue = n.nodeValue;
    } else if (cur.nodeType === Node.ELEMENT_NODE) {
      morphAttributes(cur as Element, n as Element);
      morphChildren(cur, n);
    }
    cur = cur.nextSibling;
  }
  while (cur) {
    const after = cur.nextSibling;
    from.removeChild(cur);
    cur = after;
  }
}

/** Classes added by the app after a render (tutorial pulse, flash, shake) survive. */
const KEEP_CLASSES = ['pulse', 'flash', 'shake', 'bump'];

function morphAttributes(el: Element, to: Element) {
  for (const { name } of [...el.attributes]) if (!to.hasAttribute(name)) el.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) {
    if (name === 'class') {
      const kept = KEEP_CLASSES.filter((c) => el.classList.contains(c));
      const want = [value, ...kept].filter(Boolean).join(' ');
      if (el.getAttribute('class') !== want) el.setAttribute('class', want);
    } else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  }
}

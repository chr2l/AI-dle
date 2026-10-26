// HTML building blocks of the interface. Every action button says what it
// does and what it costs; a button that cannot be used stays tappable and
// explains why (data-why) instead of silently doing nothing.

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function fmt(n: number): string {
  const v = Math.floor(n);
  if (v < 10_000) return String(v);
  const units = ['k', 'M', 'G', 'T'];
  let x = v;
  let i = -1;
  while (x >= 1000 && i < units.length - 1) {
    x /= 1000;
    i++;
  }
  return `${x < 100 ? x.toFixed(1) : Math.floor(x)}${units[i]}`;
}

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

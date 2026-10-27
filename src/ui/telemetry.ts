// Anonymous play statistics and error log (plan de polish IP-07).
// Events are queued on the phone; they leave it only when a collection
// address is configured at build time (VITE_TELEMETRY_URL) AND the player
// said yes. Without that, the queue only feeds the « Signaler un problème »
// report in Réglages. No personal data: a random install id, the game state
// summary and the event name.
import { settings, setSetting } from './settings';

const QUEUE_KEY = 'idleport.telemetry';
const ERRORS_KEY = 'idleport.errors';
const MAX_QUEUE = 300;
const MAX_ERRORS = 20;

export const TELEMETRY_URL: string = import.meta.env.VITE_TELEMETRY_URL ?? '';

export interface TelemetryEvent {
  /** Event name, e.g. session_start, mission_done. */
  e: string;
  /** Timestamp (ms). */
  t: number;
  /** Random install id. */
  id: string;
  /** Small payload: numbers and short strings only. */
  p?: Record<string, string | number | boolean>;
}

const read = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: drop it */
  }
};

function installId(): string {
  if (!settings.installId) setSetting('installId', Math.random().toString(36).slice(2, 10) + Date.now().toString(36));
  return settings.installId!;
}

/** Collection is possible (address configured) and the player agreed. */
export const sharing = () => !!TELEMETRY_URL && settings.analytics === 'yes';

export function track(e: string, p?: TelemetryEvent['p']) {
  const queue = read<TelemetryEvent[]>(QUEUE_KEY, []);
  queue.push({ e, t: Date.now(), id: installId(), p });
  write(QUEUE_KEY, queue.slice(-MAX_QUEUE));
}

/** Sends the queue when sharing is on; keeps it on failure. */
export async function flush() {
  if (!sharing()) return;
  const queue = read<TelemetryEvent[]>(QUEUE_KEY, []);
  if (!queue.length) return;
  try {
    const res = await fetch(TELEMETRY_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(queue), keepalive: true });
    if (res.ok) write(QUEUE_KEY, read<TelemetryEvent[]>(QUEUE_KEY, []).slice(queue.length));
  } catch {
    /* offline: next time */
  }
}

export interface ErrorEntry {
  t: number;
  msg: string;
  where?: string;
}

export const errorLog = () => read<ErrorEntry[]>(ERRORS_KEY, []);

/** Records uncaught errors (kept locally, and sent as events when sharing). */
export function watchErrors(version: string) {
  const record = (msg: string, where?: string) => {
    const log = errorLog();
    log.push({ t: Date.now(), msg: msg.slice(0, 300), where: where?.slice(0, 200) });
    write(ERRORS_KEY, log.slice(-MAX_ERRORS));
    track('error', { msg: msg.slice(0, 120), where: (where ?? '').slice(0, 80), v: version });
  };
  addEventListener('error', (e) => record(String(e.message || e.error), e.filename ? `${e.filename.split('/').pop()}:${e.lineno}` : e.error?.stack?.split('\n')[1]?.trim()));
  addEventListener('unhandledrejection', (e) => record(String((e.reason as Error)?.message ?? e.reason), (e.reason as Error)?.stack?.split('\n')[1]?.trim()));
}

/** Plain text report the player can copy and send (Réglages > Signaler un problème). */
export function problemReport(version: string, summary: string): string {
  const errors = errorLog();
  return [
    `IdlePort ${version} · ${navigator.userAgent.replace(/\s*\(KHTML.*$/, '')}`,
    summary,
    errors.length ? `Erreurs récentes (${errors.length}) :` : 'Aucune erreur enregistrée.',
    ...errors.slice(-8).map((x) => `- ${new Date(x.t).toISOString().slice(5, 16)} ${x.msg}${x.where ? ` @ ${x.where}` : ''}`),
  ].join('\n');
}

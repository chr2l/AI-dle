// Local reminders (plan de polish IP-04): when the player leaves, the game
// schedules what plannedNotifications() computed (GDD §18.7), minus the kinds
// turned off in Réglages, moved out of the night; when they come back,
// pending reminders are cancelled. Native only: on the web this does nothing.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import * as G from '../core';
import type { GameState } from '../core';
import { settings } from './settings';

export const NOTIF_KINDS: { id: string; label: string }[] = [
  { id: 'flight', label: 'Avion rentré' },
  { id: 'stock', label: 'Rayon vide' },
  { id: 'build', label: 'Étage prêt' },
  { id: 'research', label: 'Recherche finie' },
  { id: 'recruit', label: 'Recrue gratuite' },
  { id: 'daily', label: 'Cadeau du jour' },
];

/** No reminder between 22 h and 8 h (local time): it waits until 8 h. */
export const QUIET_FROM = 22;
export const QUIET_TO = 8;

export function outOfNight(at: number): number {
  const d = new Date(at);
  const h = d.getHours();
  if (h >= QUIET_TO && h < QUIET_FROM) return at;
  if (h >= QUIET_FROM) d.setDate(d.getDate() + 1);
  d.setHours(QUIET_TO, 0, 0, 0);
  return d.getTime();
}

/** What to schedule: enabled kinds, at least a minute away, out of the night, one per kind. */
export function reminders(state: GameState, now: number, off: string[] = settings.notifOff) {
  return G.plannedNotifications(state, now)
    .filter((n) => !off.includes(n.id) && n.at - now >= 60_000)
    .map((n) => ({ ...n, at: outOfNight(n.at) }));
}

const native = Capacitor.isNativePlatform();
const numId = (kind: string) => 100 + Math.max(0, NOTIF_KINDS.findIndex((k) => k.id === kind));

/** Asks Android for permission (Android 13+ shows its dialog). */
export async function askPermission(): Promise<boolean> {
  if (!native) return false;
  try {
    const p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleReminders(state: GameState) {
  if (!native || !settings.notif) return;
  try {
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
    await cancelReminders();
    const list = reminders(state, Date.now());
    if (!list.length) return;
    await LocalNotifications.schedule({
      notifications: list.map((n) => ({ id: numId(n.id), title: 'IdlePort', body: n.text, schedule: { at: new Date(n.at), allowWhileIdle: true } })),
    });
  } catch {
    /* reminders are a bonus */
  }
}

export async function cancelReminders() {
  if (!native) return;
  try {
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
  } catch {
    /* nothing to cancel */
  }
}

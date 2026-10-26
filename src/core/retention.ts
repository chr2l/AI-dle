// Retention: daily reward, daily quests, achievements, planned notifications (GDD §18).
import { ACHIEVEMENTS, type AchievementDef, DAILY_REWARDS, type DailyReward, QUESTS, QUESTS_PER_DAY, QUEST_CHEST_MILES, QUEST_COINS_PER_LEVEL, QUEST_MILES, type QuestDef } from './data/retention';
import { RESTOCK_TIERS } from './data/shops';
import { DAY_MS, MAX_CREW } from './formulas';
import { type Result, rollCrewMember } from './engine';
import { type Rng, hashString, mulberry32 } from './rng';
import { shopRate } from './stats';
import type { GameState } from './types';

const fail = (error: string): Result<never> => ({ ok: false, error });

export const dayIndex = (now: number) => Math.floor(now / DAY_MS);

function earn(state: GameState, coins: number) {
  state.coins += coins;
  state.stats.totalCoins += coins;
}

// --- Daily reward ----------------------------------------------------------------

export function dailyStatus(state: GameState, now: number): { available: boolean; streak: number; reward: DailyReward } {
  const today = dayIndex(now);
  const available = state.daily.claimedDay !== today;
  const streak = !available ? state.daily.streak : state.daily.claimedDay === today - 1 ? state.daily.streak + 1 : 1;
  return { available, streak, reward: DAILY_REWARDS[(streak - 1) % DAILY_REWARDS.length] };
}

/** Claims today's reward. Missing a day restarts the 7-day cycle at day 1. */
export function claimDaily(state: GameState, now: number, rng: Rng = Math.random): Result<DailyReward> {
  const status = dailyStatus(state, now);
  if (!status.available) return fail('Récompense déjà récupérée aujourd’hui.');
  const reward = status.reward;
  if (reward.kind === 'coins') earn(state, reward.perLevel * state.level);
  else if (reward.kind === 'miles') state.miles += reward.amount;
  else if (state.crew.length < MAX_CREW) {
    state.crew.push(rollCrewMember(rng, reward.premium ? 'premium' : 'standard'));
    state.stats.recruits++;
  } else state.miles += reward.premium ? 30 : 5; // crew full: compensation
  state.daily = { streak: status.streak, claimedDay: dayIndex(now) };
  return { ok: true, value: reward };
}

// --- Daily quests ----------------------------------------------------------------

export interface QuestView {
  def: QuestDef;
  text: string;
  goal: number;
  progress: number;
  done: boolean;
  claimed: boolean;
}

/** Rolls today's 3 quests if the day changed. Progress counts from the moment they are rolled. */
export function refreshQuests(state: GameState, now: number) {
  const today = dayIndex(now);
  if (state.quests.day === today) return;
  const rng = mulberry32(hashString(`${state.seed}:quests:${today}`));
  const pool = QUESTS.filter((q) => state.level >= (q.minLevel ?? 1));
  const ids: string[] = [];
  while (ids.length < Math.min(QUESTS_PER_DAY, pool.length)) {
    const q = pool[Math.floor(rng() * pool.length)];
    if (!ids.includes(q.id)) ids.push(q.id);
  }
  const base: Record<string, number> = {};
  for (const id of ids) {
    const stat = QUESTS.find((q) => q.id === id)!.stat;
    base[stat] = state.stats[stat];
  }
  state.quests = { day: today, ids, base, claimed: ids.map(() => false), chestClaimed: false };
}

export function questViews(state: GameState, now: number): QuestView[] {
  refreshQuests(state, now);
  return state.quests.ids.map((id, i) => {
    const def = QUESTS.find((q) => q.id === id)!;
    const goal = def.goal(state.level);
    const progress = Math.min(goal, Math.floor(state.stats[def.stat] - (state.quests.base[def.stat] ?? 0)));
    return { def, text: def.text.replace('{n}', goal.toLocaleString('fr-FR')), goal, progress, done: progress >= goal, claimed: state.quests.claimed[i] };
  });
}

export function claimQuest(state: GameState, index: number, now: number): Result {
  const quest = questViews(state, now)[index];
  if (!quest) return fail('Quête introuvable.');
  if (quest.claimed) return fail('Déjà récupérée.');
  if (!quest.done) return fail('Quête pas encore terminée.');
  state.quests.claimed[index] = true;
  state.miles += QUEST_MILES;
  earn(state, QUEST_COINS_PER_LEVEL * state.level);
  return { ok: true, value: undefined };
}

/** Bonus chest once the 3 quests of the day are claimed. */
export function claimQuestChest(state: GameState, now: number): Result {
  refreshQuests(state, now);
  if (state.quests.chestClaimed) return fail('Coffre déjà ouvert.');
  if (!state.quests.claimed.every(Boolean) || state.quests.claimed.length === 0) return fail('Terminez les 3 quêtes du jour.');
  state.quests.chestClaimed = true;
  state.miles += QUEST_CHEST_MILES;
  return { ok: true, value: undefined };
}

// --- Achievements ----------------------------------------------------------------

export function achievementViews(state: GameState): { def: AchievementDef; progress: number; done: boolean; claimed: boolean }[] {
  return ACHIEVEMENTS.map((def) => {
    const progress = Math.min(def.goal, def.progress(state));
    return { def, progress, done: progress >= def.goal, claimed: state.achievements.includes(def.id) };
  });
}

export function claimAchievement(state: GameState, id: string): Result<number> {
  const view = achievementViews(state).find((a) => a.def.id === id);
  if (!view) return fail('Succès inconnu.');
  if (view.claimed) return fail('Déjà récupéré.');
  if (!view.done) return fail('Pas encore atteint.');
  state.achievements.push(id);
  state.miles += view.def.miles;
  return { ok: true, value: view.def.miles };
}

// --- Planned local notifications ---------------------------------------------------

export interface PlannedNotification {
  id: string;
  at: number;
  text: string;
}

/**
 * What the app should schedule as local notifications when the player leaves
 * (Capacitor LocalNotifications later). One per kind, the earliest first.
 */
export function plannedNotifications(state: GameState, now: number): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const firstLanding = Math.min(...state.planes.map((p) => p.flight?.endsAt ?? Infinity));
  if (firstLanding > now && firstLanding < Infinity) out.push({ id: 'flight', at: firstLanding, text: '✈️ Un avion vient d’atterrir : venez récupérer la recette !' });

  const emptyAt = state.floors
    .map((f, i) => {
      const shop = f.shop;
      if (!shop) return Infinity;
      if (shop.restock) return shop.restock.endsAt + RESTOCK_TIERS[shop.restock.tier].durationSec * 1000;
      const rate = shopRate(state, i);
      return shop.stock > 0 && rate > 0 ? now + (shop.stock / rate) * 1000 : Infinity;
    })
    .reduce((a, b) => Math.min(a, b), Infinity);
  if (emptyAt < Infinity) out.push({ id: 'stock', at: emptyAt, text: '🛍️ Un rayon est vide : vos clients attendent !' });

  const build = state.floors.find((f) => f.buildEndsAt !== undefined)?.buildEndsAt;
  if (build && build > now) out.push({ id: 'build', at: build, text: '🏗️ Votre nouvel étage est prêt.' });
  if (state.researching && state.researching.endsAt > now) out.push({ id: 'research', at: state.researching.endsAt, text: '🔬 Recherche terminée !' });

  const recruitAt = state.cooldowns.free_recruit ?? 0;
  if (recruitAt > now) out.push({ id: 'recruit', at: recruitAt, text: '🧑‍✈️ Un recrutement gratuit vous attend à l’agence.' });

  if (!dailyStatus(state, now).available) {
    out.push({ id: 'daily', at: (dayIndex(now) + 1) * DAY_MS + 9 * 3600 * 1000, text: `🎁 Jour ${(state.daily.streak % 7) + 1} : votre cadeau quotidien est prêt.` });
  }
  return out.sort((a, b) => a.at - b.at);
}

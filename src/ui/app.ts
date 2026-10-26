// Playable DOM interface around the cube art tower view (towerView.ts).
// Every action maps to one engine call; the screen is redrawn once per
// second and after each action. Layout: HUD, guide banner, tower with the
// mission journal (Tour tab), tab panel, bottom tabs, bottom sheet (#modal).
import * as G from '../core';
import { COUNTRIES, COUNTRY_BY_ID, RING_LEVELS } from '../core/data/countries';
import { PREMIUM_RECRUIT_MILES, ROLE_INFO, ROLES, TRAIT_BY_ID } from '../core/data/crew';
import { EVENT_BY_ID } from '../core/data/events';
import { DAILY_REWARDS, QUEST_CHEST_MILES, QUEST_MILES } from '../core/data/retention';
import { DECO_BY_ID, TECHS, type TechDef } from '../core/data/research';
import { MAX_STAT_LEVEL, MODULE_BY_ID, MODULES, PLANE_BY_ID, PLANE_MODELS, STAT_INFO, STAT_KEYS } from '../core/data/planes';
import { CATEGORIES, CATEGORY_IDS, RARITY_INFO, RESTOCK_TIERS, SHOP_BY_ID } from '../core/data/shops';
import { VIP_BY_ID } from '../core/data/vips';
import type { SeasonReward } from '../core/data/seasons';
import type { CrewMember, CrewRole, Destination, GameState, PlaneState, StatKey } from '../core';
import { HELP } from './help';
import { planeSnapshot } from './planeSnapshot';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/lilita-one/latin-400.css';
import './style.css';
import { TowerView } from './towerView';
import { confetti, flyTo, haptic, isMuted, sound, toggleMute } from './fx';
import { FEATURES, guideStep, isTabOpen, tabBadges, unlocked, type Feature, type Tab } from './tutorial';
import { bar, button, chip, dur, esc, fmt, lack, pips, section, sheetHead, timerBar } from './widgets';

export { dur, fmt } from './widgets';

const TABS: { id: Tab; icon: string; name: string }[] = [
  { id: 'tour', icon: '🏢', name: 'Tour' },
  { id: 'vols', icon: '✈️', name: 'Vols' },
  { id: 'equipe', icon: '👨‍✈️', name: 'Équipe' },
  { id: 'objectifs', icon: '🎯', name: 'Objectifs' },
  { id: 'amis', icon: '👋', name: 'Amis' },
];

type VolsView = 'avions' | 'pays' | 'recherche';

const WELCOME_KEY = 'idleport.welcome';
const UNLOCKED_KEY = 'idleport.unlocked';
const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: the welcome screen will just show again */
    }
  },
};

const ROLE_BONUS: Record<CrewRole, (pts: number) => string> = {
  pilot: (p) => `+${(100 * G.PILOT_SPEED_PER_POINT * p).toFixed(1)} % vitesse`,
  cabin: (p) => `+${Math.floor(G.CABIN_COMFORT_PER_POINT * p)} confort`,
  mechanic: (p) => `+${(G.MECHANIC_RELIABILITY_PER_POINT * p).toFixed(1)} fiabilité`,
};

function techEffect(t: TechDef): string {
  const e = t.effect;
  if (e.type === 'module') return `Équipement d’avion : ${MODULE_BY_ID[e.moduleId].emoji} ${MODULE_BY_ID[e.moduleId].name} (${MODULE_BY_ID[e.moduleId].desc})`;
  if (e.type === 'deco') return `Décoration : ${DECO_BY_ID[e.decoId].emoji} ${DECO_BY_ID[e.decoId].name} (${DECO_BY_ID[e.decoId].desc})`;
  const shop = SHOP_BY_ID[e.shopId];
  return `Nouveau magasin possible : ${shop.emoji} ${shop.name}${e.resourcePct ? ` · +${100 * e.resourcePct} % ressources du pays` : ''}`;
}

export class App {
  private tab: Tab = 'tour';
  private volsView: VolsView = 'avions';
  private sheet: (() => string) | null = null;
  /** The sheet holds a text field: do not redraw it every second. */
  private sheetStatic = false;
  /** An event choice is waiting: the sheet cannot be dismissed. */
  private sheetLocked = false;
  private toastTimer = 0;
  private tower?: TowerView;
  private pointerDown = false;
  private pointer = { x: innerWidth / 2, y: innerHeight / 2 };
  private flash: { key: string; until: number } | null = null;
  private lastCoins = 0;
  private lastLevel = 0;
  /** Features already announced (see FEATURES). */
  private known: Set<Feature>;
  private offline?: G.TickResult;
  /** Local stand-in until a social server exists: friend codes cannot be found yet. */
  private social: G.SocialBackend = new G.MemorySocialBackend();

  constructor(private state: GameState, private root: HTMLElement) {
    root.innerHTML =
      `<header id="hud"></header><div id="guide"></div>` +
      `<div id="tower"><canvas></canvas><div id="journal"></div></div>` +
      `<main id="panel"></main><nav id="tabs"></nav><div id="modal" hidden></div><div id="toast" hidden></div><div id="fx"></div>`;
    root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'modal' && !this.sheetLocked) return this.run('close', []);
      const locked = target.closest<HTMLElement>('[data-why]');
      if (locked) {
        this.toast(locked.dataset.why!, 'err');
        locked.classList.remove('shake');
        void locked.offsetWidth;
        locked.classList.add('shake');
        return;
      }
      const el = target.closest<HTMLElement>('[data-act]');
      if (el) this.run(el.dataset.act!, JSON.parse(el.dataset.args ?? '[]'));
    });
    // A redraw under the finger would swallow the tap: wait for the release.
    root.addEventListener('pointerdown', (e) => {
      this.pointerDown = true;
      this.pointer = { x: e.clientX, y: e.clientY };
    });
    addEventListener('pointerup', () => (this.pointerDown = false));
    addEventListener('pointercancel', () => (this.pointerDown = false));
    this.swipeTabs();
    this.lastCoins = state.coins;
    this.lastLevel = state.level;
    let known: Feature[] | null = null;
    try {
      known = JSON.parse(storage.get(UNLOCKED_KEY) ?? 'null');
    } catch {
      known = null;
    }
    // Existing saves: do not announce what the player already had.
    this.known = new Set(known ?? [...unlocked(state)]);
    storage.set(UNLOCKED_KEY, JSON.stringify([...this.known]));
  }

  private openTabs() {
    const open = unlocked(this.state);
    return TABS.filter((t) => isTabOpen(t.id, open));
  }

  private goTab(tab: Tab) {
    if (tab === this.tab) return;
    const tabs = TABS.map((t) => t.id);
    const forward = tabs.indexOf(tab) > tabs.indexOf(this.tab);
    this.tab = tab;
    const p = this.root.querySelector<HTMLElement>('#panel')!;
    p.classList.remove('from-left', 'from-right');
    void p.offsetWidth;
    p.classList.add(forward ? 'from-right' : 'from-left');
    sound('whoosh');
  }

  /** Horizontal swipe on the panel switches to the next or previous tab. */
  private swipeTabs() {
    let start: { x: number; y: number; t: number } | null = null;
    this.root.addEventListener('touchstart', (e) => {
      const t = e.target as HTMLElement;
      start = t.closest('#panel, #guide, #journal') && !t.closest('input') ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
    }, { passive: true });
    this.root.addEventListener('touchend', (e) => {
      if (!start || this.sheet) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      if (Math.abs(dx) < 70 || Math.abs(dx) < 2 * Math.abs(dy) || Date.now() - start.t > 600) return;
      const tabs = this.openTabs();
      const i = tabs.findIndex((t) => t.id === this.tab);
      const next = tabs[i + (dx < 0 ? 1 : -1)];
      if (next) this.run('tab', [next.id]);
    }, { passive: true });
  }

  /** Idle loop: simulation every frame, redraw every second, autosave. */
  start() {
    try {
      this.tower = new TowerView(this.root.querySelector<HTMLCanvasElement>('#tower canvas')!);
    } catch (e) {
      console.warn('Rendu 3D indisponible', e);
      this.root.querySelector<HTMLElement>('#tower canvas')!.remove();
    }
    void this.social.publish(G.publicProfile(this.state, Date.now()));
    const frame = () => {
      G.update(this.state, Date.now());
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    setInterval(() => {
      if (!this.pointerDown) this.render();
    }, 1000);
    setInterval(() => G.save(this.state), 10_000);
    window.addEventListener('pagehide', () => G.save(this.state));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) G.save(this.state);
    });
    if (!storage.get(WELCOME_KEY) && !this.sheet) this.openHelp('welcome');
  }

  private get now() {
    return Date.now();
  }

  toast(text: string, kind: 'ok' | 'err' | 'info' = 'info') {
    const el = this.root.querySelector<HTMLElement>('#toast')!;
    el.textContent = text;
    el.className = kind;
    el.hidden = false;
    if (kind === 'err') {
      sound('error');
      haptic('error');
    } else if (kind === 'ok') {
      sound('success');
      haptic('success');
    }
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.hidden = true), kind === 'err' ? 3200 : 2400);
  }

  /** Floating gain (« +120 🪙 ») rising from the last tap. */
  private float(text: string) {
    const el = document.createElement('div');
    el.className = 'float';
    el.textContent = text;
    el.style.left = `${Math.min(innerWidth - 60, Math.max(60, this.pointer.x))}px`;
    el.style.top = `${this.pointer.y - 20}px`;
    const fx = this.root.querySelector<HTMLElement>('#fx')!;
    fx.append(el);
    setTimeout(() => el.remove(), 1300);
    const icon = text.includes('🪙') ? '🪙' : text.includes('✈️') ? '✈️' : '';
    if (icon) {
      flyTo(fx, this.pointer, this.root.querySelector(`#hud [data-res="${icon === '🪙' ? 'coins' : 'miles'}"]`), icon, icon === '🪙' ? 7 : 4);
      setTimeout(() => sound('coin'), 600);
    }
  }

  private burst() {
    confetti(this.root.querySelector<HTMLElement>('#fx')!, this.pointer);
  }

  /** Shows a Result's error, or `success` when it went through. */
  private check(res: G.Result<unknown>, success?: string) {
    if (!res.ok) this.toast(res.error, 'err');
    else if (success) this.toast(success, 'ok');
    return res.ok;
  }

  showOffline(off: G.TickResult) {
    if (off.seconds < 60 || off.coins < 1) return;
    this.offline = off;
    this.sheet = () =>
      sheetHead('Bon retour !', `Absent ${dur(off.seconds * 1000)}`) +
      `<div class="reward-big">+${fmt(off.coins)} 🪙</div><p class="center">Vos magasins ont continué de vendre${off.flightsLanded ? ` et ${off.flightsLanded} avion(s) sont rentrés : allez les récupérer dans Vols` : ''}.</p>` +
      (off.doubled ? '' : button({ act: 'doubleOffline', label: '📺 Doubler les gains', sub: 'Regarder une pub', kind: 'ad', wide: true })) +
      button({ act: 'close', label: 'Continuer', kind: 'ghost', wide: true });
    this.render();
  }

  private openHelp(key: string) {
    const h = HELP[key];
    if (!h) return;
    this.sheet = () =>
      sheetHead(h.title) + `<ul class="help">${h.body.map((b) => `<li>${b}</li>`).join('')}</ul>` +
      button({ act: key === 'welcome' ? 'welcomeDone' : 'close', label: key === 'welcome' ? 'C’est parti !' : 'Compris', kind: 'main', wide: true });
  }

  private openInput(title: string, sub: string, value: string, act: string, args: unknown[] = [], max = 20) {
    this.sheetStatic = true;
    this.sheet = () =>
      sheetHead(title, sub) +
      `<input id="inp" maxlength="${max}" value="${esc(value)}" autocomplete="off" />` +
      button({ act, args, label: 'Valider', kind: 'main', wide: true });
    this.render();
    const inp = this.root.querySelector<HTMLInputElement>('#inp');
    inp?.focus();
    inp?.select();
  }

  private inputValue() {
    return this.root.querySelector<HTMLInputElement>('#inp')?.value ?? '';
  }

  private closeSheet() {
    this.sheet = null;
    this.sheetStatic = false;
    this.sheetLocked = false;
  }

  private run(act: string, a: any[]) {
    const s = this.state;
    const now = this.now;
    if (act !== 'tab') {
      sound('tap');
      haptic();
    }
    switch (act) {
      case 'tab':
        this.goTab(a[0]);
        if (a[1]) this.volsView = a[1];
        if (this.sheet && !this.sheetLocked) this.closeSheet();
        break;
      case 'mute':
        this.toast(toggleMute() ? 'Son coupé 🔇' : 'Son activé 🔊');
        break;
      case 'vols':
        this.volsView = a[0];
        break;
      case 'close':
        this.closeSheet();
        break;
      case 'help':
        this.openHelp(a[0]);
        break;
      case 'welcomeDone':
        storage.set(WELCOME_KEY, '1');
        this.closeSheet();
        break;
      case 'doubleOffline':
        if (this.offline && this.check(G.doubleOffline(s, this.offline), 'Gains doublés !')) this.float(`+${fmt(this.offline.coins)} 🪙`);
        this.closeSheet();
        break;
      case 'mission': {
        const res = G.claimMission(s);
        if (this.check(res, 'Mission accomplie !') && res.ok) {
          this.float(`+${res.value.miles} ✈️${res.value.coins ? ` +${res.value.coins} 🪙` : ''}`);
          this.burst();
        }
        break;
      }

      // --- Tour ---------------------------------------------------------------
      case 'floor':
        this.sheet = () => this.floorSheet(a[0]);
        break;
      case 'build':
        this.check(G.buildFloor(s, now), 'Construction lancée 🏗️');
        break;
      case 'rush':
        this.check(G.rush(s, a[0], now), 'Terminé ⚡');
        break;
      case 'openShop': {
        const res = G.openShop(s, a[0], a[1]);
        if (res.ok) {
          this.toast(`Nouveau magasin : ${SHOP_BY_ID[res.value].emoji} ${SHOP_BY_ID[res.value].name} (${RARITY_INFO[SHOP_BY_ID[res.value].rarity].name})`, 'ok');
          this.sheet = () => this.floorSheet(a[0]);
        } else this.toast(res.error, 'err');
        break;
      }
      case 'placePlan':
        if (this.check(G.placePlan(s, a[0], a[1]), 'Plan installé')) this.sheet = () => this.floorSheet(a[1]);
        break;
      case 'reroll':
        this.check(G.rerollShop(s, a[0], a[1]), 'Nouveau tirage 🎲');
        break;
      case 'restock':
        if (this.check(G.restock(s, a[0], a[1], now), 'Commande passée 📦')) this.closeSheet();
        break;
      case 'express':
        this.check(G.restockExpress(s, a[0], 0, now), 'Livraison express !');
        break;
      case 'upgradeShop':
        if (this.check(G.upgradeShop(s, a[0]), `Magasin niveau ${(s.floors[a[0]].shop?.level ?? 0)} !`)) this.flashKey(`shop-${a[0]}`);
        break;
      case 'guide': {
        const res = G.guidePassenger(s, a[0], now);
        if (res.ok) {
          this.float(`+${res.value.coins} 🪙${res.value.miles ? ' +1 ✈️' : ''}`);
          this.toast('Passager guidé, merci !', 'ok');
          this.closeSheet();
        } else this.toast(res.error, 'err');
        break;
      }
      case 'vip':
        this.sheet = () => this.vipSheet(a[0]);
        break;
      case 'useVip':
        if (this.check(G.useVip(s, a[0], now), 'Pouvoir utilisé !')) this.closeSheet();
        break;
      case 'lounge':
        if (this.check(G.upgradeLounge(s), 'Salle agrandie !')) this.flashKey('lounge');
        break;
      case 'fusionPick':
        this.sheet = () => this.fusionSheet(a[0]);
        break;
      case 'fusion': {
        const res = G.startFusion(s, a[0], a[1], now);
        if (this.check(res, 'Fusion lancée 🧪')) this.closeSheet();
        break;
      }
      case 'franchise': {
        const res = G.franchise(s, now);
        if (res.ok) {
          this.state = res.value;
          this.toast('Nouvelle franchise ouverte !', 'ok');
          this.closeSheet();
        } else this.toast(res.error, 'err');
        break;
      }
      case 'franchiseAsk':
        this.sheet = () =>
          sheetHead('🌟 Ouvrir une franchise ?', 'Tout recommence à zéro, sauf vos étoiles de prestige.') +
          `<div class="reward-big">+${G.pendingStars(s)} ⭐</div><p class="center">Chaque étoile : +5 % sur tous les gains, pour toujours.</p>` +
          button({ act: 'franchise', label: 'Franchiser', kind: 'danger', wide: true, why: G.canFranchise(s).ok ? false : (G.canFranchise(s) as { error: string }).error }) +
          button({ act: 'close', label: 'Plus tard', kind: 'ghost', wide: true });
        break;

      // --- Vols ---------------------------------------------------------------
      case 'pickDest':
        this.sheet = () => this.destSheet(a[0]);
        break;
      case 'send': {
        const vips = s.vips.filter((v) => v.demand?.countryId === a[1].countryId).map((v) => v.uid);
        if (this.check(G.sendFlight(s, a[0], a[1], now, vips), vips.length ? `Décollage avec ${vips.length} VIP !` : 'Décollage ! 🛫')) this.closeSheet();
        break;
      }
      case 'tailwind':
        this.check(G.speedUpFlight(s, a[0], now), 'Vent arrière : vol raccourci !');
        break;
      case 'collect': {
        const res = G.collectFlight(s, a[0], now);
        if (res.ok) {
          if (!res.value.pending) this.float(`+${fmt(res.value.coins + res.value.vipCoins)} 🪙`);
          this.showReport(res.value.id);
        } else this.toast(res.error, 'err');
        break;
      }
      case 'choose': {
        const res = G.resolveEvent(s, a[0], a[1]);
        if (res.ok) this.showReport(a[0]);
        else this.toast(res.error, 'err');
        break;
      }
      case 'showReport':
        this.showReport(a[0]);
        break;
      case 'doubleReport':
        this.check(G.doubleReport(s, a[0]), 'Récolte doublée !');
        break;
      case 'repair':
        this.check(G.repairPlane(s, a[0], a[1], now), 'Réparation lancée 🔧');
        break;
      case 'shop':
        this.sheet = () => this.planeShopSheet();
        break;
      case 'buyPlane': {
        const res = G.buyPlane(s, a[0]);
        if (res.ok) {
          this.toast(`Nouvel avion : ${res.value.name} !`, 'ok');
          this.closeSheet();
          this.goTab('vols');
          this.volsView = 'avions';
          this.burst();
          requestAnimationFrame(() => this.root.querySelector(`[data-plane="${res.value.uid}"]`)?.scrollIntoView());
        } else this.toast(res.error, 'err');
        break;
      }
      case 'upgradePlane':
        if (this.check(G.upgradePlane(s, a[0], a[1]), `${STAT_INFO[a[1] as StatKey].name} améliorée !`)) this.flashKey(`stat-${a[0]}-${a[1]}`);
        break;
      case 'jumpPlane':
        this.root.querySelector(`[data-plane="${a[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      case 'renamePlane': {
        const p = s.planes.find((x) => x.uid === a[0]);
        if (p) this.openInput('✏️ Renommer l’avion', PLANE_BY_ID[p.modelId].name, p.name, 'renamePlaneOk', [p.uid], 16);
        return;
      }
      case 'renamePlaneOk':
        if (this.check(G.renamePlane(s, a[0], this.inputValue()), 'Avion renommé')) this.closeSheet();
        break;
      case 'seat':
        this.sheet = () => this.seatSheet(a[0], a[1]);
        break;
      case 'seatAssign':
        if (this.check(G.assignCrew(s, a[0], a[1]), 'Équipier en place')) {
          this.closeSheet();
          this.flashKey(`seat-${a[1]}`);
        }
        break;
      case 'unassign':
        if (this.check(G.unassignCrew(s, a[0]), 'Équipier retiré')) this.closeSheet();
        break;
      case 'slot':
        this.sheet = () => this.moduleSheet(a[0], a[1]);
        break;
      case 'setModule':
        if (this.check(G.setModule(s, a[0], a[1], a[2]), a[2] ? 'Équipement installé' : 'Emplacement vidé')) this.closeSheet();
        break;
      case 'research':
        this.check(G.startResearch(s, a[0], now), 'Recherche lancée 🔬');
        break;

      // --- Équipe -------------------------------------------------------------
      case 'recruit': {
        const res = G.recruit(s, a[0], now);
        if (res.ok) {
          const m = res.value;
          this.sheet = () =>
            sheetHead('Nouvelle recrue !') +
            `<div class="recruit-card" style="--rc:${RARITY_INFO[m.rarity].color}"><div class="avatar">${ROLE_INFO[m.role].emoji}</div><b>${esc(m.name)}</b><span>${ROLE_INFO[m.role].name} · ${RARITY_INFO[m.rarity].name}</span></div>` +
            this.traitsHtml(m) +
            button({ act: 'assignPick', args: [m.uid], label: 'Affecter à un avion', kind: 'main', wide: true }) +
            button({ act: 'close', label: 'Plus tard', kind: 'ghost', wide: true });
        } else this.toast(res.error, 'err');
        break;
      }
      case 'assignPick':
        this.sheet = () => this.assignSheet(a[0]);
        break;
      case 'assign':
        if (this.check(G.assignCrew(s, a[0], a[1]), 'Équipier affecté')) this.closeSheet();
        break;

      // --- Objectifs ----------------------------------------------------------
      case 'daily': {
        const res = G.claimDaily(s, now);
        if (this.check(res, 'Cadeau du jour récupéré 🎁') && res.ok) this.float('🎁');
        break;
      }
      case 'quest':
        if (this.check(G.claimQuest(s, a[0], now), 'Quête validée')) this.float('✔');
        break;
      case 'chest':
        if (this.check(G.claimQuestChest(s, now), 'Coffre ouvert !')) this.float('🧰');
        break;
      case 'achievement': {
        const res = G.claimAchievement(s, a[0]);
        if (this.check(res, 'Succès récupéré 🏆') && res.ok) this.float(`+${res.value} ✈️`);
        break;
      }
      case 'season': {
        const res = G.claimSeasonReward(s, a[0], now);
        if (res.ok) this.toast(`Palier récupéré : ${rewardLabel(res.value, s.level)}`, 'ok');
        else this.toast(res.error, 'err');
        break;
      }

      // --- Amis ---------------------------------------------------------------
      case 'rename':
        this.openInput('✏️ Votre nom', 'Visible par vos amis et dans le classement.', s.social.name, 'renameOk');
        return;
      case 'renameOk':
        if (this.check(G.setPlayerName(s, this.inputValue()), 'Nom enregistré')) this.closeSheet();
        break;
      case 'copyCode':
        void navigator.clipboard?.writeText(s.social.code).then(
          () => this.toast('Code copié !', 'ok'),
          () => this.toast(`Votre code : ${s.social.code}`),
        );
        break;
      case 'addFriend':
        this.openInput('➕ Ajouter un ami', 'Entrez le code ami de votre ami·e.', '', 'addFriendOk', [], 12);
        return;
      case 'addFriendOk': {
        const code = this.inputValue();
        if (code.trim()) void this.addFriend(code);
        this.closeSheet();
        break;
      }
      case 'gift': {
        const res = G.sendGift(s, a[0], now);
        if (res.ok) {
          void this.social.deliverGift(res.value);
          this.toast('Cadeau envoyé 🎁', 'ok');
        } else this.toast(res.error, 'err');
        break;
      }
      case 'visit': {
        const res = G.visitFriend(s, a[0], now);
        if (res.ok) this.float(`+${fmt(res.value.coins)} 🪙${res.value.miles ? ' +1 ✈️' : ''}`);
        else this.toast(res.error, 'err');
        break;
      }
      case 'removeFriend':
        this.check(G.removeFriend(s, a[0]), 'Ami retiré');
        break;
      case 'weekly': {
        const res = G.claimWeeklyReward(s, now);
        if (res.ok) this.float(`+${res.value} ✈️`);
        else this.toast(res.error, 'err');
        break;
      }
    }
    G.save(this.state);
    this.render();
  }

  private flashKey(key: string) {
    this.flash = { key, until: this.now + 900 };
  }

  private showReport(id: string) {
    const r = this.state.reports.find((x) => x.id === id);
    this.sheetLocked = !!r?.pending;
    this.sheet = () => this.reportSheet(id);
  }

  // ---------------------------------------------------------------------------

  render() {
    const s = this.state;
    const now = this.now;
    const step = guideStep(s, now);
    const open = unlocked(s);
    if (!isTabOpen(this.tab, open)) this.tab = 'tour';
    this.root.style.setProperty('--phase', `-${now % 1600}ms`);
    this.renderHud();
    this.celebrate(open);

    const guide = this.root.querySelector<HTMLElement>('#guide')!;
    const showGuide = step && this.tab !== 'tour';
    guide.hidden = !showGuide;
    if (showGuide) {
      const there = TABS.find((t) => t.id === step.tab)!;
      guide.innerHTML =
        `<span class="bulb">💡</span><p>${esc(step.text)}</p>` +
        (G.currentMission(s)?.done
          ? button({ act: 'mission', label: 'Récupérer', kind: 'main', small: true })
          : step.tab !== this.tab || (step.view && step.view !== this.volsView) ? button({ act: 'tab', args: [step.tab, step.view], label: `Aller ${there.icon}`, kind: 'main', small: true }) : '');
    }

    const badges = tabBadges(s, now);
    this.root.querySelector('#tabs')!.innerHTML = this.openTabs().map(
      (t) =>
        `<button class="${t.id === this.tab ? 'on' : ''}" data-act="tab" data-args='["${t.id}"]' data-tab="${t.id}">` +
        `<span class="ti">${t.icon}</span><span>${t.name}</span>${badges[t.id] ? `<i class="badge">${badges[t.id] > 9 ? '9+' : badges[t.id]}</i>` : ''}</button>`,
    ).join('');

    const towerBox = this.root.querySelector<HTMLElement>('#tower')!;
    towerBox.hidden = this.tab !== 'tour';
    if (!towerBox.hidden) {
      this.tower?.update(s);
      this.root.querySelector('#journal')!.innerHTML = this.journal(now, step);
    }

    const panel = this.root.querySelector<HTMLElement>('#panel')!;
    // A new tab or sub-view starts at the top.
    const view = `${this.tab}:${this.volsView}`;
    const scrolls = panel.dataset.view === view ? this.saveScroll(panel) : new Map<string, number>();
    panel.dataset.view = view;
    panel.dataset.tab = this.tab;
    panel.innerHTML = { tour: () => this.tour(now), vols: () => this.vols(now), equipe: () => this.equipe(now), amis: () => this.amis(now), objectifs: () => this.objectifs(now) }[this.tab]();
    this.restoreScroll(panel, scrolls);

    const modal = this.root.querySelector<HTMLElement>('#modal')!;
    const wasHidden = modal.hidden;
    modal.hidden = !this.sheet;
    if (this.sheet && (!this.sheetStatic || wasHidden || !modal.querySelector('#inp'))) {
      const card = modal.querySelector<HTMLElement>('.card');
      const top = card?.scrollTop ?? 0;
      modal.innerHTML = `<div class="card${wasHidden ? ' rise' : ''}">${this.sheet()}</div>`;
      modal.querySelector<HTMLElement>('.card')!.scrollTop = top;
    }

    // Tutorial highlight: the tab to open, else the button to touch.
    this.root.querySelectorAll('.pulse').forEach((el) => el.classList.remove('pulse'));
    if (step) {
      if (step.tab !== this.tab && !this.sheet) this.root.querySelector(`#tabs [data-tab="${step.tab}"]`)?.classList.add('pulse');
      else if (step.view && step.view !== this.volsView && !this.sheet) this.root.querySelector(`.seg [data-view="${step.view}"]`)?.classList.add('pulse');
      else if (step.target) {
        const scope = this.sheet ? modal : this.root;
        scope.querySelector(`[data-tuto="${step.target}"]`)?.classList.add('pulse');
      }
    }
    if (this.flash && this.flash.until > now) this.root.querySelectorAll(`[data-key="${this.flash.key}"]`).forEach((el) => el.classList.add('flash'));
  }

  /** Level ups and newly unlocked features get their moment. */
  private celebrate(open: Set<Feature>) {
    const s = this.state;
    const fx = this.root.querySelector<HTMLElement>('#fx')!;
    const center = { x: innerWidth / 2, y: innerHeight / 3 };
    if (s.level > this.lastLevel) {
      sound('levelup');
      haptic('success');
      confetti(fx, center, 40);
      const el = document.createElement('div');
      el.className = 'levelup';
      el.innerHTML = `<small>Niveau supérieur !</small><b>⭐ ${s.level}</b>`;
      fx.append(el);
      setTimeout(() => el.remove(), 2200);
    }
    this.lastLevel = s.level;
    if (this.sheet) return;
    const fresh = [...open].find((f) => !this.known.has(f));
    if (!fresh) return;
    this.known.add(fresh);
    storage.set(UNLOCKED_KEY, JSON.stringify([...this.known]));
    const f = FEATURES[fresh];
    const tab = (['vols', 'equipe', 'objectifs', 'amis'] as const).find((t) => t === fresh) ?? (fresh === 'recherche' ? 'vols' : fresh === 'saison' ? 'objectifs' : 'tour');
    this.sheet = () =>
      `<div class="unlock"><div class="uicon">${f.icon}</div><small>Nouveau !</small><h2>${f.name}</h2><p>${f.text}</p></div>` +
      button({ act: 'tab', args: [tab, fresh === 'recherche' ? 'recherche' : undefined], label: 'Découvrir', kind: 'main', wide: true }) +
      button({ act: 'close', label: 'Plus tard', kind: 'ghost', wide: true });
    sound('levelup');
    setTimeout(() => confetti(fx, center, 30), 150);
  }

  private saveScroll(panel: HTMLElement) {
    const map = new Map<string, number>([['panel', panel.scrollTop]]);
    panel.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) => map.set(el.dataset.scroll!, el.scrollTop));
    return map;
  }

  private restoreScroll(panel: HTMLElement, map: Map<string, number>) {
    panel.scrollTop = map.get('panel') ?? 0;
    panel.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) => (el.scrollTop = map.get(el.dataset.scroll!) ?? 0));
  }

  private renderHud() {
    const s = this.state;
    const gained = s.coins > this.lastCoins + 0.5 && s.coins - this.lastCoins > G.totalShopRate(s) * 1.5;
    this.lastCoins = s.coins;
    const xpNeed = G.xpToNext(s.level);
    const res = (key: string, icon: string, value: string, label: string, cls = '') =>
      `<button class="res ${cls}" data-act="help" data-args='["${key}"]' data-res="${key}"><span class="ri">${icon}</span><span class="rv">${value}</span><span class="rl">${label}</span></button>`;
    this.root.querySelector('#hud')!.innerHTML =
      `<div class="res-row">` +
      res('coins', '🪙', fmt(s.coins), `+${G.totalShopRate(s).toFixed(1)}/s`, gained ? 'gain' : '') +
      res('miles', '✈️', String(s.miles), 'Miles') +
      res('lounge', '👥', `${Math.floor(s.lounge.passengers)}/${G.loungeCap(s)}`, 'Passagers') +
      `<div class="hud-btns"><button class="help-btn" data-act="help" data-args='["welcome"]' aria-label="Comment jouer">?</button><button class="help-btn" data-act="mute" aria-label="Son">${isMuted() ? '🔇' : '🔊'}</button></div></div>` +
      `<button class="lvl" data-act="help" data-args='["level"]'><b>⭐ Niv. ${s.level}</b>${bar(s.xp / xpNeed, 'xp')}<small>${fmt(s.xp)}/${fmt(xpNeed)} XP</small></button>`;
  }

  /** Mission journal laid over the tower view. */
  private journal(now: number, step: ReturnType<typeof guideStep>): string {
    const s = this.state;
    const mission = G.currentMission(s);
    const quests = G.questViews(s, now);
    const questsDone = quests.filter((q) => q.done).length;
    let html = `<div class="jhead"><b>📋 Journal</b><button class="info" data-act="help" data-args='["mission"]'>ⓘ</button></div>`;
    if (mission) {
      html +=
        `<div class="jmission"><b>${esc(mission.def.text)}</b>${bar(mission.progress / mission.def.goal)}` +
        `<small>${mission.progress}/${mission.def.goal} · 🎁 ${mission.def.miles} ✈️${mission.def.coins ? ` + ${mission.def.coins} 🪙` : ''}</small></div>`;
      if (mission.done) html += button({ act: 'mission', label: 'Récupérer', kind: 'main', small: true, wide: true, tuto: 'mission' });
      else if (step) html += `<p class="jhint">💡 ${esc(step.text)}${step.tab !== 'tour' ? ` ${button({ act: 'tab', args: [step.tab, step.view], label: `Aller ${TABS.find((t) => t.id === step.tab)!.icon}`, kind: 'main', small: true })}` : ''}</p>`;
    } else html += '<p class="jhint">Toutes les missions sont faites, bravo !</p>';
    html += `<button class="jquests" data-act="tab" data-args='["objectifs"]'>📅 Quêtes du jour ${questsDone}/${quests.length} ›</button>`;
    return html;
  }

  private rushBtn(target: G.RushTarget, now: number, tuto?: string) {
    const price = G.rushPrice(this.state, target, now);
    return price === undefined ? '' : button({ act: 'rush', args: [target], label: '⚡ Finir', sub: `${price} ✈️`, kind: 'rush', small: true, why: lack(this.state.miles, price, 'Miles ✈️'), tuto });
  }

  // --- Tour ------------------------------------------------------------------

  private tour(now: number): string {
    const s = this.state;
    const parts: string[] = [];

    // Hall: lounge, waiting VIPs, lost passenger.
    const cap = G.loungeCap(s);
    const upCost = G.loungeUpgradeCost(s.lounge.level);
    parts.push(section('🛎️ Hall', 'hall'));
    let hall =
      `<div class="card" data-key="lounge"><div class="line"><div class="grow"><b>Salle d’embarquement · niv. ${s.lounge.level}</b>` +
      `<small>${Math.floor(s.lounge.passengers)}/${cap} passagers · +${(G.arrivalRate(s) * 60).toFixed(0)} par minute</small>${bar(s.lounge.passengers / cap, s.lounge.passengers >= cap ? 'full' : 'blue')}</div>` +
      (s.lounge.level < G.MAX_LOUNGE_LEVEL
        ? button({ act: 'lounge', label: 'Agrandir', sub: `${fmt(upCost)} 🪙`, small: true, why: lack(s.coins, upCost, 'pièces 🪙') })
        : chip('MAX')) +
      `</div>`;
    if (s.lounge.passengers >= cap) hall += `<p class="note warn">Salle pleine : les nouveaux passagers repartent. Envoyez un avion !</p>`;
    const vips = s.vips.map((v) => {
      const def = VIP_BY_ID[v.defId];
      const c = v.demand && COUNTRY_BY_ID[v.demand.countryId];
      return `<button class="vip" data-act="vip" data-args='["${v.uid}"]'><span class="vava">${def.emoji}</span><b>${esc(def.name)}</b><small>${def.power ? '⚡ Pouvoir' : `→ ${c!.emoji} ${c!.name}`}</small><small>⏳ ${dur(v.expiresAt - now)}</small></button>`;
    });
    if (s.guide) vips.unshift(`<div class="vip lost"><span class="vava">🧍</span><b>Passager perdu</b><small>cherche l’étage ${s.guide.floor}</small><small>⏳ ${dur(s.guide.expiresAt - now)}</small></div>`);
    hall += vips.length ? `<div class="vips">${vips.join('')}</div>` : `<p class="note">Aucun VIP pour l’instant. Ils passent de temps en temps : revenez souvent !</p>`;
    parts.push(hall + '</div>');

    // Floors dashboard.
    const n = s.floors.length + 1;
    const building = s.floors.some((f) => f.buildEndsAt !== undefined);
    const max = G.maxFloors(s.level);
    parts.push(section(`🏢 Étages ${s.floors.length}/${max}`, 'floors'));
    if (n <= max) {
      parts.push(
        `<div class="card build"><div class="line"><div class="grow"><b>➕ Nouvel étage (n° ${n})</b><small>Chantier de ${dur(G.buildDuration(n) * 1000)}</small></div>` +
          button({
            act: 'build',
            label: 'Construire',
            sub: `${fmt(G.buildCost(n))} 🪙`,
            kind: 'main',
            tuto: 'build',
            why: building ? 'Un chantier est déjà en cours.' : lack(s.coins, G.buildCost(n), 'pièces 🪙'),
          }) +
          `</div></div>`,
      );
    } else parts.push(`<p class="note">Tour complète pour le niveau ${s.level}. Montez de niveau pour construire plus haut.</p>`);
    parts.push('<div class="floors">');
    for (let i = s.floors.length - 1; i >= 0; i--) parts.push(this.floorTile(i, now));
    parts.push('</div>');

    // Airport buildings.
    const open = unlocked(s);
    if (open.has('labo') || open.has('franchise')) parts.push(section('🏛️ Aéroport'));
    if (open.has('labo')) {
      const f = s.fusion;
      parts.push(
        `<button class="tile wide" data-act="${f ? 'help' : 'fusionPick'}" data-args='${f ? '["lab"]' : '[null]'}' data-tuto="fusion"><span class="ticon">🧪</span><span class="tbody"><b>Laboratoire de fusion</b>` +
          `<small>${f ? `En cours : ${SHOP_BY_ID[f.a].emoji} + ${SHOP_BY_ID[f.b].emoji} · ${dur(f.endsAt - now)}` : `Fusionnez 2 magasins → plan d’un nouveau magasin`} · ${s.plans.length} plan(s) en réserve</small></span>` +
          `<span class="tstate">${f ? '⏳' : '›'}</span></button>` +
          (f ? `<div class="right">${this.rushBtn({ kind: 'fusion' }, now)}</div>` : ''),
      );
    }
    if (s.level >= G.FRANCHISE_LEVEL) {
      parts.push(`<button class="tile wide" data-act="franchiseAsk"><span class="ticon">🌟</span><span class="tbody"><b>Franchise</b><small>Recommencer avec +${G.pendingStars(s)} ⭐ de prestige</small></span><span class="tstate">›</span></button>`);
    } else if (open.has('franchise')) parts.push(`<div class="tile wide off"><span class="ticon">🌟</span><span class="tbody"><b>Franchise</b><small>🔒 Se débloque au niveau ${G.FRANCHISE_LEVEL}</small></span></div>`);
    return parts.join('');
  }

  /** Compact dashboard tile of a floor; touching it opens its options. */
  private floorTile(i: number, now: number): string {
    const s = this.state;
    const floor = s.floors[i];
    const lost = s.guide?.floor === i + 1 ? '<i class="lostmark">🧍</i>' : '';
    const tile = (icon: string, title: string, sub: string, state: string, extra = '', tuto = '', color = 'var(--line)') =>
      `<button class="tile" data-act="floor" data-args="[${i}]" data-key="shop-${i}"${tuto ? ` data-tuto="${tuto}"` : ''} style="--rc:${color}">` +
      `<span class="fnum">${i + 1}</span><span class="ticon">${icon}</span><span class="tbody"><b>${title}</b><small>${sub}</small>${extra}</span><span class="tstate">${state}</span>${lost}</button>`;
    if (floor.buildEndsAt !== undefined) {
      return tile('🏗️', 'Chantier', `Prêt dans ${dur(floor.buildEndsAt - now)}`, '⏳', timerBar(floor.buildEndsAt, G.buildDuration(i + 1) * 1000, now), 'rush-build');
    }
    const shop = floor.shop;
    if (!shop) return tile('🚪', 'Étage vide', 'Touchez pour ouvrir un magasin', '<i class="need">!</i>', '', 'open');
    const def = SHOP_BY_ID[shop.defId];
    const rate = G.shopRate(s, i);
    const color = RARITY_INFO[def.rarity].color;
    const title = `${esc(def.name)} <span class="lv">niv. ${shop.level}${shop.stars > 1 ? ` ${'★'.repeat(shop.stars)}` : ''}</span>`;
    if (shop.restock) {
      const t = RESTOCK_TIERS[shop.restock.tier];
      return tile(def.emoji, title, `📦 Livraison dans ${dur(shop.restock.endsAt - now)}`, '⏳', timerBar(shop.restock.endsAt, t.restockSec * 1000, now, 'blue'), '', color);
    }
    if (shop.stock > 1e-6) {
      const up = shop.level < G.MAX_SHOP_LEVEL ? G.shopUpgradeCost(def.rarity, shop.level) : Infinity;
      const left = shop.stock / rate;
      return tile(def.emoji, title, `${rate.toFixed(1)} 🪙/s · stock pour ${dur(left * 1000)}`, s.coins >= up ? '<i class="can">⬆</i>' : '🪙', '', 'upgrade-shop', color);
    }
    return tile(def.emoji, title, '<span class="warn">Rayons vides ! Touchez pour commander</span>', '<i class="need">!</i>', '', 'restock', color);
  }

  private floorSheet(i: number): string {
    const s = this.state;
    const now = this.now;
    const floor = s.floors[i];
    if (!floor) return sheetHead('Étage') + button({ act: 'close', label: 'Fermer', wide: true });
    const guide = s.guide ? button({ act: 'guide', args: [i + 1], label: '🧍 Guider le passager ici', sub: `Il cherche l’étage ${s.guide.floor}`, kind: s.guide.floor === i + 1 ? 'main' : 'ghost', wide: true }) : '';
    if (floor.buildEndsAt !== undefined) {
      return sheetHead(`Étage ${i + 1} · chantier`, 'L’étage se construit tout seul.') +
        `<div class="card">${timerBar(floor.buildEndsAt, G.buildDuration(i + 1) * 1000, now)}<p class="center">Prêt dans <b>${dur(floor.buildEndsAt - now)}</b></p><div class="right">${this.rushBtn({ kind: 'build' }, now, 'rush-build')}</div></div>`;
    }
    const shop = floor.shop;
    if (!shop) {
      return sheetHead(`Étage ${i + 1} · vide`, 'Choisissez un type de magasin : le magasin exact est tiré au sort parmi ce type (plus ou moins rare).') +
        `<div class="grid">${CATEGORY_IDS.map((c) => button({ act: 'openShop', args: [i, c], label: `${CATEGORIES[c].emoji} ${CATEGORIES[c].name}`, sub: CATEGORIES[c].products.join(', '), tuto: 'open' })).join('')}</div>` +
        (s.plans.length ? `<h3>Plans de fusion</h3><p class="sub">Installez directement un magasin obtenu au laboratoire.</p><div class="grid">${s.plans.map((id, k) => button({ act: 'placePlan', args: [k, i], label: `${SHOP_BY_ID[id].emoji} ${esc(SHOP_BY_ID[id].name)}`, sub: RARITY_INFO[SHOP_BY_ID[id].rarity].name })).join('')}</div>` : '') +
        guide;
    }
    const def = SHOP_BY_ID[shop.defId];
    const rate = G.shopRate(s, i);
    const r = RARITY_INFO[def.rarity];
    let html = sheetHead(`${def.emoji} ${esc(def.name)}`, `Étage ${i + 1} · ${CATEGORIES[def.category].name}`) +
      `<div class="chips">${chip(r.name, 'rar" style="--rc:' + r.color)}${chip(`Niv. ${shop.level}/${G.MAX_SHOP_LEVEL}`)}${chip('★'.repeat(shop.stars) || '☆')}${chip(`${rate.toFixed(1)} 🪙/s`)}</div>`;
    if (shop.restock) {
      const t = RESTOCK_TIERS[shop.restock.tier];
      html += `<div class="card"><b>📦 ${CATEGORIES[def.category].products[shop.restock.tier]} en livraison</b>${timerBar(shop.restock.endsAt, t.restockSec * 1000, now, 'blue')}` +
        `<small>Arrivée dans ${dur(shop.restock.endsAt - now)}, puis vente pendant ${dur(t.durationSec * 1000)}</small><div class="btns">${this.rushBtn({ kind: 'restock', floor: i }, now)}${button({ act: 'express', args: [i], label: '📺 Livraison express', sub: 'Pub', kind: 'ad', small: true })}</div></div>`;
    } else if (shop.stock > 1e-6) {
      html += `<div class="card"><b>🛒 En vente</b><small>Il reste ${fmt(shop.stock)} 🪙 de marchandise, soit ${dur((shop.stock / rate) * 1000)} de ventes. Revenez quand les rayons sont vides.</small></div>`;
    } else {
      html += `<h3>📦 Commander des produits</h3><p class="sub">Les rayons sont vides : le magasin ne gagne plus rien. Petit produit = vite prêt mais vite vendu ; gros produit = long à livrer mais vend des heures (idéal avant de quitter le jeu).</p><div class="col">` +
        RESTOCK_TIERS.map((t, k) =>
          button({ act: 'restock', args: [i, k], label: `${['📦', '📦📦', '🚚'][k]} ${CATEGORIES[def.category].products[k]}`, sub: `Livré en ${dur(t.restockSec * 1000)} · vend ${dur(t.durationSec * 1000)} · ≈ ${fmt(rate * t.durationSec)} 🪙`, tuto: 'restock', wide: true }),
        ).join('') + '</div>' +
        button({ act: 'express', args: [i], label: '📺 Livraison express gratuite', sub: 'Petit produit livré tout de suite (pub)', kind: 'ad', wide: true });
    }
    if (shop.level < G.MAX_SHOP_LEVEL) {
      const up = G.shopUpgradeCost(def.rarity, shop.level);
      html += `<h3>⬆️ Améliorer</h3><div class="card" data-key="shop-${i}"><div class="line"><div class="grow"><b>Niveau ${shop.level} → ${shop.level + 1}</b><small>+25 % de ventes : ${rate.toFixed(1)} → ${(rate * 1.25).toFixed(1)} 🪙/s</small></div>` +
        button({ act: 'upgradeShop', args: [i], label: 'Améliorer', sub: `${fmt(up)} 🪙`, kind: 'main', tuto: 'upgrade-shop', why: lack(s.coins, up, 'pièces 🪙') }) + '</div></div>';
    }
    if (!floor.rerollUsed && shop.level === 1 && !shop.restock && shop.stock <= 1e-6) {
      html += button({ act: 'reroll', args: [i, 'miles'], label: '🎲 Changer de magasin', sub: `${G.REROLL_MILES} ✈️ · une seule fois, au niveau 1`, kind: 'ghost', wide: true, why: lack(s.miles, G.REROLL_MILES, 'Miles ✈️') });
    }
    return html + guide;
  }

  private vipSheet(uid: string): string {
    const s = this.state;
    const v = s.vips.find((x) => x.uid === uid);
    if (!v) return sheetHead('VIP parti') + '<p>Ce VIP a quitté le hall.</p>' + button({ act: 'close', label: 'Fermer', wide: true });
    const def = VIP_BY_ID[v.defId];
    let html = sheetHead(`${def.emoji} ${esc(def.name)}`, `Part dans ${dur(v.expiresAt - this.now)}`) + `<p class="quote">« ${esc(def.line)} »</p>`;
    if (def.power) html += button({ act: 'useVip', args: [uid], label: '⚡ Utiliser son pouvoir', kind: 'main', wide: true });
    if (v.demand) {
      const c = COUNTRY_BY_ID[v.demand.countryId];
      const mod = v.demand.moduleId && MODULE_BY_ID[v.demand.moduleId];
      html += `<div class="card"><b>Ce VIP veut aller à ${c.emoji} ${c.name}</b><small>Confort minimum : ${v.demand.minComfort} 🛋️${mod ? ` · équipement ${mod.emoji} ${mod.name}` : ''}</small><small>Envoyez un avion vers ${c.name} : le VIP embarque tout seul et paie un gros bonus (pièces, ressources et Miles).</small></div>` +
        button({ act: 'tab', args: ['vols'], label: '✈️ Choisir un avion', kind: 'main', wide: true });
    }
    return html;
  }

  private fusionSheet(first: number | null): string {
    const s = this.state;
    const shops = s.floors.map((f, i) => ({ f, i })).filter(({ f, i }) => f.shop && i !== first);
    const a = first === null ? undefined : SHOP_BY_ID[s.floors[first].shop!.defId];
    const cost = (i: number) => G.fusionCost(RARITY_INFO[a!.rarity].rank, RARITY_INFO[SHOP_BY_ID[s.floors[i].shop!.defId].rarity].rank);
    return sheetHead(`🧪 Fusion ${first === null ? ': 1ᵉʳ magasin' : `: ${a!.emoji} + ?`}`, 'Les deux magasins restent en place. Vous obtenez le plan d’un nouveau magasin à installer sur un étage vide.') +
      (shops.length < (first === null ? 2 : 1) ? '<p class="note">Il faut au moins deux magasins.</p>' : '') +
      `<div class="grid">${shops.map(({ f, i }) => {
        const d = SHOP_BY_ID[f.shop!.defId];
        return first === null
          ? button({ act: 'fusionPick', args: [i], label: `${d.emoji} ${esc(d.name)}`, sub: `Étage ${i + 1} · ${RARITY_INFO[d.rarity].name}` })
          : button({ act: 'fusion', args: [first, i], label: `${d.emoji} ${esc(d.name)}`, sub: `${fmt(cost(i))} 🪙 · ${dur(G.fusionDuration(RARITY_INFO[a!.rarity].rank, RARITY_INFO[d.rarity].rank) * 1000)}`, why: lack(s.coins, cost(i), 'pièces 🪙') });
      }).join('')}</div>`;
  }

  // --- Vols ------------------------------------------------------------------

  private vols(now: number): string {
    const s = this.state;
    const seg = (v: VolsView, label: string) => `<button class="${this.volsView === v ? 'on' : ''}" data-act="vols" data-args='["${v}"]' data-view="${v}">${label}</button>`;
    const research = unlocked(s).has('recherche');
    if (!research && this.volsView === 'recherche') this.volsView = 'avions';
    const pending = s.reports.filter((r) => r.pending);
    let html = `<div class="seg">${seg('avions', `🛩️ Avions ${s.planes.length}/${G.hangarSize(s.level)}`)}${seg('pays', '🌍 Pays')}${research ? seg('recherche', `🔬 Recherche${s.researching ? ' ⏳' : ''}`) : ''}</div>`;
    if (pending.length) {
      html += pending.map((r) => `<button class="alert" data-act="showReport" data-args='["${r.id}"]'>${EVENT_BY_ID[r.event!.defId].emoji} Incident au retour de ${esc(r.destName)} : touchez pour décider</button>`).join('');
    }
    if (this.volsView === 'avions') return html + this.fleet(now);
    if (this.volsView === 'pays') return html + this.countries(now);
    return html + this.researchView(now);
  }

  /** One plane per page, scrolled vertically with snapping. */
  private fleet(now: number): string {
    const s = this.state;
    const pages = s.planes.map((p, k) => this.planePage(p, k, now));
    const full = s.planes.length >= G.hangarSize(s.level);
    pages.push(
      `<section class="page buy"><div class="buy-inner"><div class="big">🛒</div><h2>Concession</h2><p class="sub">Achetez de nouveaux modèles : plus de places, plus rapides, plus loin.</p>` +
        button({ act: 'shop', label: 'Voir les avions', kind: 'main', wide: true, why: full ? `Hangar plein (${s.planes.length}/${G.hangarSize(s.level)}). Il s’agrandit tous les 3 niveaux.` : false }) +
        `</div></section>`,
    );
    const jump = s.planes.map((p) => {
      const st = p.flight ? (p.flight.endsAt <= now ? '✅' : '🛫') : p.damaged ? '⚠️' : '🅿️';
      return `<button class="small" data-act="jumpPlane" data-args='["${p.uid}"]'>${st} ${esc(p.name)}</button>`;
    }).join('');
    const lounge = `<div class="lounge-strip"><span>👥 <b>${Math.floor(s.lounge.passengers)}</b> en attente · ⇅ glissez pour changer d’avion</span><button class="info" data-act="help" data-args='["fleet"]'>ⓘ</button></div>`;
    return lounge + `<div class="jump">${jump}</div><div class="fleet">${pages.join('')}</div>`;
  }

  private planePage(p: PlaneState, k: number, now: number): string {
    const s = this.state;
    const st = G.planeStats(s, p);
    const model = PLANE_BY_ID[p.modelId];
    const flying = !!p.flight;
    const busy = flying ? 'Impossible pendant un vol.' : false;
    const img = planeSnapshot(p.modelId);

    // Status and main action.
    let status: string;
    let actions = '';
    if (p.flight) {
      const dest = p.flight.destination;
      const c = COUNTRY_BY_ID[dest.countryId];
      if (p.flight.endsAt <= now) {
        status = `<b class="ok">✅ Rentré de ${c.emoji} ${esc(dest.name)}</b><small>${p.flight.passengers} passagers à bord</small>`;
        actions = button({ act: 'collect', args: [p.uid], label: '📥 Récupérer les gains', kind: 'main', wide: true, tuto: 'collect' });
      } else {
        status = `<b>🛫 En vol vers ${c.emoji} ${esc(dest.name)}</b><small>Retour dans ${dur(p.flight.endsAt - now)} · ${p.flight.passengers} passagers</small>${timerBar(p.flight.endsAt, p.flight.endsAt - p.flight.departAt, now, 'blue')}`;
        actions = `<div class="btns">${p.flight.tailwindUsed ? '' : button({ act: 'tailwind', args: [p.uid], label: '📺 Vent arrière', sub: 'Pub', kind: 'ad', small: true })}${this.rushBtn({ kind: 'flight', planeUid: p.uid }, now, 'rush-flight')}</div>`;
      }
    } else if (p.damaged) {
      const cost = G.repairCost(model.price);
      status = p.repairEndsAt
        ? `<b>🔧 En réparation</b><small>Prêt dans ${dur(p.repairEndsAt - now)}</small>${timerBar(p.repairEndsAt, G.REPAIR_SECONDS * 1000, now)}`
        : '<b class="warn">⚠️ Endommagé</b><small>Réparez-le avant de le renvoyer.</small>';
      actions = p.repairEndsAt
        ? `<div class="btns">${this.rushBtn({ kind: 'repair', planeUid: p.uid }, now)}</div>`
        : `<div class="btns">${button({ act: 'repair', args: [p.uid, 'coins'], label: '🔧 Réparer', sub: `${fmt(cost)} 🪙 · ${dur(G.REPAIR_SECONDS * 1000)}`, small: true, why: lack(s.coins, cost, 'pièces 🪙') })}${button({ act: 'repair', args: [p.uid, 'ad'], label: '📺 Réparer', sub: 'Pub', kind: 'ad', small: true })}</div>`;
    } else {
      const pax = Math.min(Math.floor(s.lounge.passengers), Math.floor(st.capacity));
      status = `<b class="ok">🅿️ Au sol, prêt à partir</b><small>${pax} passager(s) embarqueront</small>`;
      actions = button({ act: 'pickDest', args: [p.uid], label: '🛫 Envoyer en vol', kind: 'main', wide: true, tuto: 'send', why: pax < 1 ? 'Aucun passager dans la salle : attendez qu’il en arrive.' : false });
    }

    // Stats with upgrade pips.
    const stats = STAT_KEYS.map((key, idx) => {
      const lvl = p.upgrades[key];
      const cost = G.planeUpgradeCost(model.price, lvl);
      const value = st[key].toFixed(key === 'comfort' ? 1 : 0);
      return `<div class="stat" data-key="stat-${p.uid}-${key}"><span class="sicon">${STAT_INFO[key].emoji}</span><div class="grow"><b>${STAT_INFO[key].name}</b> <span class="sval">${value} ${STAT_INFO[key].unit}</span>${pips(lvl, MAX_STAT_LEVEL)}</div>` +
        (lvl < MAX_STAT_LEVEL
          ? button({ act: 'upgradePlane', args: [p.uid, key], label: '⬆️', sub: `${fmt(cost)} 🪙`, small: true, tuto: idx === 0 && k === 0 ? 'upgrade-plane' : undefined, why: lack(s.coins, cost, 'pièces 🪙') })
          : chip('MAX')) + `</div>`;
    }).join('');

    // Crew seats.
    const seats = ROLES.map((role) => {
      const m = s.crew.find((c) => c.uid === p.crew[role]);
      return `<button class="seat${m ? '' : ' empty'}" data-key="seat-${p.uid}" ${busy ? `data-why="${busy}"` : `data-act="seat" data-args='["${p.uid}","${role}"]'`} style="--rc:${m ? RARITY_INFO[m.rarity].color : 'var(--line)'}">` +
        `<span class="savatar">${ROLE_INFO[role].emoji}</span><b>${m ? esc(m.name.split(' ')[0]) : 'Libre'}</b><small>${m ? ROLE_BONUS[role](G.crewPoints(m)) : `${ROLE_INFO[role].name} : ＋`}</small></button>`;
    }).join('');

    // Equipment slots.
    const slots = p.modules.map((id, slot) => {
      const mod = id ? MODULE_BY_ID[id] : undefined;
      return `<button class="seat${mod ? '' : ' empty'}" ${busy ? `data-why="${busy}"` : `data-act="slot" data-args='["${p.uid}",${slot}]'`}><span class="savatar">${mod ? mod.emoji : '🧩'}</span><b>${mod ? esc(mod.name) : 'Vide'}</b><small>${mod ? esc(mod.desc) : 'Installer ＋'}</small></button>`;
    }).join('');

    return (
      `<section class="page" data-plane="${p.uid}">` +
      `<div class="plane-hero" style="--pc:${p.color}">${img ? `<img src="${img}" alt="">` : '<span class="bigplane">✈</span>'}` +
      `<div class="hero-top"><span class="pos">${k + 1}/${s.planes.length}</span><span class="model">${esc(model.name)}</span></div>` +
      `<button class="pname" data-act="renamePlane" data-args='["${p.uid}"]'>${esc(p.name)} ✏️</button></div>` +
      `<div class="card status">${status}${actions}</div>` +
      `${section('📊 Caractéristiques', 'stats')}<div class="card">${stats}</div>` +
      `${section('👨‍✈️ Équipage', 'crew')}<div class="seats">${seats}</div>` +
      `${section(`🧩 Équipements (${p.modules.filter(Boolean).length}/${p.modules.length})`, 'modules')}<div class="seats">${slots}</div>` +
      `</section>`
    );
  }

  private seatSheet(planeUid: string, role: CrewRole): string {
    const s = this.state;
    const plane = s.planes.find((p) => p.uid === planeUid);
    if (!plane) return sheetHead('Avion') + button({ act: 'close', label: 'Fermer', wide: true });
    const current = s.crew.find((c) => c.uid === plane.crew[role]);
    const options = s.crew.filter((c) => c.role === role && c.uid !== current?.uid).sort((a, b) => G.crewPoints(b) - G.crewPoints(a));
    let html = sheetHead(`${ROLE_INFO[role].emoji} ${ROLE_INFO[role].name} de ${esc(plane.name)}`, `Ce siège donne un bonus de ${ROLE_INFO[role].desc.toLowerCase()}.`);
    if (current) html += `<div class="card">${this.crewLine(current)}${button({ act: 'unassign', args: [current.uid], label: 'Retirer du siège', kind: 'ghost', small: true })}</div>`;
    html += `<h3>${current ? 'Remplacer par' : 'Choisir un équipier'}</h3>`;
    html += options.length
      ? options.map((m) => `<div class="card pick">${this.crewLine(m)}${button({ act: 'seatAssign', args: [m.uid, planeUid], label: 'Choisir', small: true, kind: 'main' })}</div>`).join('')
      : `<p class="note">Aucun ${ROLE_INFO[role].name.toLowerCase()} disponible.</p>` + button({ act: 'tab', args: ['equipe'], label: '👨‍✈️ Recruter dans Équipe', wide: true });
    return html;
  }

  private moduleSheet(planeUid: string, slot: number): string {
    const s = this.state;
    const plane = s.planes.find((p) => p.uid === planeUid);
    if (!plane) return sheetHead('Avion') + button({ act: 'close', label: 'Fermer', wide: true });
    const owned = G.researchedModules(s);
    const current = plane.modules[slot];
    let html = sheetHead(`🧩 Emplacement ${slot + 1} de ${esc(plane.name)}`, 'Les équipements se débloquent par la recherche des pays.');
    if (current) html += button({ act: 'setModule', args: [planeUid, slot, null], label: `Retirer ${MODULE_BY_ID[current].emoji} ${esc(MODULE_BY_ID[current].name)}`, kind: 'ghost', wide: true });
    html += MODULES.map((m) => {
      const elsewhere = plane.modules.some((x, i) => x === m.id && i !== slot);
      const c = COUNTRY_BY_ID[m.countryId];
      return `<div class="card pick"><div class="grow"><b>${m.emoji} ${esc(m.name)}</b><small>${esc(m.desc)}</small></div>` +
        (current === m.id
          ? chip('Installé', 'ok')
          : button({ act: 'setModule', args: [planeUid, slot, m.id], label: 'Installer', small: true, kind: 'main', why: !owned.has(m.id) ? `À rechercher à ${c.emoji} ${c.name}` : elsewhere ? 'Déjà installé sur un autre emplacement.' : false })) +
        '</div>';
    }).join('');
    return html;
  }

  private destSheet(planeUid: string): string {
    const s = this.state;
    const now = this.now;
    const plane = s.planes.find((p) => p.uid === planeUid);
    if (!plane) return sheetHead('Avion') + button({ act: 'close', label: 'Fermer', wide: true });
    const st = G.planeStats(s, plane);
    const ring = G.unlockedRing(s);
    const pax = Math.min(Math.floor(s.lounge.passengers), Math.floor(st.capacity));
    const featured = G.featuredCountry(now);
    const groups = COUNTRIES.filter((c) => c.ring <= ring).map((c) => {
      const mult = c.id === featured ? 1.5 : 1;
      const vips = s.vips.filter((v) => v.demand?.countryId === c.id);
      const rows = G.destinationsFor(s.seed, c.id, now).map((d: Destination) => {
        const can = G.canFly(s, plane, d);
        const mod = G.MODIFIER_INFO[d.modifier];
        const coins = G.ticketIncome(d.distance, pax, st.comfort) * mod.coins * mult;
        const res = G.resourceIncome(pax, c.ring) * mod.resource;
        const why = can.ok ? false : can.error === 'Autonomie insuffisante.' ? `Autonomie insuffisante : ${d.distance} km demandés, l’avion fait ${Math.floor(st.range)} km.` : can.error;
        return `<div class="dest"><div class="grow"><b>${esc(d.name)}</b><div class="chips">${chip(`${d.distance} km`)}${chip(`⏱ ${dur(G.flightDuration(d.distance, st.speed) * 1000)}`)}${d.modifier !== 'calme' ? chip(mod.name, d.modifier) : ''}</div>` +
          `<small>≈ +${fmt(coins)} 🪙 · +${fmt(res)} ${c.resource.emoji}</small></div>${button({ act: 'send', args: [planeUid, d], label: '🛫', sub: 'Décoller', kind: 'main', small: true, why })}</div>`;
      });
      const vipNote = vips.length ? `<small class="vipnote">${vips.map((v) => VIP_BY_ID[v.defId].emoji).join(' ')} ${vips.length} VIP veut y aller (confort ≥ ${Math.max(...vips.map((v) => v.demand!.minComfort))})</small>` : '';
      return `<div class="country"><div class="chead"><b>${c.emoji} ${c.name}</b>${c.id === featured ? chip('À la une ×1,5', 'gold') : ''}<small>${c.resource.emoji} ${c.resource.name}</small></div>${vipNote}${rows.join('')}</div>`;
    });
    return sheetHead(`🛫 Où envoyer ${esc(plane.name)} ?`, `${pax} passagers à bord · autonomie ${Math.floor(st.range)} km · confort ${st.comfort.toFixed(1)}`) + groups.join('') +
      `<p class="sub">Nouvelles destinations dans ${dur(G.msUntilNewDestinations(now))}. Les gains affichés sont estimés.</p>`;
  }

  private reportSheet(id: string): string {
    const r = this.state.reports.find((x) => x.id === id);
    if (!r) return button({ act: 'close', label: 'OK', wide: true });
    const c = COUNTRY_BY_ID[r.countryId];
    const ev = r.event && EVENT_BY_ID[r.event.defId];
    let html = sheetHead(`${c.emoji} Retour de ${esc(r.destName)}`, `${r.passengers} passagers transportés`);
    if (ev) {
      html += `<div class="card event"><b>${ev.emoji} ${esc(ev.title)}</b><small>${esc(ev.text)}</small></div>`;
      if (r.pending) {
        const plane = this.state.planes.find((p) => p.uid === r.planeUid);
        return html + '<h3>Que faites-vous ?</h3><div class="col">' +
          ev.options!.map((o, k) => {
            const pct = Math.round(100 * G.optionChance(this.state, plane, r.countryId, o.chance));
            return button({ act: 'choose', args: [r.id, k], label: esc(o.label), sub: `${pct} % de réussite`, kind: pct >= 60 ? 'ok' : pct >= 35 ? undefined : 'danger', wide: true });
          }).join('') + '</div>';
      }
      if (r.event!.avoided) html += '<p class="note ok">Votre équipage a évité le problème.</p>';
      else if (r.event!.outcome) html += `<p class="note">${esc(r.event!.outcome.text)}</p>`;
    }
    html += `<div class="rewards"><span>🪙<b>+${fmt(r.coins + r.vipCoins)}</b></span><span>${c.resource.emoji}<b>+${fmt(r.resource + r.vipResource)}</b></span><span>⭐<b>+${r.xp} XP</b></span>${r.vipMiles ? `<span>✈️<b>+${r.vipMiles}</b></span>` : ''}</div>`;
    for (const v of r.vips) html += `<p class="note ${v.satisfied ? 'ok' : 'warn'}">${VIP_BY_ID[v.defId].emoji} ${esc(VIP_BY_ID[v.defId].name)} : ${v.satisfied ? 'ravi !' : esc(v.reason ?? 'déçu')}</p>`;
    return html + (r.doubled ? '' : button({ act: 'doubleReport', args: [r.id], label: '📺 Doubler la récolte', sub: 'Pub', kind: 'ad', wide: true })) + button({ act: 'close', label: 'Super !', kind: 'main', wide: true });
  }

  private planeShopSheet(): string {
    const s = this.state;
    return sheetHead('🛒 Concession', `Hangar : ${s.planes.length}/${G.hangarSize(s.level)} avions`) +
      PLANE_MODELS.map((m) => {
        const img = planeSnapshot(m.id);
        return `<div class="card shopplane">${img ? `<img src="${img}" alt="">` : ''}<div class="grow"><b>${esc(m.name)}</b>` +
          `<div class="chips">${chip(`👥 ${m.capacity}`)}${chip(`💨 ${m.speed}`)}${chip(`🗺️ ${m.range} km`)}${chip(`🧩 ${m.slots}`)}</div></div>` +
          button({ act: 'buyPlane', args: [m.id], label: 'Acheter', sub: `${fmt(m.price)} 🪙`, kind: 'main', small: true, why: s.level < m.level ? `Niveau ${m.level} requis` : lack(s.coins, m.price, 'pièces 🪙') }) + '</div>';
      }).join('');
  }

  private countries(now: number): string {
    const s = this.state;
    const ring = G.unlockedRing(s);
    const featured = G.featuredCountry(now);
    let html = section('🌍 Pays', 'countries') +
      `<div class="card hint"><b>⭐ À la une : ${COUNTRY_BY_ID[featured].emoji} ${COUNTRY_BY_ID[featured].name}</b><small>Gains ×1,5 cette semaine · nouvelles destinations dans ${dur(G.msUntilNewDestinations(now))}</small></div>`;
    for (const c of COUNTRIES) {
      const open = c.ring <= ring;
      const done = TECHS.filter((t) => t.countryId === c.id && s.research.includes(t.id)).length;
      html += open
        ? `<div class="card country-card"><span class="ticon">${c.emoji}</span><div class="grow"><b>${c.name}</b><small>${c.resource.emoji} ${fmt(s.resources[c.id])} ${c.resource.name}</small><small>${s.discovered.includes(c.id) ? `🔬 Recherches ${done}/4` : '✈️ Pas encore visité : envoyez-y un avion'}</small></div></div>`
        : `<div class="card country-card off"><span class="ticon">${c.emoji}</span><div class="grow"><b>${c.name}</b><small>🔒 Niveau ${RING_LEVELS[c.ring]} requis</small></div></div>`;
    }
    return html;
  }

  private researchView(now: number): string {
    const s = this.state;
    let html = section('🔬 Recherche', 'research');
    if (s.researching) {
      const t = TECHS.find((x) => x.id === s.researching!.techId)!;
      const c = COUNTRY_BY_ID[t.countryId];
      html += `<div class="card hint"><b>${t.emoji} ${esc(t.name)} en cours</b><small>${techEffect(t)}</small>${timerBar(s.researching.endsAt, G.researchDuration(c.ring, t.k) * 1000, now)}<div class="line"><small>Fin dans ${dur(s.researching.endsAt - now)}</small>${this.rushBtn({ kind: 'research' }, now, 'rush-research')}</div></div>`;
    }
    const available = TECHS.filter(
      (t) => s.discovered.includes(t.countryId) && !s.research.includes(t.id) && TECHS.every((p) => p.countryId !== t.countryId || p.k !== t.k - 1 || s.research.includes(p.id)),
    );
    if (!available.length && !s.researching) html += '<p class="note">Envoyez un avion dans un pays pour débloquer ses recherches.</p>';
    for (const t of available) {
      const c = COUNTRY_BY_ID[t.countryId];
      const cost = G.researchCost(c.ring, t.k);
      const why = s.researching ? 'Une recherche est déjà en cours.' : lack(s.coins, cost.coins, 'pièces 🪙') || lack(s.resources[t.countryId], cost.resource, `${c.resource.name} ${c.resource.emoji}`);
      html += `<div class="card"><div class="line"><div class="grow"><b>${c.emoji} ${t.emoji} ${esc(t.name)}</b><small>${techEffect(t)}</small><small>${fmt(cost.coins)} 🪙 + ${fmt(cost.resource)} ${c.resource.emoji} (vous avez ${fmt(s.resources[t.countryId])}) · ${dur(G.researchDuration(c.ring, t.k) * 1000)}</small></div>` +
        button({ act: 'research', args: [t.id], label: 'Lancer', kind: 'main', small: true, tuto: 'research', why }) + '</div></div>';
    }
    const done = TECHS.filter((t) => s.research.includes(t.id));
    if (done.length) html += section(`✅ Terminées (${done.length})`) + done.map((t) => `<div class="card mini"><b>${COUNTRY_BY_ID[t.countryId].emoji} ${t.emoji} ${esc(t.name)}</b><small>${techEffect(t)}</small></div>`).join('');
    return html;
  }

  // --- Équipe ----------------------------------------------------------------

  private crewLine(m: CrewMember): string {
    const plane = this.state.planes.find((p) => p.uid === m.planeUid);
    const r = RARITY_INFO[m.rarity];
    return `<div class="crew" style="--rc:${r.color}"><span class="savatar">${ROLE_INFO[m.role].emoji}</span><div class="grow"><b>${esc(m.name)}</b>` +
      `<small><span style="color:${r.color}">${r.name}</span> · ${ROLE_INFO[m.role].name} niv. ${m.level}${m.element !== 'neutre' ? ` · ${COUNTRY_BY_ID[m.element].emoji}` : ''} · ${ROLE_BONUS[m.role](G.crewPoints(m))}</small>` +
      `${m.traits.length ? `<small>${m.traits.map((t) => TRAIT_BY_ID[t]?.name).filter(Boolean).join(', ')}</small>` : ''}<small>${plane ? `✈ ${esc(plane.name)}` : '💤 Pas d’avion'}</small></div></div>`;
  }

  private traitsHtml(m: CrewMember): string {
    return m.traits.length ? `<div class="col">${m.traits.map((t) => TRAIT_BY_ID[t]).filter(Boolean).map((t) => `<div class="note">✨ <b>${t.name}</b> : ${t.desc}</div>`).join('')}</div>` : '';
  }

  private equipe(now: number): string {
    const s = this.state;
    const freeAt = s.cooldowns.free_recruit ?? 0;
    const full = s.crew.length >= G.MAX_CREW ? `Équipe complète (${G.MAX_CREW} max).` : false;
    const cost = G.recruitCost(s.level);
    let html = section(`🧑‍✈️ Recrutement · ${s.crew.length}/${G.MAX_CREW}`, 'recruit') +
      `<div class="roles">${ROLES.map((r) => `<div><span>${ROLE_INFO[r].emoji}</span><b>${ROLE_INFO[r].name}</b><small>${ROLE_INFO[r].desc}</small></div>`).join('')}</div>` +
      `<div class="col">` +
      button({ act: 'recruit', args: ['coins'], label: '🎲 Recrue standard', sub: `${fmt(cost)} 🪙 · surtout Commun et Rare`, wide: true, tuto: 'recruit', why: full || lack(s.coins, cost, 'pièces 🪙') }) +
      button({ act: 'recruit', args: ['miles'], label: '💎 Recrue premium', sub: `${PREMIUM_RECRUIT_MILES} ✈️ · Rare minimum`, kind: 'rush', wide: true, why: full || lack(s.miles, PREMIUM_RECRUIT_MILES, 'Miles ✈️') }) +
      button({ act: 'recruit', args: ['ad'], label: '📺 Recrue gratuite', sub: freeAt > now ? `Disponible dans ${dur(freeAt - now)}` : 'Regarder une pub', kind: 'ad', wide: true, why: full || (freeAt > now ? `Revenez dans ${dur(freeAt - now)}.` : false) }) +
      `</div>`;
    html += section('👥 Mon équipe', 'crew');
    if (!s.crew.length) html += '<p class="note">Personne pour l’instant : recrutez votre premier équipier ci-dessus.</p>';
    const sorted = [...s.crew].sort((a, b) => Number(!!a.planeUid) - Number(!!b.planeUid) || RARITY_INFO[b.rarity].rank - RARITY_INFO[a.rarity].rank);
    for (const m of sorted) {
      html += `<div class="card pick">${this.crewLine(m)}` +
        (m.planeUid ? button({ act: 'unassign', args: [m.uid], label: 'Retirer', small: true, kind: 'ghost' }) : button({ act: 'assignPick', args: [m.uid], label: 'Affecter', small: true, kind: 'main', tuto: 'assign' })) + '</div>';
    }
    return html;
  }

  private assignSheet(crewUid: string): string {
    const s = this.state;
    const m = s.crew.find((c) => c.uid === crewUid);
    if (!m) return sheetHead('Équipier') + button({ act: 'close', label: 'Fermer', wide: true });
    return sheetHead(`${ROLE_INFO[m.role].emoji} ${esc(m.name)} : quel avion ?`, `Siège ${ROLE_INFO[m.role].name} · ${ROLE_BONUS[m.role](G.crewPoints(m))}`) +
      s.planes.map((p) => {
        const cur = s.crew.find((c) => c.uid === p.crew[m.role]);
        return `<div class="card pick"><div class="grow"><b>✈ ${esc(p.name)}</b><small>${cur ? `Remplacera ${esc(cur.name)}` : 'Siège libre'}</small></div>` +
          button({ act: 'assign', args: [crewUid, p.uid], label: 'Choisir', small: true, kind: 'main', why: p.flight ? 'Cet avion est en vol.' : false }) + '</div>';
      }).join('');
  }

  // --- Amis ------------------------------------------------------------------

  private async addFriend(code: string) {
    const [profile] = await this.social.fetchProfiles([G.normalizeCode(code)]);
    if (!profile) this.toast('Joueur introuvable : le serveur social n’est pas encore en ligne.', 'err');
    else this.check(G.addFriend(this.state, profile, Date.now()), `${profile.name} ajouté !`);
    G.save(this.state);
    this.render();
  }

  private amis(now: number): string {
    const s = this.state;
    G.syncWeek(s, now);
    let html = section('🪪 Mon profil', 'social') +
      `<div class="card profile"><div class="line"><div class="grow"><b>${esc(s.social.name)}</b><small>Votre code ami</small><div class="code">${esc(s.social.code)}</div></div>` +
      `<div class="col">${button({ act: 'copyCode', label: '📋 Copier', small: true })}${button({ act: 'rename', label: '✏️ Nom', small: true, kind: 'ghost' })}</div></div></div>`;
    html += section('🏆 Classement de la semaine');
    const last = s.social.lastWeek;
    if (last && !last.claimed) html += `<div class="card hint"><div class="line"><div class="grow"><b>Semaine passée : ${last.rank}ᵉ sur ${last.players}</b><small>Votre récompense vous attend</small></div>${button({ act: 'weekly', label: '🏆 Récupérer', kind: 'main', small: true })}</div></div>`;
    html += '<div class="card">' + G.friendsLeaderboard(s, now).map((r, k) =>
      `<div class="rank${r.me ? ' me' : ''}"><span class="rpos">${['🥇', '🥈', '🥉'][k] ?? k + 1}</span><b class="grow">${esc(r.name)}${r.me ? ' (vous)' : ''}</b><span>${fmt(r.score)} 🪙</span></div>`).join('') + '<small>Pièces gagnées depuis lundi.</small></div>';
    html += section(`👋 Amis ${s.social.friends.length}/${G.MAX_FRIENDS}`);
    if (!s.social.friends.length) html += '<p class="note">Échangez vos codes ami pour vous envoyer un cadeau par jour et visiter vos aéroports. Le serveur social arrive bientôt : pour l’instant aucun code ne peut être trouvé.</p>';
    for (const f of s.social.friends) {
      const giftDone = s.social.gifts.day === G.dayIndex(now) && s.social.gifts.sent.includes(f.code);
      const visitDone = s.social.visits.day === G.dayIndex(now) && s.social.visits.codes.includes(f.code);
      html += `<div class="card"><div class="line"><div class="grow"><b>${esc(f.profile.name)}</b><small>Niv. ${f.profile.level} · ${f.profile.floors.length} magasins</small></div></div><div class="btns">` +
        button({ act: 'gift', args: [f.code], label: '🎁 Cadeau', small: true, kind: 'main', why: giftDone ? 'Déjà envoyé aujourd’hui.' : false }) +
        button({ act: 'visit', args: [f.code], label: '👀 Visiter', small: true, why: visitDone ? 'Déjà visité aujourd’hui.' : false }) +
        button({ act: 'removeFriend', args: [f.code], label: 'Retirer', small: true, kind: 'ghost' }) + '</div></div>';
    }
    return html + button({ act: 'addFriend', label: '➕ Ajouter un ami', wide: true, kind: 'main' });
  }

  // --- Objectifs -------------------------------------------------------------

  private objectifs(now: number): string {
    const s = this.state;
    G.refreshQuests(s, now);
    let html = '';
    const mission = G.currentMission(s);
    if (mission) {
      html += section(`📋 Mission ${s.missionIndex + 1}`, 'mission') +
        `<div class="card${mission.done ? ' hint' : ''}"><div class="line"><div class="grow"><b>${esc(mission.def.text)}</b>${bar(mission.progress / mission.def.goal)}<small>${mission.progress}/${mission.def.goal} · 🎁 ${mission.def.miles} ✈️${mission.def.coins ? ` + ${mission.def.coins} 🪙` : ''}</small></div>` +
        button({ act: 'mission', label: 'Récupérer', kind: 'main', small: true, tuto: 'mission', why: mission.done ? false : 'Mission pas encore accomplie.' }) + '</div></div>';
    }
    const daily = G.dailyStatus(s, now);
    html += section('🎁 Cadeau du jour', 'daily') + '<div class="card"><div class="days">' +
      DAILY_REWARDS.map((r, k) => {
        const day = k + 1;
        const state = day < daily.streak || (day === daily.streak && !daily.available) ? 'got' : day === daily.streak ? 'today' : '';
        return `<div class="day ${state}"><small>J${day}</small><span>${dailyIcon(r)}</span></div>`;
      }).join('') + '</div>' +
      button({ act: 'daily', label: daily.available ? `Récupérer : ${dailyLabel(daily.reward, s.level)}` : 'Déjà récupéré, revenez demain', kind: 'main', wide: true, why: daily.available ? false : 'Revenez demain pour le jour suivant.' }) + '</div>';

    const quests = G.questViews(s, now);
    html += section(`📅 Quêtes du jour ${quests.filter((q) => q.claimed).length}/${quests.length}`, 'quests');
    quests.forEach((q, k) => {
      html += `<div class="card${q.done && !q.claimed ? ' hint' : ''}"><div class="line"><div class="grow"><b>${esc(q.text)}</b>${bar(q.progress / q.goal)}<small>${fmt(q.progress)}/${fmt(q.goal)} · 🎁 ${QUEST_MILES} ✈️ + pièces</small></div>` +
        (q.claimed ? chip('✔ Fait', 'ok') : button({ act: 'quest', args: [k], label: 'Valider', small: true, kind: 'main', why: q.done ? false : 'Quête pas encore terminée.' })) + '</div></div>';
    });
    html += button({
      act: 'chest',
      label: '🧰 Coffre bonus',
      sub: s.quests.chestClaimed ? 'Déjà ouvert aujourd’hui' : `${QUEST_CHEST_MILES} ✈️ quand les 3 quêtes sont validées`,
      wide: true,
      kind: 'main',
      why: s.quests.chestClaimed ? 'Coffre déjà ouvert aujourd’hui.' : !s.quests.claimed.every(Boolean) ? 'Validez d’abord les 3 quêtes du jour.' : false,
    });

    const season = unlocked(s).has('saison') ? G.seasonView(s, now) : undefined;
    if (season) {
      const def = season.season.def;
      const country = COUNTRY_BY_ID[def.country];
      html += section(`${def.emoji} ${esc(def.name)}`, 'season') +
        `<div class="card hint"><b>${fmt(season.points)} ${def.currency.emoji} ${esc(def.currency.name)}</b><small>${esc(def.text)}</small><small>Vols vers ${country.emoji} ${country.name} : points ×2 · fin dans ${dur(season.season.endsAt - now)}</small></div>`;
      season.track.forEach((step, k) => {
        html += `<div class="card"><div class="line"><div class="grow"><b>${rewardLabel(step.reward, s.level, SHOP_BY_ID[def.shopId]?.name)}</b>${bar(Math.min(1, season.points / step.points))}<small>${fmt(Math.min(season.points, step.points))}/${fmt(step.points)} ${def.currency.emoji}</small></div>` +
          (step.claimed ? chip('✔', 'ok') : button({ act: 'season', args: [k], label: 'Prendre', small: true, kind: 'main', why: step.reached ? false : 'Palier pas encore atteint.' })) + '</div></div>';
      });
    } else if (unlocked(s).has('saison')) {
      const next = G.nextSeason(now);
      html += section('🎉 Événement saisonnier', 'season') + `<p class="note">Prochain : ${next.def.emoji} ${esc(next.def.name)} dans ${dur(next.startsAt - now)}.</p>`;
    }

    html += section('🏆 Succès', 'achievements');
    const views = G.achievementViews(s).filter((x) => !x.claimed).sort((a, b) => Number(b.done) - Number(a.done)).slice(0, 8);
    for (const a of views) {
      html += `<div class="card${a.done ? ' hint' : ''}"><div class="line"><div class="grow"><b>${esc(a.def.text)}</b>${bar(Math.min(1, a.progress / a.def.goal))}<small>${fmt(a.progress)}/${fmt(a.def.goal)} · 🎁 ${a.def.miles} ✈️</small></div>` +
        button({ act: 'achievement', args: [a.def.id], label: 'Valider', small: true, kind: 'main', why: a.done ? false : 'Pas encore atteint.' }) + '</div></div>';
    }
    return html;
  }
}

function dailyIcon(r: (typeof DAILY_REWARDS)[number]): string {
  return r.kind === 'coins' ? '🪙' : r.kind === 'miles' ? '✈️' : r.premium ? '💎' : '🧑‍✈️';
}

function dailyLabel(r: (typeof DAILY_REWARDS)[number], level: number): string {
  return r.kind === 'coins' ? `${fmt(r.perLevel * level)} 🪙` : r.kind === 'miles' ? `${r.amount} ✈️` : `Recrue${r.premium ? ' premium' : ''}`;
}

function rewardLabel(r: SeasonReward, level: number, shopName = 'Magasin exclusif'): string {
  switch (r.kind) {
    case 'miles':
      return `${r.amount} ✈️`;
    case 'coins':
      return `${fmt(r.perLevel * level)} 🪙`;
    case 'recruit':
      return r.premium ? 'Recrue premium' : 'Recrue';
    case 'shop':
      return `Plan : ${shopName}`;
    case 'trophy':
      return `Trophée + ${r.miles} ✈️`;
  }
}

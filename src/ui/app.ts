// Minimal playable DOM interface around the cube art tower view (towerView.ts).
// Every button maps to one engine call; the panel is redrawn once per second
// and after each action.
import * as G from '../core';
import { COUNTRIES, COUNTRY_BY_ID, RING_LEVELS } from '../core/data/countries';
import { ROLE_INFO } from '../core/data/crew';
import { EVENT_BY_ID } from '../core/data/events';
import { MAX_STAT_LEVEL, PLANE_BY_ID, PLANE_MODELS, STAT_INFO, STAT_KEYS } from '../core/data/planes';
import { TECHS } from '../core/data/research';
import { CATEGORIES, CATEGORY_IDS, RARITY_INFO, RESTOCK_TIERS, SHOP_BY_ID } from '../core/data/shops';
import { VIP_BY_ID } from '../core/data/vips';
import type { SeasonReward } from '../core/data/seasons';
import type { GameState, PlaneState } from '../core';
import './style.css';
import { TowerView } from './towerView';

type Tab = 'tour' | 'vols' | 'equipe' | 'amis' | 'objectifs';

const TABS: Record<Tab, string> = { tour: '🏢 Tour', vols: '✈️ Vols', equipe: '👥 Équipe', amis: '👋 Amis', objectifs: '🎯 Objectifs' };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

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

const btn = (label: string, act: string, args: unknown[] = [], disabled = false, cls = '') =>
  `<button class="${cls}" data-act="${act}" data-args="${esc(JSON.stringify(args))}"${disabled ? ' disabled' : ''}>${label}</button>`;

export class App {
  private tab: Tab = 'tour';
  private modal: (() => string) | null = null;
  private toastTimer = 0;
  private tower?: TowerView;
  /** Local stand-in until a social server exists: friend codes cannot be found yet. */
  private social: G.SocialBackend = new G.MemorySocialBackend();

  constructor(private state: GameState, private root: HTMLElement) {
    root.innerHTML = `<header id="hud"></header><div id="tower"><canvas></canvas></div><main id="panel"></main><nav id="tabs"></nav><div id="modal" hidden></div><div id="toast" hidden></div>`;
    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!el || (el as HTMLButtonElement).disabled) return;
      this.run(el.dataset.act!, JSON.parse(el.dataset.args ?? '[]'));
    });
  }

  /** Idle loop: simulation every frame, panel redraw every second, autosave. */
  start() {
    try {
      this.tower = new TowerView(this.root.querySelector<HTMLCanvasElement>('#tower canvas')!);
    } catch (e) {
      console.warn('Rendu 3D indisponible', e);
      this.root.querySelector<HTMLElement>('#tower')!.remove();
    }
    void this.social.publish(G.publicProfile(this.state, Date.now()));
    const frame = () => {
      G.update(this.state, Date.now());
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    setInterval(() => this.render(), 1000);
    setInterval(() => G.save(this.state), 10_000);
    window.addEventListener('pagehide', () => G.save(this.state));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) G.save(this.state);
    });
  }

  private get now() {
    return Date.now();
  }

  toast(text: string) {
    const el = this.root.querySelector<HTMLElement>('#toast')!;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.hidden = true), 2500);
  }

  /** Shows a Result's error, or `success` when it went through. */
  private check(res: G.Result<unknown>, success?: string) {
    if (!res.ok) this.toast(res.error);
    else if (success) this.toast(success);
    return res.ok;
  }

  showOffline(off: G.TickResult) {
    if (off.seconds < 60 || off.coins < 1) return;
    this.modal = () =>
      `<h2>Bon retour !</h2><p>Absent ${dur(off.seconds * 1000)} : vos magasins ont gagné <b>${fmt(off.coins)} 🪙</b>${off.flightsLanded ? ` et ${off.flightsLanded} avion(s) sont rentrés` : ''}.</p>` +
      (off.doubled ? '' : btn('📺 Doubler (pub)', 'doubleOffline')) +
      btn('Continuer', 'close');
    this.offline = off;
    this.render();
  }

  private offline?: G.TickResult;

  private run(act: string, a: any[]) {
    const s = this.state;
    const now = this.now;
    switch (act) {
      case 'tab':
        this.tab = a[0];
        break;
      case 'close':
        this.modal = null;
        break;
      case 'doubleOffline':
        if (this.offline) this.check(G.doubleOffline(s, this.offline), 'Gains doublés !');
        this.modal = null;
        break;
      case 'build':
        this.check(G.buildFloor(s, now), 'Construction lancée');
        break;
      case 'rush':
        this.check(G.rush(s, a[0], now));
        break;
      case 'pickCategory':
        this.modal = () =>
          `<h2>Étage ${a[0] + 1} : quel magasin ?</h2><div class="grid">` +
          CATEGORY_IDS.map((c) => btn(`${CATEGORIES[c].emoji} ${CATEGORIES[c].name}`, 'openShop', [a[0], c])).join('') +
          `</div>` + this.plansFor(a[0]) + btn('Annuler', 'close');
        break;
      case 'openShop': {
        const res = G.openShop(s, a[0], a[1]);
        if (this.check(res)) this.toast(`Nouveau : ${SHOP_BY_ID[res.ok ? res.value : ''].name}`);
        this.modal = null;
        break;
      }
      case 'placePlan':
        this.check(G.placePlan(s, a[0], a[1]), 'Plan installé');
        this.modal = null;
        break;
      case 'reroll':
        this.check(G.rerollShop(s, a[0], a[1]), 'Nouveau tirage');
        break;
      case 'restock':
        this.check(G.restock(s, a[0], a[1], now));
        break;
      case 'express':
        this.check(G.restockExpress(s, a[0], 0, now), 'Livraison express !');
        break;
      case 'upgradeShop':
        this.check(G.upgradeShop(s, a[0]));
        break;
      case 'guide': {
        const res = G.guidePassenger(s, a[0], now);
        if (this.check(res)) this.toast(`Pourboire : +${res.ok ? res.value.coins : 0} 🪙${res.ok && res.value.miles ? ' +1 ✈️' : ''}`);
        break;
      }
      case 'useVip':
        this.check(G.useVip(s, a[0], now), 'Pouvoir utilisé !');
        break;
      case 'lounge':
        this.check(G.upgradeLounge(s), 'Salle agrandie');
        break;
      case 'fusionPick':
        this.modal = () => this.fusionModal(a[0]);
        break;
      case 'fusion': {
        const res = G.startFusion(s, a[0], a[1], now);
        if (this.check(res)) this.toast('Fusion lancée');
        this.modal = null;
        break;
      }
      case 'pickDest':
        this.modal = () => this.destModal(a[0]);
        break;
      case 'send': {
        const vips = s.vips.filter((v) => v.demand?.countryId === a[1].countryId).map((v) => v.uid);
        this.check(G.sendFlight(s, a[0], a[1], now, vips), vips.length ? `Décollage avec ${vips.length} VIP !` : 'Décollage !');
        this.modal = null;
        break;
      }
      case 'tailwind':
        this.check(G.speedUpFlight(s, a[0], now), 'Vent arrière !');
        break;
      case 'collect': {
        const res = G.collectFlight(s, a[0], now);
        if (res.ok) this.modal = () => this.reportModal(res.value.id);
        else this.toast(res.error);
        break;
      }
      case 'choose': {
        const res = G.resolveEvent(s, a[0], a[1]);
        if (res.ok) this.modal = () => this.reportModal(a[0]);
        else this.toast(res.error);
        break;
      }
      case 'showReport':
        this.modal = () => this.reportModal(a[0]);
        break;
      case 'doubleReport':
        this.check(G.doubleReport(s, a[0]), 'Récolte doublée !');
        break;
      case 'repair':
        this.check(G.repairPlane(s, a[0], a[1], now), 'Réparation lancée');
        break;
      case 'buyPlane':
        this.check(G.buyPlane(s, a[0]), 'Nouvel avion !');
        this.modal = null;
        break;
      case 'shop':
        this.modal = () => this.planeShopModal();
        break;
      case 'upgradePlane':
        this.check(G.upgradePlane(s, a[0], a[1]));
        break;
      case 'planeDetail':
        this.modal = () => this.planeModal(a[0]);
        break;
      case 'recruit': {
        const res = G.recruit(s, a[0], now);
        if (res.ok) this.toast(`${ROLE_INFO[res.value.role].emoji} ${res.value.name} (${res.value.rarity}) rejoint l'équipe`);
        else this.toast(res.error);
        break;
      }
      case 'assignPick':
        this.modal = () => this.assignModal(a[0]);
        break;
      case 'assign':
        this.check(G.assignCrew(s, a[0], a[1]), 'Affecté');
        this.modal = null;
        break;
      case 'unassign':
        this.check(G.unassignCrew(s, a[0]));
        break;
      case 'research':
        this.check(G.startResearch(s, a[0], now), 'Recherche lancée');
        break;
      case 'mission':
        this.check(G.claimMission(s), 'Mission accomplie !');
        break;
      case 'daily':
        this.check(G.claimDaily(s, now), 'Récompense du jour récupérée');
        break;
      case 'quest':
        this.check(G.claimQuest(s, a[0], now), 'Quête validée');
        break;
      case 'chest':
        this.check(G.claimQuestChest(s, now), 'Coffre ouvert !');
        break;
      case 'achievement':
        this.check(G.claimAchievement(s, a[0]), 'Succès récupéré');
        break;
      case 'season': {
        const res = G.claimSeasonReward(s, a[0], now);
        if (res.ok) this.toast(`Palier récupéré : ${rewardLabel(res.value, s.level)}`);
        else this.toast(res.error);
        break;
      }
      case 'rename': {
        const name = prompt('Votre nom de directeur·rice :', s.social.name);
        if (name !== null) this.check(G.setPlayerName(s, name), 'Nom enregistré');
        break;
      }
      case 'addFriend': {
        const code = prompt('Code ami à ajouter :');
        if (code) void this.addFriend(code);
        break;
      }
      case 'gift': {
        const res = G.sendGift(s, a[0], now);
        if (res.ok) {
          void this.social.deliverGift(res.value);
          this.toast('Cadeau envoyé 🎁');
        } else this.toast(res.error);
        break;
      }
      case 'visit': {
        const res = G.visitFriend(s, a[0], now);
        if (res.ok) this.toast(`Visite : +${fmt(res.value.coins)} 🪙${res.value.miles ? ' +1 ✈️' : ''}`);
        else this.toast(res.error);
        break;
      }
      case 'removeFriend':
        this.check(G.removeFriend(s, a[0]), 'Ami retiré');
        break;
      case 'weekly': {
        const res = G.claimWeeklyReward(s, now);
        if (res.ok) this.toast(`Classement de la semaine : +${res.value} ✈️`);
        else this.toast(res.error);
        break;
      }
      case 'franchise': {
        const res = G.franchise(s, now);
        if (res.ok) {
          this.state = res.value;
          this.toast('Nouvelle franchise ouverte !');
        } else this.toast(res.error);
        break;
      }
    }
    G.save(this.state);
    this.render();
  }

  // ---------------------------------------------------------------------------

  render() {
    const s = this.state;
    const now = this.now;
    const mission = G.currentMission(s);
    this.root.querySelector('#hud')!.innerHTML =
      `<div class="res"><span>🪙 ${fmt(s.coins)}</span><span>✈️ ${s.miles}</span><span>⭐ Niv. ${s.level}</span><span>👥 ${Math.floor(s.lounge.passengers)}/${G.loungeCap(s)}</span></div>` +
      `<div class="xp"><i style="width:${Math.min(100, (100 * s.xp) / G.xpToNext(s.level))}%"></i></div>` +
      `<div class="sub">${G.totalShopRate(s).toFixed(1)} 🪙/s${mission ? ` · 🎯 ${esc(mission.def.text)} (${mission.progress}/${mission.def.goal})` : ''}</div>`;
    this.root.querySelector('#tabs')!.innerHTML = (Object.keys(TABS) as Tab[])
      .map((t) => btn(TABS[t], 'tab', [t], false, t === this.tab ? 'on' : ''))
      .join('');
    const towerBox = this.root.querySelector<HTMLElement>('#tower');
    if (towerBox && this.tower) {
      towerBox.hidden = this.tab !== 'tour';
      if (!towerBox.hidden) this.tower.update(s);
    }
    const panel = this.root.querySelector('#panel')!;
    const scroll = panel.scrollTop;
    panel.innerHTML = { tour: () => this.tour(now), vols: () => this.vols(now), equipe: () => this.equipe(now), amis: () => this.amis(now), objectifs: () => this.objectifs(now) }[this.tab]();
    panel.scrollTop = scroll;
    const modal = this.root.querySelector<HTMLElement>('#modal')!;
    modal.hidden = !this.modal;
    if (this.modal) modal.innerHTML = `<div class="card">${this.modal()}</div>`;
  }

  private timerBtn(target: G.RushTarget, now: number) {
    const price = G.rushPrice(this.state, target, now);
    return price === undefined ? '' : btn(`⚡ ${price} ✈️`, 'rush', [target], this.state.miles < price, 'small');
  }

  private tour(now: number): string {
    const s = this.state;
    const parts: string[] = [];

    if (s.vips.length || s.guide) {
      parts.push('<h3>Hall</h3>');
      if (s.guide) parts.push(`<div class="row hint">🧍 Un passager cherche l'étage ${s.guide.floor} : touchez « Guider » sur cet étage (${dur(s.guide.expiresAt - now)})</div>`);
      for (const v of s.vips) {
        const def = VIP_BY_ID[v.defId];
        const demand = v.demand
          ? `veut aller à ${COUNTRY_BY_ID[v.demand.countryId].emoji} ${COUNTRY_BY_ID[v.demand.countryId].name} (confort ≥ ${v.demand.minComfort}) : il embarquera au prochain vol vers ce pays`
          : '';
        parts.push(
          `<div class="row"><div><b>${def.emoji} ${esc(def.name)}</b><small>« ${esc(def.line)} » ${demand} · part dans ${dur(v.expiresAt - now)}</small></div>${def.power ? btn('Utiliser', 'useVip', [v.uid]) : ''}</div>`,
        );
      }
    }

    parts.push('<h3>Étages</h3>');
    const building = s.floors.some((f) => f.buildEndsAt !== undefined);
    const n = s.floors.length + 1;
    const canBuild = n <= G.maxFloors(s.level);
    parts.push(
      `<div class="row"><div><b>Construire l'étage ${n}</b><small>${canBuild ? `${fmt(G.buildCost(n))} 🪙 · ${dur(G.buildDuration(n) * 1000)}` : `Niveau ${s.level} : ${G.maxFloors(s.level)} étages max`}</small></div>` +
        btn('🏗️', 'build', [], building || !canBuild || s.coins < G.buildCost(n)) + `</div>`,
    );
    for (let i = s.floors.length - 1; i >= 0; i--) parts.push(this.floorRow(i, now));

    parts.push('<h3>Aéroport</h3>');
    parts.push(
      `<div class="row"><div><b>Salle d'attente niv. ${s.lounge.level}</b><small>${G.loungeCap(s)} places · ${G.arrivalRate(s).toFixed(2)} passagers/s</small></div>` +
        (s.lounge.level < G.MAX_LOUNGE_LEVEL ? btn(`${fmt(G.loungeUpgradeCost(s.lounge.level))} 🪙`, 'lounge', [], s.coins < G.loungeUpgradeCost(s.lounge.level)) : '') +
        `</div>`,
    );
    if (s.level >= G.FUSION_LEVEL) {
      const fusion = s.fusion
        ? `En cours : ${SHOP_BY_ID[s.fusion.a].emoji} + ${SHOP_BY_ID[s.fusion.b].emoji} (${dur(s.fusion.endsAt - now)}) ${this.timerBtn({ kind: 'fusion' }, now)}`
        : btn('🧪 Fusionner deux magasins', 'fusionPick', [null]);
      parts.push(`<div class="row"><div><b>Laboratoire</b><small>${s.plans.length} plan(s) en réserve</small></div>${fusion}</div>`);
    }
    const stars = G.pendingStars(s);
    if (s.level >= G.FRANCHISE_LEVEL) {
      parts.push(`<div class="row"><div><b>Franchise</b><small>Recommencer avec +${stars} ⭐ de prestige</small></div>${btn('Franchiser', 'franchise')}</div>`);
    }
    return parts.join('');
  }

  private floorRow(i: number, now: number): string {
    const s = this.state;
    const floor = s.floors[i];
    const guide = s.guide?.floor === i + 1 ? btn('🧍 Guider', 'guide', [i + 1], false, 'small hl') : s.guide ? btn('🧍', 'guide', [i + 1], false, 'small') : '';
    if (floor.buildEndsAt !== undefined) {
      return `<div class="row"><div><b>${i + 1}. 🏗️ Chantier</b><small>${dur(floor.buildEndsAt - now)}</small></div>${this.timerBtn({ kind: 'build' }, now)}</div>`;
    }
    const shop = floor.shop;
    if (!shop) return `<div class="row"><div><b>${i + 1}. Étage vide</b></div>${btn('Ouvrir un magasin', 'pickCategory', [i])}${guide}</div>`;
    const def = SHOP_BY_ID[shop.defId];
    const rate = G.shopRate(s, i);
    let status: string;
    let actions = '';
    if (shop.restock) {
      status = `Livraison : ${dur(shop.restock.endsAt - now)}`;
      actions = this.timerBtn({ kind: 'restock', floor: i }, now) + btn('📺', 'express', [i], false, 'small');
    } else if (shop.stock > 1e-6) {
      status = `En vente : ${fmt(shop.stock)} 🪙 restants (${dur((shop.stock / rate) * 1000)})`;
    } else {
      status = '<span class="warn">Rayons vides !</span>';
      actions = RESTOCK_TIERS.map((t, k) => btn(`${CATEGORIES[def.category].products[k]} ${dur(t.restockSec * 1000)}`, 'restock', [i, k], false, 'small')).join('');
      if (!floor.rerollUsed && shop.level === 1) actions += btn(`🎲 ${G.REROLL_MILES} ✈️`, 'reroll', [i, 'miles'], s.miles < G.REROLL_MILES, 'small');
    }
    const up = shop.level < G.MAX_SHOP_LEVEL ? G.shopUpgradeCost(def.rarity, shop.level) : 0;
    return (
      `<div class="row floor" style="border-left-color:${RARITY_INFO[def.rarity].color}"><div><b>${i + 1}. ${def.emoji} ${esc(def.name)}</b>` +
      `<small>${RARITY_INFO[def.rarity].name} · niv. ${shop.level} · ${'★'.repeat(shop.stars)} · ${rate.toFixed(1)} 🪙/s</small><small>${status}</small></div>` +
      `<div class="acts">${actions}${up ? btn(`⬆️ ${fmt(up)}`, 'upgradeShop', [i], s.coins < up, 'small') : ''}${guide}</div></div>`
    );
  }

  private plansFor(floor: number): string {
    if (!this.state.plans.length) return '';
    return '<h3>Plans de fusion</h3><div class="grid">' +
      this.state.plans.map((id, k) => btn(`${SHOP_BY_ID[id].emoji} ${esc(SHOP_BY_ID[id].name)}`, 'placePlan', [k, floor])).join('') + '</div>';
  }

  private fusionModal(first: number | null): string {
    const shops = this.state.floors.map((f, i) => ({ f, i })).filter(({ f, i }) => f.shop && i !== first);
    const title = first === null ? 'Premier magasin' : `${SHOP_BY_ID[this.state.floors[first].shop!.defId].emoji} + ?`;
    return `<h2>Fusion : ${title}</h2><div class="grid">` +
      shops.map(({ f, i }) => btn(`${SHOP_BY_ID[f.shop!.defId].emoji} ${esc(SHOP_BY_ID[f.shop!.defId].name)}`, first === null ? 'fusionPick' : 'fusion', first === null ? [i] : [first, i])).join('') +
      `</div>` + btn('Annuler', 'close');
  }

  private vols(now: number): string {
    const s = this.state;
    const ring = G.unlockedRing(s);
    const featured = G.featuredCountry(now);
    const parts = [`<h3>Flotte (${s.planes.length}/${G.hangarSize(s.level)})</h3>`];
    for (const p of s.planes) parts.push(this.planeRow(p, now));
    parts.push(btn('🛒 Acheter un avion', 'shop', [], s.planes.length >= G.hangarSize(s.level)));
    parts.push(`<h3>Pays</h3><p class="sub">Destination à la une : ${COUNTRY_BY_ID[featured].emoji} ${COUNTRY_BY_ID[featured].name} (gains ×1,5). Nouvelles destinations dans ${dur(G.msUntilNewDestinations(now))}.</p>`);
    for (const c of COUNTRIES) {
      const open = c.ring <= ring;
      parts.push(
        `<div class="row"><div><b>${c.emoji} ${c.name}</b><small>${open ? `${c.resource.emoji} ${fmt(s.resources[c.id])} ${c.resource.name}` : `Anneau ${c.ring} : niveau ${RING_LEVELS[c.ring]}`}</small></div></div>`,
      );
    }
    parts.push('<h3>Recherche</h3>');
    if (s.researching) {
      const t = TECHS.find((x) => x.id === s.researching!.techId)!;
      parts.push(`<div class="row"><div><b>${t.emoji} ${esc(t.name)}</b><small>${dur(s.researching.endsAt - now)}</small></div>${this.timerBtn({ kind: 'research' }, now)}</div>`);
    }
    const available = TECHS.filter(
      (t) => s.discovered.includes(t.countryId) && !s.research.includes(t.id) && TECHS.every((p) => p.countryId !== t.countryId || p.k !== t.k - 1 || s.research.includes(p.id)),
    );
    if (!available.length && !s.researching) parts.push('<p class="sub">Visitez un pays pour débloquer ses recherches.</p>');
    for (const t of available) {
      const c = COUNTRY_BY_ID[t.countryId];
      const cost = G.researchCost(c.ring, t.k);
      parts.push(
        `<div class="row"><div><b>${t.emoji} ${esc(t.name)}</b><small>${c.emoji} ${fmt(cost.coins)} 🪙 + ${fmt(cost.resource)} ${c.resource.emoji} · ${dur(G.researchDuration(c.ring, t.k) * 1000)}</small></div>` +
          btn('🔬', 'research', [t.id], !!s.researching || s.coins < cost.coins || s.resources[t.countryId] < cost.resource) + `</div>`,
      );
    }
    const pending = s.reports.filter((r) => r.pending);
    if (pending.length) {
      parts.push('<h3>Événements en attente</h3>');
      for (const r of pending) parts.push(`<div class="row"><div><b>${EVENT_BY_ID[r.event!.defId].emoji} ${esc(r.destName)}</b></div>${btn('Décider', 'showReport', [r.id])}</div>`);
    }
    return parts.join('');
  }

  private planeRow(p: PlaneState, now: number): string {
    const s = this.state;
    const st = G.planeStats(s, p);
    let status = `👥 ${Math.floor(st.capacity)} · 🗺️ ${Math.floor(st.range)} km · 🛋️ ${st.comfort.toFixed(1)}`;
    let actions = '';
    if (p.flight) {
      const dest = p.flight.destination;
      if (p.flight.endsAt <= now) {
        status = `Rentré de ${COUNTRY_BY_ID[dest.countryId].emoji} ${esc(dest.name)}`;
        actions = btn('📥 Collecter', 'collect', [p.uid], false, 'hl');
      } else {
        status = `→ ${COUNTRY_BY_ID[dest.countryId].emoji} ${esc(dest.name)} · ${dur(p.flight.endsAt - now)}`;
        actions = (p.flight.tailwindUsed ? '' : btn('📺 Vent arrière', 'tailwind', [p.uid], false, 'small')) + this.timerBtn({ kind: 'flight', planeUid: p.uid }, now);
      }
    } else if (p.damaged) {
      status = p.repairEndsAt ? `🔧 Réparation ${dur(p.repairEndsAt - now)}` : '<span class="warn">Endommagé</span>';
      actions = p.repairEndsAt
        ? this.timerBtn({ kind: 'repair', planeUid: p.uid }, now)
        : btn(`🔧 ${fmt(G.repairCost(PLANE_BY_ID[p.modelId].price))} 🪙`, 'repair', [p.uid, 'coins'], false, 'small') + btn('📺', 'repair', [p.uid, 'ad'], false, 'small');
    } else {
      actions = btn('🛫 Envoyer', 'pickDest', [p.uid], false, 'hl');
    }
    return `<div class="row"><div><b style="color:${p.color}">✈</b> <b>${esc(p.name)}</b><small>${status}</small></div><div class="acts">${actions}${btn('⚙️', 'planeDetail', [p.uid], false, 'small')}</div></div>`;
  }

  private destModal(planeUid: string): string {
    const s = this.state;
    const now = this.now;
    const plane = s.planes.find((p) => p.uid === planeUid)!;
    const st = G.planeStats(s, plane);
    const ring = G.unlockedRing(s);
    const rows = COUNTRIES.filter((c) => c.ring <= ring).flatMap((c) =>
      G.destinationsFor(s.seed, c.id, now).map((d) => {
        const can = G.canFly(s, plane, d);
        const vips = s.vips.filter((v) => v.demand?.countryId === c.id).length;
        return (
          `<div class="row"><div><b>${c.emoji} ${esc(d.name)}</b><small>${d.distance} km · ${G.MODIFIER_INFO[d.modifier].name} · ${dur(G.flightDuration(d.distance, st.speed) * 1000)}${vips ? ` · ${vips} VIP` : ''}</small>` +
          `${can.ok ? '' : `<small class="warn">${esc(can.error)}</small>`}</div>${btn('🛫', 'send', [planeUid, d], !can.ok)}</div>`
        );
      }),
    );
    return `<h2>${esc(plane.name)} : destination</h2><p class="sub">${Math.min(Math.floor(s.lounge.passengers), Math.floor(st.capacity))} passagers embarqueront.</p><div class="list">${rows.join('')}</div>${btn('Annuler', 'close')}`;
  }

  private reportModal(id: string): string {
    const r = this.state.reports.find((x) => x.id === id);
    if (!r) return btn('OK', 'close');
    const c = COUNTRY_BY_ID[r.countryId];
    const ev = r.event && EVENT_BY_ID[r.event.defId];
    let html = `<h2>${c.emoji} Retour de ${esc(r.destName)}</h2>`;
    if (ev) {
      html += `<p><b>${ev.emoji} ${esc(ev.title)}</b><br>${esc(ev.text)}</p>`;
      if (r.pending) {
        const plane = this.state.planes.find((p) => p.uid === r.planeUid);
        return html + ev.options!.map((o, k) => btn(`${esc(o.label)} (${Math.round(100 * G.optionChance(this.state, plane, r.countryId, o.chance))} %)`, 'choose', [r.id, k])).join('');
      }
      if (r.event!.avoided) html += '<p>Votre équipage a évité le problème.</p>';
      else if (r.event!.outcome) html += `<p><i>${esc(r.event!.outcome.text)}</i></p>`;
    }
    html += `<p>👥 ${r.passengers} passagers · <b>+${fmt(r.coins + r.vipCoins)} 🪙</b> · +${fmt(r.resource + r.vipResource)} ${c.resource.emoji}${r.vipMiles ? ` · +${r.vipMiles} ✈️` : ''}</p>`;
    for (const v of r.vips) html += `<p>${VIP_BY_ID[v.defId].emoji} ${esc(VIP_BY_ID[v.defId].name)} : ${v.satisfied ? 'ravi !' : esc(v.reason ?? 'déçu')}</p>`;
    return html + (r.doubled ? '' : btn('📺 Doubler la récolte', 'doubleReport', [r.id])) + btn('OK', 'close');
  }

  private planeShopModal(): string {
    const s = this.state;
    return `<h2>Concession</h2><div class="list">` +
      PLANE_MODELS.map(
        (m) =>
          `<div class="row"><div><b>${esc(m.name)}</b><small>👥 ${m.capacity} · 💨 ${m.speed} · 🗺️ ${m.range} km · ${m.slots} module(s)${s.level < m.level ? ` · niveau ${m.level}` : ''}</small></div>` +
          btn(`${fmt(m.price)} 🪙`, 'buyPlane', [m.id], s.level < m.level || s.coins < m.price) + `</div>`,
      ).join('') + `</div>` + btn('Fermer', 'close');
  }

  private planeModal(uid: string): string {
    const s = this.state;
    const p = s.planes.find((x) => x.uid === uid);
    if (!p) return btn('Fermer', 'close');
    const st = G.planeStats(s, p);
    const price = PLANE_BY_ID[p.modelId].price;
    const stats = STAT_KEYS.map((k) => {
      const lvl = p.upgrades[k];
      const cost = G.planeUpgradeCost(price, lvl);
      return `<div class="row"><div><b>${STAT_INFO[k].emoji} ${STAT_INFO[k].name}</b><small>${st[k].toFixed(k === 'comfort' ? 1 : 0)} ${STAT_INFO[k].unit} · niv. ${lvl}/${MAX_STAT_LEVEL}</small></div>` +
        (lvl < MAX_STAT_LEVEL ? btn(`⬆️ ${fmt(cost)}`, 'upgradePlane', [uid, k], s.coins < cost, 'small') : '') + `</div>`;
    }).join('');
    const crew = (Object.keys(ROLE_INFO) as (keyof typeof ROLE_INFO)[]).map((role) => {
      const m = s.crew.find((c) => c.uid === p.crew[role]);
      return `<div class="row"><div><b>${ROLE_INFO[role].emoji} ${ROLE_INFO[role].name}</b><small>${m ? `${esc(m.name)} (${m.rarity}, niv. ${m.level})` : 'libre'}</small></div></div>`;
    }).join('');
    return `<h2>${esc(p.name)}</h2>${stats}<h3>Équipage</h3>${crew}${btn('Fermer', 'close')}`;
  }

  private equipe(now: number): string {
    const s = this.state;
    const freeAt = s.cooldowns.free_recruit ?? 0;
    const parts = [
      `<h3>Agence de recrutement (${s.crew.length}/${G.MAX_CREW})</h3><div class="grid">` +
        btn(`Recruter ${fmt(G.recruitCost(s.level))} 🪙`, 'recruit', ['coins'], s.coins < G.recruitCost(s.level)) +
        btn(`Premium 30 ✈️`, 'recruit', ['miles'], s.miles < 30) +
        btn(freeAt > now ? `📺 dans ${dur(freeAt - now)}` : '📺 Gratuit', 'recruit', ['ad'], freeAt > now) +
        `</div>`,
    ];
    for (const m of [...s.crew].sort((a, b) => RARITY_INFO[b.rarity].rank - RARITY_INFO[a.rarity].rank)) {
      const plane = s.planes.find((p) => p.uid === m.planeUid);
      parts.push(
        `<div class="row"><div><b>${ROLE_INFO[m.role].emoji} ${esc(m.name)}</b><small>${ROLE_INFO[m.role].name} · ${RARITY_INFO[m.rarity].name} · niv. ${m.level}${m.element !== 'neutre' ? ` · ${COUNTRY_BY_ID[m.element].emoji}` : ''}${plane ? ` · ✈ ${esc(plane.name)}` : ''}</small></div>` +
          (plane ? btn('Retirer', 'unassign', [m.uid], false, 'small') : btn('Affecter', 'assignPick', [m.uid], false, 'small')) + `</div>`,
      );
    }
    return parts.join('');
  }

  private assignModal(crewUid: string): string {
    const m = this.state.crew.find((c) => c.uid === crewUid)!;
    return `<h2>${ROLE_INFO[m.role].emoji} ${esc(m.name)} : quel avion ?</h2><div class="grid">` +
      this.state.planes.map((p) => btn(`${esc(p.name)}${p.crew[m.role] ? ' (remplace)' : ''}`, 'assign', [crewUid, p.uid], !!p.flight)).join('') +
      `</div>` + btn('Annuler', 'close');
  }

  private async addFriend(code: string) {
    const [profile] = await this.social.fetchProfiles([G.normalizeCode(code)]);
    if (!profile) this.toast('Joueur introuvable : le serveur social n’est pas encore en ligne.');
    else this.check(G.addFriend(this.state, profile, Date.now()), `${profile.name} ajouté !`);
    G.save(this.state);
    this.render();
  }

  private amis(now: number): string {
    const s = this.state;
    G.syncWeek(s, now);
    const parts = [
      `<h3>Mon profil</h3><div class="row"><div><b>${esc(s.social.name)}</b><small>Code ami : <b>${esc(s.social.code)}</b></small></div>${btn('✏️', 'rename', [], false, 'small')}</div>`,
      `<h3>Classement de la semaine</h3>`,
    ];
    G.friendsLeaderboard(s, now).forEach((r, k) =>
      parts.push(`<div class="row${r.me ? ' hint' : ''}"><div><b>${k + 1}. ${esc(r.name)}</b><small>${fmt(r.score)} 🪙 gagnées cette semaine</small></div></div>`),
    );
    const last = s.social.lastWeek;
    if (last && !last.claimed) {
      parts.push(`<div class="row"><div><b>Semaine passée : ${last.rank}ᵉ sur ${last.players}</b></div>${btn('🏆 Récupérer', 'weekly')}</div>`);
    }
    parts.push(`<h3>Amis (${s.social.friends.length}/${G.MAX_FRIENDS})</h3>`);
    if (!s.social.friends.length) parts.push('<p class="sub">Échangez vos codes pour vous envoyer des cadeaux et visiter vos aéroports. (Le serveur social arrive bientôt : pour l’instant aucun code ne peut être trouvé.)</p>');
    for (const f of s.social.friends) {
      const giftDone = s.social.gifts.day === G.dayIndex(now) && s.social.gifts.sent.includes(f.code);
      const visitDone = s.social.visits.day === G.dayIndex(now) && s.social.visits.codes.includes(f.code);
      parts.push(
        `<div class="row"><div><b>${esc(f.profile.name)}</b><small>Niv. ${f.profile.level} · ${f.profile.floors.length} magasins</small></div><div class="acts">` +
          btn('🎁', 'gift', [f.code], giftDone, 'small') + btn('👀 Visiter', 'visit', [f.code], visitDone, 'small') + btn('✖', 'removeFriend', [f.code], false, 'small') + `</div></div>`,
      );
    }
    parts.push(btn('➕ Ajouter un ami', 'addFriend'));
    return parts.join('');
  }

  private objectifs(now: number): string {
    const s = this.state;
    G.refreshQuests(s, now);
    const parts: string[] = [];
    const mission = G.currentMission(s);
    if (mission) {
      parts.push(`<h3>Mission</h3><div class="row"><div><b>${esc(mission.def.text)}</b><small>${mission.progress}/${mission.def.goal} · +${mission.def.miles} ✈️</small></div>${btn('Valider', 'mission', [], !mission.done)}</div>`);
    }
    const daily = G.dailyStatus(s, now);
    const reward = daily.reward;
    const label = reward.kind === 'coins' ? `${fmt(reward.perLevel * s.level)} 🪙` : reward.kind === 'miles' ? `${reward.amount} ✈️` : `Recrue ${reward.premium ? 'premium' : ''}`;
    parts.push(`<h3>Cadeau du jour</h3><div class="row"><div><b>Jour ${daily.streak}</b><small>${label}</small></div>${btn('🎁', 'daily', [], !daily.available)}</div>`);
    parts.push('<h3>Quêtes du jour</h3>');
    G.questViews(s, now).forEach((q, k) =>
      parts.push(`<div class="row"><div><b>${esc(q.text)}</b><small>${q.progress}/${q.goal}</small></div>${btn(q.claimed ? '✔' : 'Valider', 'quest', [k], !q.done || q.claimed)}</div>`),
    );
    parts.push(btn('🧰 Coffre des 3 quêtes', 'chest', [], s.quests.chestClaimed || !s.quests.claimed.every(Boolean)));
    const season = G.seasonView(s, now);
    if (season) {
      const def = season.season.def;
      const country = COUNTRY_BY_ID[def.country];
      parts.push(
        `<h3>${def.emoji} ${esc(def.name)}</h3><div class="row hint"><div><b>${fmt(season.points)} ${def.currency.emoji} ${esc(def.currency.name)}</b>` +
          `<small>${esc(def.text)} Vols vers ${country.emoji} ${country.name} : points doublés. Fin dans ${dur(season.season.endsAt - now)}.</small></div></div>`,
      );
      season.track.forEach((step, k) =>
        parts.push(
          `<div class="row"><div><b>${rewardLabel(step.reward, s.level, SHOP_BY_ID[def.shopId]?.name)}</b><small>${fmt(Math.min(season.points, step.points))}/${fmt(step.points)} ${def.currency.emoji}</small></div>` +
            btn(step.claimed ? '✔' : 'Prendre', 'season', [k], !step.reached || step.claimed) + `</div>`,
        ),
      );
    } else {
      const next = G.nextSeason(now);
      parts.push(`<h3>Événement saisonnier</h3><p class="sub">Prochain : ${next.def.emoji} ${esc(next.def.name)} dans ${dur(next.startsAt - now)}.</p>`);
    }
    parts.push('<h3>Succès</h3>');
    for (const a of G.achievementViews(s).filter((x) => !x.claimed).slice(0, 8)) {
      parts.push(`<div class="row"><div><b>${esc(a.def.text)}</b><small>${fmt(a.progress)}/${fmt(a.def.goal)} · +${a.def.miles} ✈️</small></div>${btn('Valider', 'achievement', [a.def.id], !a.done)}</div>`);
    }
    return parts.join('');
  }
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

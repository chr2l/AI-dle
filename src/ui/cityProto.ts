/**
 * The airport on the ground (GDD §24): full-screen layer over the game with
 * its own iso scene. Drag to pan, pinch or wheel to zoom, pick a building in
 * the bottom bar then tap the ground to place it; tap a building to see its
 * bonuses, move it, turn it or remove it; tap locked land to buy the plot.
 * It edits the real game (`state.city`): where a room stands sets its income.
 */
import { Group, Mesh, Plane, Raycaster, Vector2, Vector3, type Object3D } from 'three';
import {
  airsideLinked, BUILDINGS, canPlace, connected, footprint, gatesInService, inOpenLand, itemAt, PLOT, placeError, touching, ZONE_NAMES,
  type BuildingKind, type CityLayout, type Placed,
} from '../core/city';
import {
  BUILDABLE, buyPlot, canBuyPlot, cityPlace, cityPrice, cityRemove, cityRotate, ensureCity, floorBonus, placeRoom, plotPrice, roomMultipliers, roomShop,
  unplacedFloors,
} from '../core/cityGame';
import type { GameState } from '../core/types';
import { meshFromGrid } from '../render/tower';
import { PixelRenderer } from '../render/pixelRenderer';
import { buildAlertModel, buildFenceModel, buildGhostModel, buildGroundModel, buildPlacedModel, TILE } from '../render/models/city';
import { buildPlaneModel } from '../render/models/plane';
import { PLANE_MODELS } from '../core/data/planes';
import { iconize } from './icons';
import { saveGame } from './persist';
import { esc, fmt } from './widgets';

const RIGHT = new Vector3(1, 0, -1).normalize();
const SCREEN_UP = new Vector3(-1, 2, -1).normalize();
const PALETTE: BuildingKind[] = ['couloir', 'salle', 'porte', 'arbre', 'parterre', 'banc', 'fontaine', 'voie', 'stand', 'piste'];
/** Runway side tools are shown after a divider in the bar. */
const AIRSIDE_TOOLS: BuildingKind[] = ['voie', 'stand', 'piste'];
/** Kinds that stay armed after a placement, to lay several in a row. */
const REPEAT: BuildingKind[] = ['couloir', 'voie', 'arbre', 'parterre', 'banc'];

/** What the ghost does when placed: build something new, move a building, or put a waiting room down. */
type Tool = { placing: Placed; mode: 'new' | 'move' | 'room' } | null;

let current: CityProto | null = null;
export const cityOpen = () => current !== null;
export function closeCity() {
  current?.close();
}

export function openCityProto(state: GameState, onClose?: () => void) {
  if (current) return;
  current = new CityProto(state, onClose);
}

class CityProto {
  private root = document.createElement('div');
  private canvas = document.createElement('canvas');
  private view: PixelRenderer;
  private layout: CityLayout;
  private world = new Group();
  private ground: Object3D | null = null;
  private plot: { px: number; pz: number } | null = null;
  private note = '';
  private items = new Group();
  private overlay = new Group();
  private selected: string | null = null;
  private tool: Tool = null;
  private pickingShop = false;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag = { x: 0, y: 0, moved: 0, pinch: 0 };
  private ro: ResizeObserver;

  constructor(
    private state: GameState,
    private onClose?: () => void,
  ) {
    this.layout = ensureCity(state);
    this.root.className = 'cp';
    this.root.innerHTML = `<style>${CSS}</style>`;
    this.root.append(this.canvas);
    const ui = document.createElement('div');
    ui.className = 'cp-ui';
    this.root.append(ui);
    document.body.append(this.root);

    this.view = new PixelRenderer(this.canvas, { style: 'cube', background: '#9fd8ff' });
    this.world.add(this.items, this.overlay);
    this.drawGround();
    this.view.scene.add(this.world);
    const fit = Math.min(innerWidth, innerHeight * 0.8) / ((this.layout.width + this.layout.depth) * TILE * 0.72);
    this.view.pixelsPerVoxel = Math.max(3, Math.min(14, fit * 2));
    this.view.target.set((this.layout.width * TILE) / 2, 0, (this.layout.depth * TILE) / 2);

    this.canvas.addEventListener('pointerdown', (e) => this.down(e));
    this.canvas.addEventListener('pointermove', (e) => this.move(e));
    this.canvas.addEventListener('pointerup', (e) => this.up(e));
    this.canvas.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    this.canvas.addEventListener('wheel', (e) => this.zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12), { passive: true });
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
    this.rebuild();
    this.resize();
  }

  close() {
    saveGame(this.state);
    this.ro.disconnect();
    this.view.dispose();
    this.root.remove();
    current = null;
    this.onClose?.();
  }

  private drawGround() {
    if (this.ground) {
      (this.ground as Mesh).geometry?.dispose();
      this.world.remove(this.ground);
    }
    this.ground = meshFromGrid(buildGroundModel(this.layout));
    this.world.add(this.ground);
  }

  /** Runs a game action; a refusal is shown in the card. */
  private act(r: { ok: true } | { ok: false; error: string }): boolean {
    this.note = r.ok ? '' : r.error;
    if (r.ok) saveGame(this.state);
    return r.ok;
  }

  private resize() {
    this.view.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.view.render();
  }

  private zoom(f: number) {
    this.view.pixelsPerVoxel = Math.max(2, Math.min(20, this.view.pixelsPerVoxel * f));
    this.resize();
  }

  /** Tile under a screen point (on the ground plane), or null outside the land. */
  private tileAt(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.view.camera.updateMatrixWorld();
    const ray = new Raycaster();
    ray.setFromCamera(ndc, this.view.camera);
    const hit = ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -1), new Vector3());
    if (!hit) return null;
    const x = Math.floor(hit.x / TILE);
    const z = Math.floor(hit.z / TILE);
    return x >= 0 && z >= 0 && x < this.layout.width && z < this.layout.depth ? { x, z } : null;
  }

  private down(e: PointerEvent) {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.drag = { x: e.clientX, y: e.clientY, moved: 0, pinch: this.pinchDistance() };
  }

  private pinchDistance() {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private move(e: PointerEvent) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) {
      if (this.tool && e.pointerType === 'mouse') this.aim(e.clientX, e.clientY);
      return;
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const d = this.pinchDistance();
      if (this.drag.pinch > 0 && d > 0) this.zoom(d / this.drag.pinch);
      this.drag.pinch = d;
      this.drag.moved = 99;
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    this.drag.moved += Math.abs(dx) + Math.abs(dy);
    if (this.drag.moved < 8) return;
    const ppv = this.view.pixelsPerVoxel;
    this.view.target.addScaledVector(RIGHT, -dx / ppv).addScaledVector(SCREEN_UP, dy / ppv);
    this.view.render();
  }

  private up(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (this.drag.moved >= 8 || this.pointers.size > 0) return;
    const tile = this.tileAt(e.clientX, e.clientY);
    if (this.tool) {
      if (!tile) return;
      this.aim(e.clientX, e.clientY);
      const p = this.tool.placing;
      const mode = this.tool.mode;
      const before = new Set(this.layout.items.map((o) => o.uid));
      const ok = this.act(mode === 'room' ? placeRoom(this.state, p.floor!, p.x, p.z, p.rot) : cityPlace(this.state, p));
      if (ok) {
        const added = this.layout.items.find((o) => !before.has(o.uid));
        if (mode === 'new' && REPEAT.includes(p.kind)) this.tool = { placing: { ...p }, mode };
        else {
          this.selected = added?.uid ?? p.uid;
          this.tool = null;
        }
      }
      this.rebuild();
      return;
    }
    this.note = '';
    const item = tile ? itemAt(this.layout, tile.x, tile.z) : undefined;
    this.selected = item?.uid ?? null;
    this.plot = tile && !item && !inOpenLand(this.layout, { x: tile.x, z: tile.z, w: 1, d: 1 }) ? { px: Math.floor(tile.x / PLOT), pz: Math.floor(tile.z / PLOT) } : null;
    this.rebuild();
  }

  /** Moves the ghost of the building being placed under the finger, centered. */
  private aim(clientX: number, clientY: number) {
    const tile = this.tileAt(clientX, clientY);
    if (!this.tool || !tile) return;
    const r = footprint(this.tool.placing);
    this.tool.placing.x = tile.x - Math.floor((r.w - 1) / 2);
    this.tool.placing.z = tile.z - Math.floor((r.d - 1) / 2);
    this.drawOverlay();
  }

  private onClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cp]');
    if (!el) return;
    const [act, arg] = [el.dataset.cp!, el.dataset.arg ?? ''];
    const sel = this.layout.items.find((p) => p.uid === this.selected);
    if (act !== 'back') this.note = '';
    switch (act) {
      case 'back':
        if (this.tool || this.pickingShop || this.plot) {
          this.tool = null;
          this.pickingShop = false;
          this.plot = null;
          this.note = '';
          this.rebuild();
        } else this.close();
        return;
      case 'build': {
        const kind = arg as BuildingKind;
        if (kind === 'salle') {
          this.pickingShop = true;
          this.selected = null;
          this.plot = null;
          this.rebuild();
          return;
        }
        this.arm({ uid: 'new', kind, x: 0, z: 0, rot: 0 }, 'new');
        return;
      }
      case 'shop':
        this.pickingShop = false;
        this.arm({ uid: 'new', kind: 'salle', x: 0, z: 0, rot: 0, floor: Number(arg) }, 'room');
        return;
      case 'move':
        if (sel) this.arm({ ...sel }, 'move');
        return;
      case 'plot':
        if (this.plot && this.act(buyPlot(this.state, this.plot.px, this.plot.pz))) {
          this.plot = null;
          this.drawGround();
        }
        this.rebuild();
        return;
      case 'turn':
        if (this.tool) {
          this.tool.placing.rot = this.tool.placing.rot ? 0 : 1;
          this.drawOverlay();
          this.renderUi();
        } else if (sel) {
          this.act(cityRotate(this.state, sel.uid));
          this.rebuild();
        }
        return;
      case 'remove':
        if (sel && this.act(cityRemove(this.state, sel.uid))) this.selected = null;
        this.rebuild();
        return;
    }
  }

  /** Arms a placement: the ghost starts at the center of the screen. */
  private arm(p: Placed, mode: 'new' | 'move' | 'room') {
    this.tool = { placing: p, mode };
    this.selected = mode === 'move' ? p.uid : null;
    this.plot = null;
    const rect = this.canvas.getBoundingClientRect();
    this.aim(rect.left + rect.width / 2, rect.top + rect.height / 2);
    this.rebuild();
  }

  private rebuild() {
    this.items.clear();
    const shopFor = roomShop(this.state);
    const linked = connected(this.layout);
    const air = airsideLinked(this.layout);
    const inService = gatesInService(this.layout, linked, air);
    const fence = meshFromGrid(buildFenceModel(this.layout));
    fence.position.set(this.layout.airsideX * TILE, 1, 0);
    this.items.add(fence);
    for (const p of this.layout.items) {
      if (this.tool?.mode === 'move' && p.uid === this.tool.placing.uid) continue;
      // A plane waits on every stand served by a gate in service.
      if (p.kind === 'stand' && air.has(p.uid) && this.layout.items.some((g) => inService.has(g.uid) && touching(footprint(g), footprint(p)))) {
        const r = footprint(p);
        const plane = meshFromGrid(buildPlaneModel(PLANE_MODELS[0]));
        plane.scale.setScalar(0.75);
        plane.position.set(r.x * TILE + 1.5, 1, r.z * TILE + 0.4);
        this.items.add(plane);
      }
      const r = footprint(p);
      const mesh = meshFromGrid(buildPlacedModel(p, shopFor));
      mesh.position.set(r.x * TILE, 1, r.z * TILE);
      this.items.add(mesh);
      if (((p.kind === 'salle' || p.kind === 'porte') && !linked.has(p.uid)) || (p.kind === 'stand' && !air.has(p.uid))) {
        const alert = meshFromGrid(buildAlertModel());
        alert.position.set((r.x + r.w / 2) * TILE - 1.5, p.kind === 'salle' ? 13 : 8, (r.z + r.d / 2) * TILE - 1.5);
        this.items.add(alert);
      }
    }
    this.drawOverlay();
    this.renderUi();
  }

  private drawOverlay() {
    disposeAll(this.overlay);
    const show = this.tool?.placing ?? this.layout.items.find((p) => p.uid === this.selected);
    if (show) {
      const ok = this.tool ? canPlace(this.layout, this.tool.placing) : true;
      const r = footprint(show);
      if (this.tool) {
        const model = meshFromGrid(buildPlacedModel(show, roomShop(this.state)));
        model.position.set(r.x * TILE, 2, r.z * TILE);
        this.overlay.add(model);
      }
      const ghost = meshFromGrid(buildGhostModel(show, ok));
      ghost.position.set(r.x * TILE, 1.05, r.z * TILE);
      this.overlay.add(ghost);
    } else if (this.plot) {
      const p: Placed = { uid: 'plot', kind: 'salle', x: this.plot.px * PLOT, z: this.plot.pz * PLOT, rot: 0 };
      const ghost = meshFromGrid(buildGhostModel(p, canBuyPlot(this.layout, this.plot.px, this.plot.pz)));
      ghost.scale.set(PLOT / 2, 1, PLOT / 2);
      ghost.position.set(p.x * TILE, 1.05, p.z * TILE);
      this.overlay.add(ghost);
    }
    this.view.render();
  }

  private renderUi() {
    const ui = this.root.querySelector('.cp-ui')!;
    const linked = connected(this.layout);
    const shopFor = roomShop(this.state);
    const mult = [...roomMultipliers(this.state).values()];
    const avg = mult.length ? mult.reduce((a, b) => a + b, 0) / mult.length : 1;
    const waiting = unplacedFloors(this.state).filter((i) => this.state.floors[i]?.shop);
    const busy = this.tool || this.pickingShop || this.plot;
    const top =
      `<div class="cp-top"><button data-cp="back" class="cp-b">${busy ? '✖ Annuler' : '← Retour'}</button>` +
      `<div class="cp-title"><b>Mon aéroport</b><small>${mult.length} salles · revenus ×${avg.toFixed(2)}${waiting.length ? ` · ${waiting.length} en attente` : ''}</small></div>` +
      `<div class="cp-coins">🪙 ${fmt(this.state.coins)}</div></div>`;
    const note = this.note ? `<small class="cp-err">${esc(this.note)}</small>` : '';
    let panel = '';
    if (this.pickingShop) {
      panel = waiting.length
        ? `<div class="cp-card"><b>Quelle salle poser ?</b><small>Ces salles attendent de la place sur le terrain.</small><div class="cp-shops">` +
          waiting.map((i) => {
            const shop = shopFor({ uid: '', kind: 'salle', x: 0, z: 0, rot: 0, floor: i })!;
            return `<button data-cp="shop" data-arg="${i}" class="cp-shop">${shop.emoji}<span>${esc(shop.name)}</span></button>`;
          }).join('') + '</div></div>'
        : `<div class="cp-card"><b>Toutes vos salles sont posées</b><small>Chaque nouveau magasin construit arrive ici, posé tout seul s’il y a de la place. Déplacez-les pour gagner des bonus.</small></div>`;
    } else if (this.tool) {
      const p = this.tool.placing;
      const err = placeError(this.layout, p);
      const shop = p.kind === 'salle' ? shopFor(p) : undefined;
      const price = this.tool.mode === 'new' ? cityPrice(this.state, p.kind) : 0;
      const where = BUILDINGS[p.kind].side === 'pistes' ? ' (côté pistes, à droite de la clôture)' : p.kind === 'porte' ? ' (contre la clôture)' : '';
      panel = `<div class="cp-card"><b>${BUILDINGS[p.kind].emoji} ${esc(shop?.name ?? BUILDINGS[p.kind].name)}${price ? ` · 🪙 ${fmt(price)}` : ''}</b>` +
        `<small>${err ? esc(err) : `Touchez le terrain pour poser${where}. Glissez pour déplacer la vue.`}</small>${note}` +
        `<div class="cp-row"><button data-cp="turn" class="cp-b">⟳ Tourner</button></div></div>`;
    } else if (this.plot) {
      const can = canBuyPlot(this.layout, this.plot.px, this.plot.pz);
      const price = plotPrice(this.state);
      panel = `<div class="cp-card"><b>🌾 Parcelle libre</b><small>${can ? `${PLOT} × ${PLOT} cases pour agrandir l’aéroport. Les salles en attente s’y posent toutes seules.` : 'Achetez d’abord une parcelle voisine de votre terrain.'}</small>${note}` +
        (can ? `<div class="cp-row"><button data-cp="plot" class="cp-b"${this.state.coins < price ? ' disabled' : ''}>Acheter · 🪙 ${fmt(price)}</button></div>` : '') + '</div>';
    } else if (this.selected) {
      const p = this.layout.items.find((o) => o.uid === this.selected)!;
      panel = this.infoCard(p, linked).replace('</small>', `</small>${note}`);
    } else {
      panel = `<div class="cp-hint">${waiting.length ? `${waiting.length} salle(s) attendent de la place : achetez une parcelle ou libérez le terrain.` : 'Touchez un bâtiment pour voir ses bonus, ou choisissez quoi construire.'}</div>`;
    }
    const tool = (k: BuildingKind) => {
      const price = cityPrice(this.state, k);
      const sub = k === 'salle' ? (waiting.length ? `${waiting.length} en attente` : 'Mes salles') : price ? `🪙 ${fmt(price)}` : k === 'voie' ? 'Voie' : BUILDINGS[k].name;
      return `<button data-cp="build" data-arg="${k}" class="cp-tool${AIRSIDE_TOOLS.includes(k) ? ' air' : ''}${price > this.state.coins ? ' poor' : ''}"><i>${BUILDINGS[k].emoji}</i><span>${sub}</span></button>`;
    };
    const bar = busy ? '' : `<div class="cp-bar">${PALETTE.map(tool).join('')}</div>`;
    ui.innerHTML = iconize(top + `<div class="cp-bottom">${panel}${bar}</div>`);
  }

  private infoCard(p: Placed, linked: Set<string>): string {
    const def = BUILDINGS[p.kind];
    const shop = p.kind === 'salle' ? roomShop(this.state)(p) : undefined;
    const actions =
      `<div class="cp-row"><button data-cp="move" class="cp-b">✥ Déplacer</button><button data-cp="turn" class="cp-b">⟳ Tourner</button>` +
      (BUILDABLE.includes(p.kind) ? `<button data-cp="remove" class="cp-b ghost">🗑 Retirer</button>` : '') + '</div>';
    if (p.kind === 'salle' && shop) {
      const b = floorBonus(this.state, p.floor!)!;
      const pct = (v: number) => `+${Math.round(v * 100)} %`;
      const line = (ok: boolean, text: string, val: string) => `<li class="${ok ? 'on' : 'off'}"><span>${ok ? '✔' : '✖'} ${text}</span><b>${val}</b></li>`;
      return `<div class="cp-card"><b>${shop.emoji} ${esc(shop.name)}</b><small>${shop.elements.join(', ')} · ${ZONE_NAMES[shop.category]}</small><ul>` +
        line(b.connected, b.connected ? 'Reliée au terminal' : 'Pas reliée : posez un couloir jusqu’au terminal', b.connected ? '' : '×0') +
        line(b.neighbours > 0, `${b.neighbours} voisine(s) du même élément`, pct(0.1 * b.neighbours)) +
        line(b.zone > 0, `${ZONE_NAMES[shop.category]} : ${b.zoneSize} salle(s) (bonus dès 3, 6, 10)`, pct(b.zone)) +
        line(b.beauty > 0, `Beauté ${b.beauty} (décors à portée)`, pct(Math.min(0.3, 0.03 * b.beauty))) +
        line(b.nearGate, 'Porte à 2 cases ou moins', b.nearGate ? '+15 %' : '') +
        `</ul><div class="cp-total">Revenu ×${b.multiplier.toFixed(2)}</div>${actions}</div>`;
    }
    const note: Partial<Record<BuildingKind, string>> = {
      terminal: 'Le cœur de l’aéroport : tout doit s’y relier par des couloirs.',
      couloir: 'Relie salles et portes au terminal.',
      porte: !linked.has(p.uid)
        ? 'Pas reliée : posez un couloir jusqu’au terminal.'
        : gatesInService(this.layout, linked).has(p.uid)
          ? 'En service : un avion attend sur son parking. Les salles proches vendent plus.'
          : 'Il lui faut un parking avion juste derrière la clôture, relié à la piste.',
      piste: 'Plus tard, sa longueur décidera quels avions peuvent décoller.',
      voie: 'Les avions roulent ici : reliez chaque parking à la piste.',
      stand: airsideLinked(this.layout).has(p.uid) ? 'Relié à la piste. Collez-le à une porte pour la mettre en service.' : 'Pas relié : tracez des voies de circulation jusqu’à la piste.',
      tour: 'Plus tard, les vols qui partent près d’elle auront moins d’incidents.',
      arbre: '', banc: '', parterre: '', fontaine: '',
    };
    const aura = def.aura ? `Beauté +${def.beauty} pour les salles à ${def.aura} case(s) ou moins. Retirer ne rembourse pas.` : '';
    return `<div class="cp-card"><b>${def.emoji} ${def.name}</b><small>${note[p.kind] || aura}</small>${actions}</div>`;
  }
}

function disposeAll(group: Group) {
  for (const child of [...group.children] as Object3D[]) {
    (child as Mesh).geometry?.dispose();
    group.remove(child);
  }
}

const CSS = `
.cp { position: fixed; inset: 0; z-index: 60; background: #9fd8ff; touch-action: none; }
.cp canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.cp-ui { position: absolute; inset: 0; pointer-events: none; display: flex; flex-direction: column; justify-content: space-between; padding: calc(env(safe-area-inset-top) + 8px) 10px calc(env(safe-area-inset-bottom) + 8px); font-family: var(--body, Nunito, sans-serif); color: #2b2d42; }
.cp-ui button, .cp-card, .cp-hint { pointer-events: auto; }
.cp-top { display: flex; gap: 8px; align-items: center; }
.cp-title { flex: 1; background: #fffaf0; border: 3px solid #2b2d42; border-radius: 14px; padding: 4px 10px; display: flex; flex-direction: column; }
.cp-title b { font: 400 18px/1.1 var(--title, 'Lilita One', sans-serif); }
.cp-title small { font-size: 12px; font-weight: 700; color: #5c6075; }
.cp-b { min-height: 44px; padding: 0 12px; border: 3px solid #2b2d42; border-radius: 14px; background: #ffcf3a; font: 800 14px var(--body, Nunito, sans-serif); color: #2b2d42; box-shadow: 0 3px 0 #2b2d42; }
.cp-b.ghost { background: #fffaf0; }
.cp-bottom { display: flex; flex-direction: column; gap: 8px; }
.cp-card { background: #fffaf0; border: 3px solid #2b2d42; border-radius: 16px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 4px 0 #2b2d42; }
.cp-card > b { font: 400 18px/1.1 var(--title, 'Lilita One', sans-serif); }
.cp-card small { font-size: 13px; color: #5c6075; font-weight: 700; }
.cp-card ul { list-style: none; margin: 4px 0; padding: 0; display: flex; flex-direction: column; gap: 2px; font-size: 13px; font-weight: 700; }
.cp-card li { display: flex; justify-content: space-between; gap: 8px; }
.cp-card li.off { color: #8a8d9c; }
.cp-card li.on b { color: #1f8a4c; }
.cp-total { font: 400 20px var(--title, 'Lilita One', sans-serif); color: #b06a00; }
.cp-row { display: flex; gap: 6px; margin-top: 4px; }
.cp-row .cp-b { flex: 1; }
.cp-hint { align-self: center; background: rgba(255,250,240,.92); border: 3px solid #2b2d42; border-radius: 12px; padding: 6px 10px; font-size: 13px; font-weight: 700; text-align: center; }
.cp-bar { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
.cp-tool { flex: 0 0 auto; width: 72px; min-height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border: 3px solid #2b2d42; border-radius: 14px; background: #fffaf0; box-shadow: 0 3px 0 #2b2d42; font: 800 12px var(--body, Nunito, sans-serif); color: #2b2d42; }
.cp-tool.air { background: #e3e6ec; }
.cp-tool.poor { opacity: .55; }
.cp-coins { background: #fffaf0; border: 3px solid #2b2d42; border-radius: 14px; padding: 8px 10px; font: 800 14px var(--body, Nunito, sans-serif); white-space: nowrap; }
.cp-err { color: #c0392b !important; }
.cp-b[disabled] { opacity: .5; }
.cp-tool i { font-style: normal; font-size: 22px; line-height: 1; }
.cp-shops { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; max-height: 40vh; overflow-y: auto; margin-top: 4px; }
.cp-shop { min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border: 2px solid #2b2d42; border-radius: 12px; background: #fff; font: 700 12px var(--body, Nunito, sans-serif); color: #2b2d42; font-size: 20px; }
.cp-shop span { font-size: 12px; text-align: center; }
`;

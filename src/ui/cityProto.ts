/**
 * "Essayer l'aéroport à plat": playable prototype of the city builder
 * (step 1 of the pivot). Full-screen layer over the game with its own iso
 * scene: drag to pan, pinch or wheel to zoom, pick a building in the bottom
 * bar then tap the ground to place it; tap a building to see its bonuses,
 * move it, turn it or remove it. The layout is kept apart from the game
 * (localStorage `idleport.city`) and does not change the player's tower.
 */
import { Group, Mesh, Plane, Raycaster, Vector2, Vector3, type Object3D } from 'three';
import {
  BUILDINGS, canPlace, connected, footprint, itemAt, newUid, place, remove, roomBonus, rotate, shopOf, starterLayout, ZONE_NAMES,
  type BuildingKind, type CityLayout, type Placed,
} from '../core/city';
import { SHOPS } from '../core/data/shops';
import type { GameState } from '../core/types';
import { meshFromGrid } from '../render/tower';
import { PixelRenderer } from '../render/pixelRenderer';
import { buildAlertModel, buildGhostModel, buildGroundModel, buildPlacedModel, TILE } from '../render/models/city';
import { iconize } from './icons';
import { esc } from './widgets';

const KEY = 'idleport.city';
const RIGHT = new Vector3(1, 0, -1).normalize();
const SCREEN_UP = new Vector3(-1, 2, -1).normalize();
const PALETTE: BuildingKind[] = ['couloir', 'salle', 'porte', 'arbre', 'parterre', 'banc', 'fontaine', 'piste', 'tour'];
/** Kinds that stay armed after a placement, to lay several in a row. */
const REPEAT: BuildingKind[] = ['couloir', 'arbre', 'parterre', 'banc'];

type Tool = { placing: Placed; isNew: boolean } | null;

let current: CityProto | null = null;
export const cityOpen = () => current !== null;
export function closeCity() {
  current?.close();
}

export function openCityProto(state: GameState) {
  if (current) return;
  current = new CityProto(state);
}

function load(state: GameState): CityLayout {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const l = JSON.parse(raw) as CityLayout;
      if (Array.isArray(l.items) && l.items.some((p) => p.kind === 'terminal')) return l;
    }
  } catch {
    /* unreadable or blocked storage: start over */
  }
  return starterLayout(state.floors.map((f) => f.shop?.defId).filter((id): id is string => !!id));
}

function save(layout: CityLayout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    /* private mode: the layout only lives for this visit */
  }
}

class CityProto {
  private root = document.createElement('div');
  private canvas = document.createElement('canvas');
  private view: PixelRenderer;
  private layout: CityLayout;
  private world = new Group();
  private items = new Group();
  private overlay = new Group();
  private selected: string | null = null;
  private tool: Tool = null;
  private pickingShop = false;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag = { x: 0, y: 0, moved: 0, pinch: 0 };
  private ro: ResizeObserver;

  constructor(private state: GameState) {
    this.layout = load(state);
    this.root.className = 'cp';
    this.root.innerHTML = `<style>${CSS}</style>`;
    this.root.append(this.canvas);
    const ui = document.createElement('div');
    ui.className = 'cp-ui';
    this.root.append(ui);
    document.body.append(this.root);

    this.view = new PixelRenderer(this.canvas, { style: 'cube', background: '#9fd8ff' });
    this.world.add(meshFromGrid(buildGroundModel(this.layout)));
    this.world.add(this.items, this.overlay);
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
    save(this.layout);
    this.ro.disconnect();
    this.view.dispose();
    this.root.remove();
    current = null;
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
      if (place(this.layout, p)) {
        save(this.layout);
        if (this.tool.isNew && REPEAT.includes(p.kind)) this.tool = { placing: { ...p, uid: newUid() }, isNew: true };
        else {
          this.selected = p.uid;
          this.tool = null;
        }
      }
      this.rebuild();
      return;
    }
    this.selected = tile ? (itemAt(this.layout, tile.x, tile.z)?.uid ?? null) : null;
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
    switch (act) {
      case 'back':
        if (this.tool || this.pickingShop) {
          this.tool = null;
          this.pickingShop = false;
          this.rebuild();
        } else this.close();
        return;
      case 'build': {
        const kind = arg as BuildingKind;
        if (kind === 'salle') {
          this.pickingShop = true;
          this.selected = null;
          this.rebuild();
          return;
        }
        this.arm({ uid: newUid(), kind, x: 0, z: 0, rot: 0 }, true);
        return;
      }
      case 'shop':
        this.pickingShop = false;
        this.arm({ uid: newUid(), kind: 'salle', x: 0, z: 0, rot: 0, shopId: arg }, true);
        return;
      case 'move':
        if (sel) this.arm({ ...sel }, false);
        return;
      case 'turn':
        if (this.tool) {
          this.tool.placing.rot = this.tool.placing.rot ? 0 : 1;
          this.drawOverlay();
          this.renderUi();
        } else if (sel) {
          rotate(this.layout, sel.uid);
          save(this.layout);
          this.rebuild();
        }
        return;
      case 'remove':
        if (sel && remove(this.layout, sel.uid)) {
          this.selected = null;
          save(this.layout);
          this.rebuild();
        }
        return;
      case 'reset':
        this.layout = starterLayout(this.state.floors.map((f) => f.shop?.defId).filter((id): id is string => !!id));
        save(this.layout);
        this.selected = null;
        this.rebuild();
        return;
    }
  }

  /** Arms a placement: the ghost starts at the center of the screen. */
  private arm(p: Placed, isNew: boolean) {
    this.tool = { placing: p, isNew };
    this.selected = isNew ? null : p.uid;
    const rect = this.canvas.getBoundingClientRect();
    this.aim(rect.left + rect.width / 2, rect.top + rect.height / 2);
    this.rebuild();
  }

  private rebuild() {
    this.items.clear();
    const linked = connected(this.layout);
    for (const p of this.layout.items) {
      if (this.tool && !this.tool.isNew && p.uid === this.tool.placing.uid) continue;
      const r = footprint(p);
      const mesh = meshFromGrid(buildPlacedModel(p));
      mesh.position.set(r.x * TILE, 1, r.z * TILE);
      this.items.add(mesh);
      if ((p.kind === 'salle' || p.kind === 'porte') && !linked.has(p.uid)) {
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
        const model = meshFromGrid(buildPlacedModel(show));
        model.position.set(r.x * TILE, 2, r.z * TILE);
        this.overlay.add(model);
      }
      const ghost = meshFromGrid(buildGhostModel(show, ok));
      ghost.position.set(r.x * TILE, 1.05, r.z * TILE);
      this.overlay.add(ghost);
    }
    this.view.render();
  }

  private renderUi() {
    const ui = this.root.querySelector('.cp-ui')!;
    const linked = connected(this.layout);
    const rooms = this.layout.items.filter((p) => p.kind === 'salle');
    const avg = rooms.length ? rooms.reduce((s, p) => s + roomBonus(this.layout, p.uid, linked).multiplier, 0) / rooms.length : 0;
    const top =
      `<div class="cp-top"><button data-cp="back" class="cp-b">${this.tool || this.pickingShop ? '✖ Annuler' : '← Retour'}</button>` +
      `<div class="cp-title"><b>Aéroport à plat</b><small>Essai · ${rooms.length} salles · bonus moyen ×${avg.toFixed(2)}</small></div>` +
      `<button data-cp="reset" class="cp-b ghost">↺</button></div>`;
    let panel = '';
    if (this.pickingShop) {
      const ids = [...new Set([...this.state.album, ...this.state.floors.map((f) => f.shop?.defId ?? '')])].filter(Boolean);
      const list = (ids.length ? ids : ['cafe', 'sandwich']).map((id) => SHOPS.find((s) => s.id === id)).filter((s) => !!s);
      panel = `<div class="cp-card"><b>Quelle salle poser ?</b><small>Vos magasins déjà découverts</small><div class="cp-shops">` +
        list.map((s) => `<button data-cp="shop" data-arg="${s.id}" class="cp-shop">${s.emoji}<span>${esc(s.name)}</span></button>`).join('') + '</div></div>';
    } else if (this.tool) {
      const p = this.tool.placing;
      const ok = canPlace(this.layout, p);
      const shop = shopOf(p);
      panel = `<div class="cp-card"><b>${BUILDINGS[p.kind].emoji} ${esc(shop?.name ?? BUILDINGS[p.kind].name)}</b>` +
        `<small>${ok ? 'Touchez le terrain pour poser. Glissez pour déplacer la vue.' : 'Pas de place ici : choisissez des cases libres.'}</small>` +
        `<div class="cp-row"><button data-cp="turn" class="cp-b">⟳ Tourner</button></div></div>`;
    } else if (this.selected) {
      const p = this.layout.items.find((o) => o.uid === this.selected)!;
      panel = this.infoCard(p, linked);
    } else {
      panel = `<div class="cp-hint">Touchez un bâtiment pour voir ses bonus, ou choisissez quoi construire.</div>`;
    }
    const bar = this.tool || this.pickingShop ? '' :
      `<div class="cp-bar">${PALETTE.map((k) => `<button data-cp="build" data-arg="${k}" class="cp-tool"><i>${BUILDINGS[k].emoji}</i><span>${BUILDINGS[k].name}</span></button>`).join('')}</div>`;
    ui.innerHTML = iconize(top + `<div class="cp-bottom">${panel}${bar}</div>`);
  }

  private infoCard(p: Placed, linked: Set<string>): string {
    const def = BUILDINGS[p.kind];
    const shop = shopOf(p);
    const actions =
      `<div class="cp-row"><button data-cp="move" class="cp-b">✥ Déplacer</button><button data-cp="turn" class="cp-b">⟳ Tourner</button>` +
      (p.kind !== 'terminal' ? `<button data-cp="remove" class="cp-b ghost">🗑 Retirer</button>` : '') + '</div>';
    if (p.kind === 'salle' && shop) {
      const b = roomBonus(this.layout, p.uid, linked);
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
      porte: linked.has(p.uid) ? 'Un avion embarque ici. Les salles proches vendent plus.' : 'Pas reliée : posez un couloir jusqu’au terminal.',
      piste: 'Plus tard, sa longueur décidera quels avions peuvent décoller.',
      tour: 'Plus tard, les vols qui partent près d’elle auront moins d’incidents.',
    };
    const aura = def.aura ? `Beauté +${def.beauty} pour les salles à ${def.aura} case(s) ou moins.` : '';
    return `<div class="cp-card"><b>${def.emoji} ${def.name}</b><small>${note[p.kind] ?? aura}</small>${actions}</div>`;
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
.cp-tool i { font-style: normal; font-size: 22px; line-height: 1; }
.cp-shops { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; max-height: 40vh; overflow-y: auto; margin-top: 4px; }
.cp-shop { min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border: 2px solid #2b2d42; border-radius: 12px; background: #fff; font: 700 12px var(--body, Nunito, sans-serif); color: #2b2d42; font-size: 20px; }
.cp-shop span { font-size: 12px; text-align: center; }
`;

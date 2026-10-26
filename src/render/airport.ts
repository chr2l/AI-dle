import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';
import { COUNTRIES } from '../core/data/countries';
import { PLANE_BY_ID, PLANE_MODELS, type PlaneModel } from '../core/data/planes';
import type { Element } from '../core/types';
import { buildPlaneModel } from './models/plane';
import { buildCarModel, buildCloudModel, buildSceneryModel, RUNWAY_CENTER_Z, SCENERY, skyColor } from './models/scenery';
import { pick, rng } from './palette';
import { meshFromGrid } from './tower';

/**
 * The living airport around the tower: themed scenery, parked planes, planes
 * taking off and landing (the player's flights plus ambient traffic), cars on
 * the road and drifting clouds. Call `sync` when the game state changes and
 * `tick` every frame.
 */

export type FlightKind = 'takeoff' | 'landing';

export interface FlightPose {
  x: number;
  y: number;
  /** Nose-up angle in radians. */
  pitch: number;
  done: boolean;
}

/** Seconds for each phase of a takeoff (landing plays the same path backwards). */
export const FLIGHT_TIMING = { roll: 4.5, climb: 7 } as const;
const RUNWAY_START = SCENERY.runway.x0 + 6;
const ROTATE_X = 20;
const CLIMB = { dx: 130, dy: 150 };

/**
 * Position of a plane `t` seconds into a takeoff or a landing. Takeoff:
 * accelerate along the runway, rotate, then climb away along +x. Landing
 * mirrors it: approach from the sky on the other side, touch down, brake.
 */
export function flightPose(kind: FlightKind, t: number): FlightPose {
  const total = FLIGHT_TIMING.roll + FLIGHT_TIMING.climb;
  if (kind === 'landing') {
    const p = flightPose('takeoff', total - t);
    // Mirror along x around the runway so the plane comes from the left and rolls to the right.
    const sinceTouch = t - FLIGHT_TIMING.climb;
    // A small bounce right after touchdown sells the weight of the plane.
    const bounce = sinceTouch > 0 && sinceTouch < 0.7 ? Math.abs(Math.sin(sinceTouch * 9)) * 0.9 * (1 - sinceTouch / 0.7) : 0;
    return { x: RUNWAY_START + ROTATE_X - p.x, y: p.y + bounce, pitch: p.pitch * 0.4, done: t >= total };
  }
  if (t < FLIGHT_TIMING.roll) {
    const k = t / FLIGHT_TIMING.roll;
    return { x: RUNWAY_START + (ROTATE_X - RUNWAY_START) * k * k, y: 0, pitch: 0, done: false };
  }
  const k = Math.min(1, (t - FLIGHT_TIMING.roll) / FLIGHT_TIMING.climb);
  // Speed at rotation keeps going; the climb steepens a little.
  return { x: ROTATE_X + CLIMB.dx * k, y: CLIMB.dy * k * k * 0.6 + CLIMB.dy * 0.4 * k, pitch: 0.12 + 0.18 * k, done: t >= total };
}

interface Flight {
  kind: FlightKind;
  start: number;
  node: Object3D;
  shadow: Mesh;
  /** Half the plane's length and wingspan, for wheels, engines and shadow. */
  half: { x: number; z: number };
  touchedDown?: boolean;
  liftedOff?: boolean;
  /** Player plane uid, or null for ambient traffic. */
  uid: string | null;
}

export interface AirportPlane {
  uid: string;
  modelId: string;
  flying: boolean;
  livery?: Element;
}

/** Wraps a plane mesh so it rotates around its middle, nose toward +x. */
function planeNode(model: PlaneModel, livery: Element): Object3D {
  const grid = buildPlaneModel(model, livery);
  const mesh = meshFromGrid(grid);
  mesh.position.set(-grid.width / 2, 0, -grid.depth / 2);
  const node = new Group();
  node.add(mesh);
  return node;
}

interface Particle {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
}

const PUFF = new BoxGeometry(1, 1, 1);
const PUFF_COLORS = {
  dust: new MeshBasicMaterial({ color: 0xd9c9a3 }),
  smoke: new MeshBasicMaterial({ color: 0xb8bcc6 }),
  trail: new MeshBasicMaterial({ color: 0xffffff }),
};
const SHADOW_GEOMETRY = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const LIGHT_ON = new MeshBasicMaterial({ color: 0xffe066 });
const LIGHT_OFF = new MeshBasicMaterial({ color: 0x8a6d1f });
const BIRD = new MeshBasicMaterial({ color: 0x2b2d42 });
const MAX_PARTICLES = 220;

function disposeTree(node: Object3D) {
  node.traverse((o) => (o as { geometry?: { dispose(): void } }).geometry?.dispose());
}

export class AirportScene {
  readonly group = new Group();
  private scenery?: Object3D;
  private theme: Element | null = null;
  private parked = new Map<string, Object3D>();
  private flights: Flight[] = [];
  private known = new Map<string, boolean>(); // uid → flying, as of the last sync
  private cars: { node: Object3D; speed: number; offset: number }[] = [];
  private clouds: { node: Object3D; speed: number; offset: number }[] = [];
  private nextAmbient = 0;
  private fleet: AirportPlane[] = [];
  private rand = rng(99);
  private particles: Particle[] = [];
  private lights: Mesh[] = [];
  private birds: { node: Group; wings: Mesh[]; offset: number }[] = [];
  private popIn = new Map<Object3D, number>(); // parked plane → time it appeared
  private lastTick = 0;

  constructor(
    /** Seconds between two ambient takeoffs / landings (random within the range). */
    readonly ambientEvery: [number, number] = [9, 18],
  ) {
    const roadX = (SCENERY.road.x0 + SCENERY.road.x1) / 2;
    const colors = [0xd7263d, 0x3fa7ff, 0xffd23f, 0xf4f4f0, 0x2ec4a6, 0x2b2d42];
    for (let i = 0; i < 5; i++) {
      const node = meshFromGrid(buildCarModel(colors[i % colors.length]));
      const southbound = i % 2 === 1;
      node.position.x = roadX + (southbound ? -2.5 : 0.5);
      if (southbound) {
        node.rotation.y = Math.PI;
        node.position.x += 3;
      }
      this.cars.push({ node, speed: (southbound ? -1 : 1) * (7 + i), offset: i * 23 });
      this.group.add(node);
    }
    // Approach lights before the runway threshold: a chasing flash toward the runway.
    for (let i = 0; i < 9; i++) {
      const light = new Mesh(PUFF, LIGHT_OFF);
      light.position.set(SCENERY.runway.x0 - 30 + i * 3.4, 0.5, RUNWAY_CENTER_Z);
      this.lights.push(light);
      this.group.add(light);
    }
    // A small flock of birds crossing the sky.
    for (let i = 0; i < 5; i++) {
      const node = new Group();
      const body = new Mesh(PUFF, BIRD);
      const wings = [-1, 1].map((side) => {
        const wing = new Mesh(PUFF, BIRD);
        wing.scale.set(0.6, 0.3, 1.4);
        wing.position.set(0, 0.2, side * 1);
        node.add(wing);
        return wing;
      });
      body.scale.set(1.2, 0.6, 0.6);
      node.add(body);
      this.birds.push({ node, wings, offset: i });
      this.group.add(node);
    }
    for (let i = 0; i < 4; i++) {
      const node = meshFromGrid(buildCloudModel(i + 1));
      node.position.set(0, 60 + i * 28, -20 + i * 18);
      this.clouds.push({ node, speed: 2 + i * 0.7, offset: i * 47 });
      this.group.add(node);
    }
  }

  /** Background color that suits the current theme. */
  get sky(): number {
    return skyColor(this.theme ?? 'neutre');
  }

  /** Rebuilds the scenery when the theme (featured country) changes. */
  setTheme(element: Element) {
    if (element === this.theme) return;
    this.theme = element;
    if (this.scenery) {
      disposeTree(this.scenery);
      this.group.remove(this.scenery);
    }
    this.scenery = meshFromGrid(buildSceneryModel(element));
    const { origin } = SCENERY;
    this.scenery.position.set(origin.x, origin.y, origin.z);
    this.group.add(this.scenery);
  }

  /**
   * Parks grounded planes on the apron and starts a takeoff (or landing) for
   * every plane whose flight status changed since the previous call.
   */
  sync(planes: AirportPlane[], nowMs: number) {
    const seen = new Set<string>();
    for (const p of planes) {
      seen.add(p.uid);
      const before = this.known.get(p.uid);
      this.known.set(p.uid, p.flying);
      const model = PLANE_BY_ID[p.modelId];
      if (!model) continue;
      if (before === false && p.flying) this.launch('takeoff', model, p.livery ?? 'neutre', nowMs, p.uid);
      if (before === true && !p.flying) this.launch('landing', model, p.livery ?? 'neutre', nowMs, p.uid);
    }
    for (const uid of [...this.known.keys()]) if (!seen.has(uid)) this.known.delete(uid);
    this.fleet = planes.map((p) => ({ ...p }));
    this.park();
  }

  private park() {
    const planes = this.fleet;
    // Parked = grounded and not currently landing.
    const landing = new Set(this.flights.filter((f) => f.kind === 'landing').map((f) => f.uid));
    const grounded = planes.filter((p) => !p.flying && !landing.has(p.uid) && PLANE_BY_ID[p.modelId]);
    for (const [uid, node] of this.parked)
      if (!grounded.some((p) => p.uid === uid)) {
        disposeTree(node);
        this.group.remove(node);
        this.parked.delete(uid);
        this.popIn.delete(node);
      }
    // One row along the apron, spaced by each plane's length.
    let x = SCENERY.apron.x0 + 2;
    grounded.forEach((p) => {
      const model = PLANE_BY_ID[p.modelId];
      const length = model.shape.length * 2 + 2;
      let node = this.parked.get(p.uid);
      if (!node) {
        node = planeNode(PLANE_BY_ID[p.modelId], p.livery ?? 'neutre');
        this.parked.set(p.uid, node);
        this.group.add(node);
        if (this.lastTick) this.popIn.set(node, this.lastTick);
      }
      node.position.set(x + length / 2, 0, (SCENERY.apron.z0 + SCENERY.apron.z1) / 2 + 1);
      x += length + 3;
      // Planes beyond the apron wait in the hangar (hidden).
      node.visible = x <= SCENERY.apron.x1;
    });
  }

  private launch(kind: FlightKind, model: PlaneModel, livery: Element, nowMs: number, uid: string | null) {
    const node = planeNode(model, livery);
    node.position.z = RUNWAY_CENTER_Z;
    const half = { x: model.shape.length + 1, z: model.shape.wingspan + 0.5 };
    const shadow = new Mesh(SHADOW_GEOMETRY, new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    this.group.add(node, shadow);
    this.flights.push({ kind, start: nowMs, node, uid, shadow, half });
    this.place(this.flights[this.flights.length - 1], nowMs);
  }

  private place(f: Flight, nowMs: number): boolean {
    const t = (nowMs - f.start) / 1000;
    const pose = flightPose(f.kind, t);
    f.node.position.set(pose.x, pose.y, RUNWAY_CENTER_Z);
    f.node.rotation.z = pose.pitch;
    // Shadow on the ground: shrinks and fades with altitude.
    const k = Math.max(0, 1 - pose.y / 90);
    f.shadow.visible = k > 0;
    f.shadow.position.set(pose.x + pose.y * 0.35, 0.05, RUNWAY_CENTER_Z + pose.y * 0.2);
    f.shadow.scale.set(f.half.x * 2 * (0.6 + 0.4 * k), 1, f.half.z * 1.2 * (0.6 + 0.4 * k));
    (f.shadow.material as MeshBasicMaterial).opacity = 0.28 * k;
    this.effects(f, t, pose);
    return pose.done;
  }

  /** Dust while rolling, a burst at liftoff / touchdown, contrails while climbing. */
  private effects(f: Flight, t: number, pose: FlightPose) {
    const tail = pose.x - f.half.x;
    const z = RUNWAY_CENTER_Z;
    const rolling = pose.y < 0.05;
    const speed = f.kind === 'takeoff' ? Math.min(1, t / FLIGHT_TIMING.roll) : Math.max(0, 1 - (t - FLIGHT_TIMING.climb) / FLIGHT_TIMING.roll);
    if (rolling && speed > 0.15 && this.rand() < speed) {
      for (const side of [-1, 1]) this.emit('dust', tail + 2, 0.4, z + side * 2, -3 - 6 * speed, 1.5, side * 1.5, 0.9, 1.3);
    }
    if (f.kind === 'takeoff' && !f.liftedOff && pose.y > 0.3) {
      f.liftedOff = true;
      this.burst('dust', pose.x - 2, z, 10);
    }
    if (f.kind === 'landing' && !f.touchedDown && t >= FLIGHT_TIMING.climb) {
      f.touchedDown = true;
      this.burst('smoke', pose.x - 2, z, 16);
    }
    if (pose.y > 4 && this.rand() < 0.6) {
      for (const side of [-1, 1]) this.emit('trail', tail, pose.y + 2, z + side * (f.half.z * 0.5), -2, 0, 0, 1.6, 0.7);
    }
  }

  private burst(kind: keyof typeof PUFF_COLORS, x: number, z: number, count: number) {
    for (let i = 0; i < count; i++) {
      const a = this.rand() * Math.PI * 2;
      const v = 3 + this.rand() * 5;
      this.emit(kind, x, 0.5, z, Math.cos(a) * v, 1 + this.rand() * 3, Math.sin(a) * v, 0.7 + this.rand() * 0.6, 1.2 + this.rand());
    }
  }

  private emit(kind: keyof typeof PUFF_COLORS, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number) {
    if (this.particles.length >= MAX_PARTICLES) return;
    const mesh = new Mesh(PUFF, PUFF_COLORS[kind]);
    mesh.position.set(x, y, z);
    mesh.rotation.y = this.rand() * Math.PI;
    this.group.add(mesh);
    this.particles.push({ mesh, vx, vy, vz, age: 0, life, size });
  }

  /** Advances every animation to `nowMs`. Returns true while something moves. */
  tick(nowMs: number): boolean {
    const t = nowMs / 1000;
    const dt = this.lastTick ? Math.min(0.1, (nowMs - this.lastTick) / 1000) : 0;
    this.lastTick = nowMs;

    // Puffs grow a little, then shrink away.
    this.particles = this.particles.filter((p) => {
      p.age += dt;
      if (p.age >= p.life) {
        this.group.remove(p.mesh);
        return false;
      }
      const k = p.age / p.life;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vx *= 0.96;
      p.vz *= 0.96;
      const s = p.size * (k < 0.2 ? 0.6 + 2 * k : 1 - (k - 0.2) / 0.8);
      p.mesh.scale.setScalar(Math.max(0.01, s));
      return true;
    });

    // Approach lights chase toward the runway.
    const lit = Math.floor(t * 9) % (this.lights.length + 3);
    this.lights.forEach((light, i) => {
      light.material = i === lit ? LIGHT_ON : LIGHT_OFF;
      light.scale.setScalar(i === lit ? 1.4 : 0.8);
    });

    // Birds glide across the sky in a V, flapping.
    const flockX = SCENERY.origin.x - 20 + ((t * 6) % (SCENERY.width + 60));
    for (const b of this.birds) {
      const row = Math.ceil(b.offset / 2);
      const side = b.offset % 2 ? 1 : -1;
      b.node.position.set(flockX - row * 3, 48 + Math.sin(t * 0.8 + b.offset) * 1.5, 10 + side * row * 3);
      const flap = Math.sin(t * 10 + b.offset * 1.3);
      b.wings.forEach((w) => (w.position.y = 0.2 + flap * 0.4));
    }

    // A plane that just parked pops in with a little squash and stretch.
    for (const [node, since] of this.popIn) {
      const k = (nowMs - since) / 450;
      if (k >= 1) {
        node.scale.setScalar(1);
        this.popIn.delete(node);
      } else node.scale.set(1 + 0.15 * Math.sin(k * Math.PI) , 1 - 0.12 * Math.sin(k * Math.PI), 1 + 0.15 * Math.sin(k * Math.PI));
    }

    const span = SCENERY.depth;
    for (const car of this.cars) {
      const along = (((car.offset + car.speed * t) % span) + span) % span;
      car.node.position.z = SCENERY.origin.z + along;
    }
    for (const cloud of this.clouds) {
      const span2 = SCENERY.width + 60;
      cloud.node.position.x = SCENERY.origin.x - 30 + ((cloud.offset + cloud.speed * t) % span2);
    }

    // Ambient traffic keeps the sky busy even when the player's fleet is parked.
    if (!this.nextAmbient) this.nextAmbient = nowMs + 2000;
    if (nowMs >= this.nextAmbient && this.flights.filter((f) => f.uid === null).length < 2) {
      const kind: FlightKind = this.rand() < 0.5 ? 'takeoff' : 'landing';
      this.launch(kind, pick(this.rand, PLANE_MODELS), pick(this.rand, COUNTRIES).id, nowMs, null);
      const [lo, hi] = this.ambientEvery;
      this.nextAmbient = nowMs + (lo + this.rand() * (hi - lo)) * 1000;
    }

    const finished = this.flights.filter((f) => this.place(f, nowMs));
    if (finished.length) {
      for (const f of finished) {
        disposeTree(f.node);
        (f.shadow.material as MeshBasicMaterial).dispose();
        this.group.remove(f.node, f.shadow);
      }
      this.flights = this.flights.filter((f) => !finished.includes(f));
      // A plane that just landed takes its slot on the apron.
      if (finished.some((f) => f.kind === 'landing' && f.uid)) this.park();
    }
    return true;
  }

  /** Planes currently animating (for tests and debugging). */
  get activeFlights(): { kind: FlightKind; uid: string | null }[] {
    return this.flights.map(({ kind, uid }) => ({ kind, uid }));
  }

  get parkedCount(): number {
    return this.parked.size;
  }
}

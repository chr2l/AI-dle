import { darken, lighten } from '../palette';
import { VoxelGrid } from '../voxel';

/**
 * VIPs are chunky "chibi" figures (big head, short body) so a few voxels are
 * enough to read the famous figure they wink at: hair, hat, face details,
 * outfit and one signature prop. The figure faces +z (the left side of the
 * iso view). Everything is a parody built from generic shapes.
 */

type Hair = 'short' | 'pompadour' | 'long' | 'curls' | 'bald' | 'afro' | 'slick' | 'bun' | 'none';
type Hat =
  | 'top' | 'toque' | 'cap' | 'capBack' | 'hood' | 'witch' | 'winged' | 'hardhat'
  | 'bucket' | 'headset' | 'horns' | 'keffiyeh' | 'helmet' | 'tiara';
type Face = 'mustache' | 'curlyMustache' | 'beard' | 'goatee' | 'sunglasses' | 'monocle' | 'goggles' | 'lipstick' | 'sideburns' | 'mole';
type Prop =
  | 'guitar' | 'mic' | 'phone' | 'board' | 'camera' | 'notebook' | 'whisk' | 'gamepad' | 'wrench'
  | 'quill' | 'balloon' | 'trident' | 'broom' | 'cigar' | 'parcel' | 'cane' | 'flag' | 'skates' | 'pill';

export interface VipLook {
  skin: number;
  hair: Hair;
  hairColor?: number;
  hat?: Hat;
  hatColor?: number;
  face?: Face[];
  top: number;
  bottom: number;
  /** Long dress or robe covering the legs. */
  dress?: boolean;
  /** Shoulder-to-ground cape or coat tails, behind the body. */
  cape?: number;
  /** Belt / trim color (jumpsuit studs, sash…). */
  trim?: number;
  /** Small flowers on the top. */
  flowers?: number;
  prop?: Prop;
  propColor?: number;
}

const SKIN = { pale: 0xffdbac, light: 0xf1c27d, tan: 0xe0ac69, brown: 0xc68642, dark: 0x8d5524, red: 0xd9473b };
const BLACK = 0x1e1e24;
const WHITE = 0xf4f4f0;
const GOLD = 0xf2c14e;
const PLATINUM = 0xf6eebf;
const FUR = 0xf4f4f0;

export const VIP_LOOKS: Record<string, VipLook> = {
  promoteur: { skin: SKIN.light, hair: 'short', hairColor: 0x6b4a2b, hat: 'hardhat', hatColor: GOLD, face: ['mustache'], top: 0x2f3a56, bottom: 0x2f3a56, trim: GOLD, prop: 'cigar' },
  livreur: { skin: SKIN.tan, hair: 'curls', hairColor: 0xd9a441, hat: 'winged', hatColor: 0xc0c0c8, top: 0xd7263d, bottom: 0x2b2d42, prop: 'parcel', propColor: 0xc89b5a },
  influenceuse: { skin: SKIN.pale, hair: 'long', hairColor: PLATINUM, face: ['sunglasses', 'lipstick'], top: 0xff6fb5, bottom: 0xff9ecf, prop: 'phone' },
  controleur: { skin: SKIN.pale, hair: 'short', hairColor: 0xc9a46b, hat: 'helmet', hatColor: WHITE, top: WHITE, bottom: WHITE, trim: 0xd7263d, prop: 'flag' },
  millionnaire: { skin: SKIN.pale, hair: 'short', hairColor: 0xe8e8e8, hat: 'top', hatColor: BLACK, face: ['monocle', 'curlyMustache'], top: BLACK, bottom: 0x3a3a46, trim: 0xd7263d, cape: BLACK, prop: 'cane', propColor: GOLD },
  rockeur: { skin: SKIN.light, hair: 'pompadour', hairColor: BLACK, face: ['sideburns'], top: WHITE, bottom: WHITE, trim: GOLD, prop: 'guitar', propColor: 0xb5651d },
  diva: { skin: SKIN.pale, hair: 'curls', hairColor: PLATINUM, face: ['lipstick', 'mole'], top: WHITE, bottom: WHITE, dress: true, prop: 'mic' },
  surfeuse: { skin: SKIN.tan, hair: 'long', hairColor: 0xf4d27a, top: 0x2ec4a6, bottom: 0xffcf5c, prop: 'board', propColor: 0xff7a59 },
  touriste: { skin: SKIN.pale, hair: 'short', hairColor: 0x8b5a2b, hat: 'bucket', hatColor: 0xf2e2c4, face: ['sunglasses'], top: 0x2ec4a6, bottom: 0xf2e2c4, flowers: 0xff6fb5, prop: 'camera' },
  critique: { skin: SKIN.pale, hair: 'bun', hairColor: 0x3b2a2a, face: ['monocle', 'lipstick'], top: 0x4b2e83, bottom: BLACK, trim: GOLD, prop: 'notebook' },
  patissier: { skin: SKIN.light, hair: 'short', hairColor: 0x2b2018, hat: 'toque', hatColor: WHITE, face: ['curlyMustache'], top: WHITE, bottom: 0x2b2d42, trim: 0x1d4ed8, prop: 'whisk' },
  hackeuse: { skin: SKIN.pale, hair: 'slick', hairColor: BLACK, face: ['sunglasses'], top: BLACK, bottom: BLACK, cape: BLACK, prop: 'pill', propColor: 0xd7263d },
  streamer: { skin: SKIN.light, hair: 'short', hairColor: 0x7c3aed, hat: 'capBack', hatColor: 0x3fa7ff, top: 0x1b1f5e, bottom: 0x2b2d42, trim: 0x7cffcb, prop: 'gamepad' },
  explorateur: { skin: SKIN.light, hair: 'none', hat: 'hood', hatColor: 0x8b5a2b, face: ['beard'], hairColor: 0x9c7a54, top: 0x8b5a2b, bottom: 0x5b3a1e, trim: 0xf4f4f0, prop: 'flag' },
  patineuse: { skin: SKIN.pale, hair: 'bun', hairColor: 0x6b4a2b, hat: 'tiara', hatColor: 0xc7f0ff, top: 0x4a7bd1, bottom: 0xa8e6ff, dress: true, trim: WHITE, prop: 'skates' },
  ferrailleur: { skin: SKIN.tan, hair: 'short', hairColor: 0x3b2a1a, face: ['goggles', 'beard'], top: 0x3b2a1a, bottom: 0x2b2018, trim: 0x8a8f98, prop: 'wrench' },
  nomade: { skin: SKIN.tan, hair: 'none', hat: 'keffiyeh', hatColor: WHITE, top: WHITE, bottom: WHITE, dress: true, trim: GOLD, prop: 'cane', propColor: 0x8b5a2b },
  poete: { skin: SKIN.pale, hair: 'short', hairColor: WHITE, face: ['beard'], top: 0x1e1b2e, bottom: 0x1e1b2e, trim: WHITE, prop: 'quill' },
  aeronaute: { skin: SKIN.pale, hair: 'short', hairColor: 0x8b5a2b, hat: 'top', hatColor: 0x5b3a1e, face: ['sideburns'], top: 0x2f4f4f, bottom: 0x8b8b7a, trim: GOLD, prop: 'balloon', propColor: 0xd7263d },
  demon: { skin: SKIN.red, hair: 'slick', hairColor: BLACK, hat: 'horns', hatColor: 0xb3263a, face: ['goatee'], top: 0xff7a59, bottom: 0xf2e2c4, flowers: 0xffd23f, prop: 'trident', propColor: BLACK },
  sorciere: { skin: SKIN.pale, hair: 'long', hairColor: 0x2e294e, hat: 'witch', hatColor: 0x2e1a47, top: 0x2e1a47, bottom: 0x2e1a47, dress: true, cape: 0x4b2e83, prop: 'broom', propColor: 0x8b5a2b },
};

/** Figure size in voxels (x: width, y: height, z: depth). */
export const VIP_SIZE = { width: 11, height: 21, depth: 7 } as const;

// Body layout, x offset so props fit on both sides.
const X = 3; // left edge of the head (head is 5 wide: X..X+4)
const Z = 1; // back of the head (head is 4 deep: Z..Z+3); the face is at Z+3
const HEAD_Y = 7; // head spans HEAD_Y..HEAD_Y+3

export function buildVipModel(id: string): VoxelGrid {
  const look = VIP_LOOKS[id];
  if (!look) throw new Error(`No look for VIP ${id}`);
  const g = new VoxelGrid(VIP_SIZE.width, VIP_SIZE.height, VIP_SIZE.depth);
  const face = new Set(look.face ?? []);
  const hairColor = look.hairColor ?? BLACK;
  const front = Z + 3;

  // Legs (or dress), torso, arms.
  if (look.dress) g.box(X, 0, Z + 1, X + 4, 3, Z + 2, look.bottom).box(X + 1, 4, Z + 1, X + 3, 4, Z + 2, look.bottom);
  else g.box(X + 1, 0, Z + 1, X + 1, 2, Z + 2, look.bottom).box(X + 3, 0, Z + 1, X + 3, 2, Z + 2, look.bottom);
  g.box(X + 1, 0, Z + 2, X + 1, 0, Z + 2, darken(look.bottom, 0.5)).box(X + 3, 0, Z + 2, X + 3, 0, Z + 2, darken(look.bottom, 0.5));
  g.box(X + 1, 3, Z + 1, X + 3, 6, Z + 2, look.top);
  g.box(X, 4, Z + 1, X, 6, Z + 2, look.top).box(X + 4, 4, Z + 1, X + 4, 6, Z + 2, look.top);
  g.set(X, 3, Z + 2, look.skin).set(X + 4, 3, Z + 2, look.skin); // hands
  if (look.trim !== undefined) g.box(X + 1, 3, Z + 2, X + 3, 3, Z + 2, look.trim).set(X + 2, 5, Z + 2, look.trim);
  if (look.flowers !== undefined) g.set(X + 1, 5, Z + 2, look.flowers).set(X + 3, 4, Z + 2, look.flowers).set(X + 2, 6, Z + 2, look.flowers);
  if (look.cape !== undefined) g.box(X, 1, Z, X + 4, 6, Z, look.cape);

  // Head with eyes.
  g.box(X, HEAD_Y, Z, X + 4, HEAD_Y + 3, front, look.skin);
  g.set(X + 1, HEAD_Y + 2, front, BLACK).set(X + 3, HEAD_Y + 2, front, BLACK);

  addHair(g, look.hair, hairColor);
  if (look.hat) addHat(g, look.hat, look.hatColor ?? BLACK);
  for (const f of face) addFace(g, f, hairColor);
  if (look.prop) addProp(g, look.prop, look.propColor);
  return g;
}

function addHair(g: VoxelGrid, hair: Hair, c: number): void {
  const top = HEAD_Y + 4;
  const front = Z + 3;
  switch (hair) {
    case 'short':
      g.box(X, top, Z, X + 4, top, front, c).box(X, HEAD_Y + 2, Z, X + 4, HEAD_Y + 3, Z, c);
      break;
    case 'pompadour': // tall quiff swept forward
      g.box(X, top, Z, X + 4, top, front, c).box(X, top + 1, Z + 1, X + 4, top + 1, front + 1, c).box(X + 1, top + 2, Z + 2, X + 3, top + 2, front + 1, c);
      g.box(X, HEAD_Y + 1, Z, X + 4, HEAD_Y + 3, Z, c);
      break;
    case 'long':
      g.box(X - 1, HEAD_Y - 1, Z - 1, X + 5, top, Z + 1, c).box(X, top, Z, X + 4, top, front, c).box(X - 1, HEAD_Y + 1, Z + 2, X - 1, top, front, c).box(X + 5, HEAD_Y + 1, Z + 2, X + 5, top, front, c);
      break;
    case 'curls': // short volume curls
      g.box(X - 1, HEAD_Y + 2, Z, X + 5, top, front - 1, c).box(X, top, Z, X + 4, top + 1, front, c).set(X - 1, top + 1, Z + 1, c).set(X + 5, top + 1, Z + 2, c);
      break;
    case 'afro':
      g.box(X - 1, HEAD_Y + 1, Z - 1, X + 5, top + 2, front - 1, c);
      break;
    case 'slick': // flat, with a widow's peak
      g.box(X, top, Z, X + 4, top, front, c).box(X, HEAD_Y + 2, Z, X + 4, HEAD_Y + 3, Z, c).set(X + 2, HEAD_Y + 3, front, c);
      break;
    case 'bun':
      g.box(X, top, Z, X + 4, top, front, c).box(X + 1, top + 1, Z, X + 3, top + 2, Z + 1, c).box(X, HEAD_Y + 2, Z, X + 4, HEAD_Y + 3, Z, c);
      break;
    case 'bald':
    case 'none':
      break;
  }
}

function addHat(g: VoxelGrid, hat: Hat, c: number): void {
  const top = HEAD_Y + 4;
  const front = Z + 3;
  switch (hat) {
    case 'top':
      g.box(X - 1, top, Z - 1, X + 5, top, front + 1, c).box(X, top + 1, Z, X + 4, top + 4, front, c).box(X, top + 1, Z, X + 4, top + 1, front, 0xd7263d);
      break;
    case 'toque':
      g.box(X, top, Z, X + 4, top + 1, front, c).box(X - 1, top + 2, Z - 1, X + 5, top + 4, front + 1, c);
      break;
    case 'cap':
      g.box(X, top, Z, X + 4, top + 1, front, c).box(X, top, front + 1, X + 4, top, front + 2, darken(c, 0.2));
      break;
    case 'capBack':
      g.box(X, top, Z, X + 4, top + 1, front, c).box(X + 1, top, Z - 1, X + 3, top, Z - 1, darken(c, 0.2));
      break;
    case 'hood': // parka hood with a fur rim framing the face
      g.box(X - 1, HEAD_Y - 1, Z - 1, X + 5, top + 1, front - 1, c);
      g.box(X - 1, top, front, X + 5, top + 1, front, FUR).box(X - 1, HEAD_Y - 1, front, X + 5, HEAD_Y - 1, front, FUR);
      g.box(X - 1, HEAD_Y, front, X - 1, top - 1, front, FUR).box(X + 5, HEAD_Y, front, X + 5, top - 1, front, FUR);
      break;
    case 'witch':
      g.box(X - 2, top, Z - 1, X + 6, top, front + 2, c).box(X, top + 1, Z, X + 4, top + 2, front, c).box(X + 1, top + 3, Z + 1, X + 3, top + 4, front - 1, c).box(X + 2, top + 5, Z + 1, X + 2, top + 6, Z + 1, c);
      g.box(X, top + 1, Z, X + 4, top + 1, front, 0x7c3aed);
      break;
    case 'winged':
      g.box(X, top, Z, X + 4, top, front, c).box(X - 1, top, Z + 1, X - 1, top + 1, Z + 2, WHITE).box(X + 5, top, Z + 1, X + 5, top + 1, Z + 2, WHITE).set(X - 1, top + 2, Z + 1, WHITE).set(X + 5, top + 2, Z + 1, WHITE);
      break;
    case 'hardhat':
      g.box(X - 1, top, Z - 1, X + 5, top, front + 1, c).box(X, top + 1, Z, X + 4, top + 1, front, c).box(X + 1, top + 2, Z + 1, X + 3, top + 2, front - 1, c);
      break;
    case 'bucket':
      g.box(X - 1, top, Z - 1, X + 5, top, front + 1, c).box(X, top + 1, Z, X + 4, top + 2, front, lighten(c, 0.1));
      break;
    case 'headset':
      g.box(X - 1, HEAD_Y + 1, Z + 1, X - 1, HEAD_Y + 2, Z + 2, c).box(X + 5, HEAD_Y + 1, Z + 1, X + 5, HEAD_Y + 2, Z + 2, c).box(X - 1, top, Z + 1, X + 5, top, Z + 2, c);
      break;
    case 'horns':
      g.set(X, top, Z + 2, c).set(X - 1, top + 1, Z + 2, c).set(X - 1, top + 2, Z + 2, c);
      g.set(X + 4, top, Z + 2, c).set(X + 5, top + 1, Z + 2, c).set(X + 5, top + 2, Z + 2, c);
      break;
    case 'keffiyeh':
      g.box(X - 1, HEAD_Y - 2, Z - 1, X + 5, top, front - 1, c).box(X - 1, top, Z - 1, X + 5, top, front, c).box(X - 1, top + 1, Z, X + 5, top + 1, front - 1, BLACK);
      break;
    case 'helmet': // space helmet: round shell, dark visor
      g.box(X - 1, HEAD_Y - 1, Z - 1, X + 5, top + 1, front, c).box(X, HEAD_Y, front + 1, X + 4, HEAD_Y + 3, front + 1, 0x1d2b44).box(X + 1, HEAD_Y + 3, front + 1, X + 1, HEAD_Y + 3, front + 1, 0x7fb7e6);
      break;
    case 'tiara':
      g.box(X + 1, top, Z + 2, X + 3, top, Z + 2, c).set(X + 2, top + 1, Z + 2, c);
      break;
  }
}

function addFace(g: VoxelGrid, f: Face, hairColor: number): void {
  const f0 = Z + 3;
  const y = HEAD_Y;
  switch (f) {
    case 'mustache':
      g.box(X + 1, y + 1, f0, X + 3, y + 1, f0, hairColor);
      break;
    case 'curlyMustache':
      g.box(X + 1, y + 1, f0, X + 3, y + 1, f0, hairColor).set(X, y + 2, f0, hairColor).set(X + 4, y + 2, f0, hairColor);
      break;
    case 'beard':
      g.box(X, y - 1, f0, X + 4, y + 1, f0, hairColor).box(X + 1, y - 2, f0, X + 3, y - 2, f0, hairColor).box(X, y, Z, X, y + 2, f0, hairColor).box(X + 4, y, Z, X + 4, y + 2, f0, hairColor);
      break;
    case 'goatee':
      g.box(X + 2, y - 1, f0, X + 2, y, f0, hairColor).box(X + 1, y + 1, f0, X + 3, y + 1, f0, hairColor);
      break;
    case 'sunglasses':
      g.box(X + 1, y + 2, f0, X + 3, y + 2, f0, BLACK).box(X, y + 2, f0 - 1, X, y + 2, f0, BLACK).box(X + 4, y + 2, f0 - 1, X + 4, y + 2, f0, BLACK);
      break;
    case 'monocle':
      g.set(X + 4, y + 2, f0, GOLD).set(X + 4, y + 1, f0, GOLD).set(X + 4, y, f0 - 1, GOLD); // gold rim by the eye, chain down the side
      break;
    case 'goggles':
      g.box(X, y + 2, f0, X + 4, y + 2, f0, 0x8a8f98).set(X + 1, y + 2, f0, 0xf2c14e).set(X + 3, y + 2, f0, 0xf2c14e).box(X - 1, y + 2, Z, X - 1, y + 2, f0, 0x3b2a1a).box(X + 5, y + 2, Z, X + 5, y + 2, f0, 0x3b2a1a);
      break;
    case 'lipstick':
      g.set(X + 2, y + 1, f0, 0xd7263d);
      break;
    case 'sideburns': // on the sides of the head, never on the face
      g.box(X, y, f0 - 2, X, y + 2, f0 - 1, hairColor).box(X + 4, y, f0 - 2, X + 4, y + 2, f0 - 1, hairColor);
      break;
    case 'mole':
      g.set(X + 3, y + 1, f0, 0x3b2a1a);
      break;
  }
}

function addProp(g: VoxelGrid, prop: Prop, color?: number): void {
  const hx = X + 5; // right-hand side
  const hz = Z + 3;
  const c = color ?? 0x555a66;
  switch (prop) {
    case 'guitar': // held on the right side, neck pointing up
      g.box(hx, 1, hz - 2, hx + 1, 3, hz - 1, c).set(hx + 1, 2, hz - 1, BLACK).box(hx, 4, hz - 2, hx, 8, hz - 2, 0x5b3a1e).set(hx, 9, hz - 2, BLACK);
      break;
    case 'mic':
      g.box(hx, 4, hz - 1, hx, 6, hz - 1, 0x8a8f98).set(hx, 7, hz - 1, BLACK);
      break;
    case 'phone': // selfie stick
      g.box(hx, 4, hz - 1, hx, 9, hz - 1, 0x8a8f98).box(hx, 10, hz - 1, hx, 11, hz - 1, BLACK).set(hx, 10, hz - 2, 0x7fb7e6);
      break;
    case 'board':
      g.box(X - 2, 0, Z, X - 2, 12, Z + 1, c).box(X - 2, 1, Z + 2, X - 2, 11, Z + 2, c).box(X - 2, 2, Z + 1, X - 2, 10, Z + 1, WHITE);
      break;
    case 'camera':
      g.box(X + 1, 4, hz, X + 3, 5, hz, BLACK).set(X + 2, 5, hz + 1, 0x7fb7e6);
      break;
    case 'notebook':
      g.box(hx, 4, hz - 2, hx, 6, hz - 1, 0xf4f4f0).set(hx, 6, hz - 1, GOLD);
      break;
    case 'whisk':
      g.box(hx, 4, hz - 1, hx, 5, hz - 1, 0x5b3a1e).box(hx, 6, hz - 1, hx, 8, hz - 1, 0xc0c0c8);
      break;
    case 'gamepad':
      g.box(X + 1, 4, hz, X + 3, 4, hz, 0x2b2d42).set(X + 1, 5, hz, 0x2b2d42).set(X + 3, 5, hz, 0xd7263d);
      break;
    case 'wrench':
      g.box(hx, 3, hz - 1, hx, 7, hz - 1, 0x8a8f98).set(hx, 8, hz - 2, 0x8a8f98).set(hx, 8, hz, 0x8a8f98);
      break;
    case 'quill':
      g.box(hx, 4, hz - 1, hx, 5, hz - 1, 0xc89b5a).box(hx, 6, hz - 1, hx, 8, hz - 1, WHITE).set(hx, 9, hz - 2, WHITE);
      break;
    case 'balloon':
      g.box(hx, 4, hz - 1, hx, 15, hz - 1, 0xe0e0e0).box(hx - 1, 16, hz - 2, hx + 1, 18, hz, c).set(hx, 19, hz - 1, c).set(hx, 15, hz - 1, darken(c, 0.3));
      break;
    case 'trident':
      g.box(hx, 0, hz - 1, hx, 10, hz - 1, c).set(hx - 1, 11, hz - 1, c).set(hx, 11, hz - 1, c).set(hx + 1, 11, hz - 1, c).set(hx - 1, 12, hz - 1, c).set(hx + 1, 12, hz - 1, c).set(hx, 12, hz - 1, c);
      break;
    case 'broom':
      g.box(hx, 2, hz - 1, hx, 10, hz - 1, c).box(hx, 0, hz - 2, hx, 1, hz, 0xd9a441);
      break;
    case 'cigar':
      g.box(X + 3, HEAD_Y + 1, hz + 1, X + 3, HEAD_Y + 1, hz + 2, 0x6b3e1f).set(X + 3, HEAD_Y + 1, hz + 3, 0xff5a1f);
      break;
    case 'parcel':
      g.box(X, 4, hz, X + 4, 6, hz + 1, c).box(X + 2, 4, hz + 1, X + 2, 6, hz + 1, darken(c, 0.35));
      break;
    case 'cane':
      g.box(hx, 0, hz - 1, hx, 5, hz - 1, c).set(hx, 6, hz, c);
      break;
    case 'flag':
      g.box(hx, 0, hz - 1, hx, 10, hz - 1, 0x8a8f98).box(hx, 8, hz, hx, 10, hz + 2, c === 0x555a66 ? 0xd7263d : c);
      break;
    case 'skates':
      g.box(X + 1, 0, Z + 3, X + 1, 0, Z + 3, 0xc0c0c8).box(X + 3, 0, Z + 3, X + 3, 0, Z + 3, 0xc0c0c8);
      break;
    case 'pill':
      g.set(X + 4, 3, hz, c).set(X, 3, hz, 0x3fa7ff);
      break;
  }
}

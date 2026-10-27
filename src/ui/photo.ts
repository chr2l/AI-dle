// Photo of the player's airport (plan de polish IP-23): the cube art view in
// a frame with the airport's name and level, shared through the phone's
// share sheet (free word of mouth). On the web, the image is downloaded.
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface PhotoCaption {
  name: string;
  level: number;
  floors: number;
}

const W = 1080;
const H = 1350;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = ko;
    img.src = src;
  });

/** Framed 1080×1350 PNG (portrait, the size social apps show in full). */
export async function framePhoto(view: string, caption: PhotoCaption): Promise<string> {
  const img = await loadImage(view);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1b1f3b';
  g.fillRect(0, 0, W, H);
  // Cover the photo area with the view, cropped to the middle.
  const area = { x: 40, y: 40, w: W - 80, h: H - 260 };
  const scale = Math.max(area.w / img.width, area.h / img.height);
  const sw = area.w / scale;
  const sh = area.h / scale;
  g.save();
  g.beginPath();
  g.roundRect(area.x, area.y, area.w, area.h, 36);
  g.clip();
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, area.x, area.y, area.w, area.h);
  g.restore();
  g.strokeStyle = '#ffd23f';
  g.lineWidth = 8;
  g.beginPath();
  g.roundRect(area.x, area.y, area.w, area.h, 36);
  g.stroke();
  g.fillStyle = '#ffd23f';
  g.font = '64px "Lilita One", "Nunito", sans-serif';
  g.textBaseline = 'alphabetic';
  g.fillText(caption.name, 48, H - 130);
  g.fillStyle = '#f6f4ff';
  g.font = '700 40px "Nunito", sans-serif';
  g.fillText(`Niveau ${caption.level} · ${caption.floors} étage${caption.floors > 1 ? 's' : ''}`, 48, H - 70);
  g.textAlign = 'right';
  g.fillStyle = '#c3c0ea';
  g.font = '56px "Lilita One", "Nunito", sans-serif';
  g.fillText('✈ IdlePort', W - 48, H - 90);
  return c.toDataURL('image/png');
}

/** Opens the share sheet with the photo. Returns false when the player cancelled or nothing could share. */
export async function sharePhoto(png: string): Promise<boolean> {
  const text = 'Mon aéroport sur IdlePort ✈️';
  try {
    if (Capacitor.isNativePlatform()) {
      const file = await Filesystem.writeFile({ path: `idleport-${Date.now()}.png`, data: png.split(',')[1], directory: Directory.Cache });
      await Share.share({ title: 'IdlePort', text, files: [file.uri], dialogTitle: 'Partager mon aéroport' });
      return true;
    }
    const blob = await (await fetch(png)).blob();
    const file = new File([blob], 'idleport.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return true;
    }
    const a = document.createElement('a');
    a.href = png;
    a.download = 'idleport.png';
    a.click();
    return true;
  } catch {
    return false;
  }
}

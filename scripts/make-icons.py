"""Builds the app icons from two renders of preview.html?scene=icon.

Usage: python3 scripts/make-icons.py black.png white.png
(renders on bg=000000 and bg=ffffff; their difference gives the alpha).
Writes resources/icon*.png, the Android res/ overrides and public/ icons.
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

black, white = (Image.open(p).convert('RGB') for p in sys.argv[1:3])
diff = ImageChops.subtract(white, black)
alpha = ImageChops.invert(diff.convert('L'))
art = Image.new('RGBA', black.size)
# Un-premultiply: color = black / alpha.
bp, ap = black.load(), alpha.load()
ip = art.load()
for y in range(black.size[1]):
    for x in range(black.size[0]):
        a = ap[x, y]
        if a:
            r, g, b = bp[x, y]
            ip[x, y] = (min(255, r * 255 // a), min(255, g * 255 // a), min(255, b * 255 // a), a)
art = art.crop(art.getbbox())

S = 1024


def background(size):
    """Sky gradient with a soft sun glow."""
    top, bottom = (120, 214, 255), (48, 128, 230)
    bg = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(bg)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    glow = Image.new('L', (size, size), 0)
    ImageDraw.Draw(glow).ellipse([size * 0.1, size * 0.02, size * 0.75, size * 0.62], fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.12))
    return Image.composite(Image.new('RGB', (size, size), (255, 255, 255)), bg, glow).convert('RGBA')


def place(canvas, fraction, dy=0.0):
    """Pastes the art centered, its longest side = fraction of the canvas."""
    size = canvas.size[0]
    k = fraction * size / max(art.size)
    a = art.resize((round(art.size[0] * k), round(art.size[1] * k)), Image.LANCZOS)
    x, y = (size - a.size[0]) // 2, round((size - a.size[1]) / 2 + dy * size)
    # Soft drop shadow, drawn on the whole canvas so the blur is never cut.
    mask = Image.new('L', canvas.size, 0)
    mask.paste(a.getchannel('A').point(lambda v: v * 0.35), (x + round(size * 0.012), y + round(size * 0.02)))
    shadow = Image.new('RGBA', canvas.size, (10, 30, 80, 0))
    shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(size * 0.012)))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(a, (x, y))
    return canvas


def rounded(img, radius):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius, fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


full = place(background(S), 0.84)
# Round masks cut the corners of the art: shrink it to fit the circle.
round_full = place(background(S), 0.68)
os.makedirs('resources', exist_ok=True)
full.convert('RGB').save('resources/icon.png')
place(Image.new('RGBA', (S, S)), 0.5).save('resources/icon-foreground.png')
background(S).convert('RGB').save('resources/icon-background.png')

# Android: legacy square/round icons and adaptive layers (108 dp canvas).
densities = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
res = 'resources/android/res'
fg = Image.open('resources/icon-foreground.png')
bgimg = Image.open('resources/icon-background.png')
for name, k in densities.items():
    d = f'{res}/mipmap-{name}'
    os.makedirs(d, exist_ok=True)
    n = round(48 * k)
    small = full.resize((n, n), Image.LANCZOS)
    rounded(small, n * 0.18).save(f'{d}/ic_launcher.png')
    circle = Image.new('L', (n * 4, n * 4), 0)
    ImageDraw.Draw(circle).ellipse([0, 0, n * 4 - 1, n * 4 - 1], fill=255)
    r = round_full.resize((n, n), Image.LANCZOS)
    r.putalpha(circle.resize((n, n), Image.LANCZOS))
    r.save(f'{d}/ic_launcher_round.png')
    m = round(108 * k)
    fg.resize((m, m), Image.LANCZOS).save(f'{d}/ic_launcher_foreground.png')
    bgimg.resize((m, m), Image.LANCZOS).save(f'{d}/ic_launcher_background.png')

os.makedirs('public', exist_ok=True)
for n in (192, 512):
    full.resize((n, n), Image.LANCZOS).convert('RGB').save(f'public/icon-{n}.png')
rounded(full.resize((64, 64), Image.LANCZOS), 12).save('public/favicon.png')

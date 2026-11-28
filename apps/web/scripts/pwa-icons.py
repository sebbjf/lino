# Render the PWA icons from favicon.svg's four circles (viewBox 32, circles span 3..29) on the light board background.
# Run from the repo root after changing the logo (needs Pillow): python apps/web/scripts/pwa-icons.py apps/web/public
import sys
from pathlib import Path
from PIL import Image, ImageDraw

BG = '#fafafa'  # oklch(0.985 0 0), --background in index.css
CIRCLES = [(11, 11, '#e8d5c4'), (21, 11, '#c97b5a'), (11, 21, '#6f8a6b'), (21, 21, '#2f3a4a')]  # r = 8, drawn in SVG order
SS = 4  # supersampling for smooth edges


def render(size: int, frac: float) -> Image.Image:
    big = size * SS
    img = Image.new('RGB', (big, big), BG)
    d = ImageDraw.Draw(img)
    s = frac * big / 26  # the circles' 26-unit box fills `frac` of the icon
    t = big / 2 - 16 * s
    for cx, cy, fill in CIRCLES:
        x, y, r = t + cx * s, t + cy * s, 8 * s
        d.ellipse((x - r, y - r, x + r, y + r), fill=fill)
    return img.resize((size, size), Image.LANCZOS)


out = Path(sys.argv[1])
for name, size, frac in [('pwa-192.png', 192, 0.8), ('pwa-512.png', 512, 0.8), ('pwa-maskable-512.png', 512, 0.6)]:
    render(size, frac).save(out / name, optimize=True)
    print(name, (out / name).stat().st_size, 'bytes')

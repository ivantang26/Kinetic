"""Generate outlined SVG wordmarks + favicon from Roboto Flex.

Outlines mean the logo files render identically everywhere, with no font.
Run with a Python that has `fonttools`:  python scripts/build-press-assets.py
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "node_modules/@fontsource-variable/roboto-flex/files/roboto-flex-latin-full-normal.woff2"
OUT = ROOT / "public"
(OUT / "press").mkdir(parents=True, exist_ok=True)

base = TTFont(SRC)


def instance(wght, wdth):
    f = instancer.instantiateVariableFont(TTFont(SRC), {"wght": wght, "wdth": wdth}, inplace=False)
    return f


def run_path(font, text, x0=0.0, tracking=0):
    """Return (svg path d, advance end x) for text set at 1 unit = 1 font unit."""
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    pen = SVGPathPen(gs)
    x = x0
    for ch in text:
        name = cmap[ord(ch)]
        # Flip y (font units are y-up) and move to x.
        gs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        x += hmtx[name][0] + tracking
    return pen.getCommands(), x


def bounds(font, text, x0=0.0):
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    bp = BoundsPen(gs)
    x = x0
    for ch in text:
        name = cmap[ord(ch)]
        gs[name].draw(TransformPen(bp, (1, 0, 0, -1, x, 0)))
        x += hmtx[name][0]
    return bp.bounds


heavy = instance(900, 120)
light = instance(300, 120)
upm = heavy["head"].unitsPerEm

d1, x = run_path(heavy, "PULSE", tracking=-10)
gap = upm * 0.12
d2, x_end = run_path(light, "27", x0=x + gap)
b1 = bounds(heavy, "PULSE")
b2 = bounds(light, "27", x0=x + gap)
xmin, ymin = min(b1[0], b2[0]), min(b1[1], b2[1])
xmax, ymax = max(b1[2], b2[2]), max(b1[3], b2[3])
pad = upm * 0.04
vb = f"{xmin - pad:.0f} {ymin - pad:.0f} {xmax - xmin + 2 * pad:.0f} {ymax - ymin + 2 * pad:.0f}"

for name, colour in {"acid": "#D4FF3A", "black": "#0A0A0A", "white": "#F7F7F2"}.items():
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="PULSE 27">'
        f'<path fill="{colour}" d="{d1}"/><path fill="{colour}" d="{d2}"/></svg>\n'
    )
    (OUT / "press" / f"pulse27-wordmark-{name}.svg").write_text(svg, encoding="utf-8")

# Favicon / app icon: heavy "P" on acid, square.
dp, adv = run_path(heavy, "P")
bp = bounds(heavy, "P")
w, h = bp[2] - bp[0], bp[3] - bp[1]
size = max(w, h) * 1.5
cx, cy = bp[0] + w / 2, bp[1] + h / 2
vb_icon = f"{cx - size / 2:.0f} {cy - size / 2:.0f} {size:.0f} {size:.0f}"
icon = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb_icon}">'
    f'<rect x="{cx - size / 2:.0f}" y="{cy - size / 2:.0f}" width="{size:.0f}" height="{size:.0f}" fill="#D4FF3A"/>'
    f'<path fill="#0A0A0A" d="{dp}"/></svg>\n'
)
(OUT / "favicon.svg").write_text(icon, encoding="utf-8")
(OUT / "icon.svg").write_text(icon, encoding="utf-8")
print("wrote press wordmarks + favicon")

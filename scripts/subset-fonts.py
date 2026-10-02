"""Build the self-hosted font files for PULSE 27.

Roboto Flex ships with 13 axes. We only animate weight and width, so every
other axis is pinned to its default and the remaining two are clamped to the
ranges the kinetic type system actually uses (wght 100-900, wdth 50-150).
Glyphs are subset to Basic Latin + a few festival punctuation marks.

Run with a Python that has `fonttools` and `brotli` installed:
    python scripts/subset-fonts.py
"""
from io import BytesIO
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "node_modules/@fontsource-variable/roboto-flex/files/roboto-flex-latin-full-normal.woff2"
OUT = ROOT / "public/fonts/pulse-flex.woff2"

# Basic Latin, Latin-1 punctuation, en/em dash, curly quotes, middle dot, pound, arrows
UNICODES = "U+0020-007E,U+00A0,U+00A3,U+00B7,U+00D7,U+00E9,U+00F3,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+2190-2193,U+2197,U+2605,U+2606"

font = TTFont(SRC)
axes = {a.axisTag: (a.minValue, a.defaultValue, a.maxValue) for a in font["fvar"].axes}
limits = {}
for tag, (lo, default, hi) in axes.items():
    if tag == "wght":
        limits[tag] = (100, 400, 900)
    elif tag == "wdth":
        limits[tag] = (max(lo, 50), 100, min(hi, 150))
    else:
        limits[tag] = None  # pin to default -> drop axis
font = instancer.instantiateVariableFont(font, limits)
# Round-trip so the subsetter sees fully materialised tables.
buf = BytesIO()
font.flavor = None
font.save(buf)
buf.seek(0)
font = TTFont(buf)

opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = ["kern", "liga", "calt", "tnum", "case"]
opts.name_IDs = ["*"]
opts.notdef_outline = True
opts.hinting = False
sub = subset.Subsetter(options=opts)
sub.populate(unicodes=subset.parse_unicodes(UNICODES))
sub.subset(font)
font.flavor = "woff2"
font.save(OUT)
print(f"{OUT.name}: {OUT.stat().st_size / 1024:.1f} KB, axes={[a.axisTag for a in font['fvar'].axes]}")

#!/usr/bin/env python3
"""Render the site icon: the page's seal mark (篆 in the Chong Xi font).

Draws a cinnabar square with a pale inner frame and the seal glyph, tilted
slightly like the mark in the page header, and writes PNG icons to public/.
The font is only used to render the glyph (as the PNG export does); it is not
modified or embedded.

Requires Pillow.
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_FONT = ROOT / "public" / "fonts" / "chongxi.otf"

CINNABAR = (168, 53, 43, 255)  # --accent
PAPER = (251, 243, 236, 255)
FRAME = (251, 243, 236, 217)  # 85% opacity, as in the header mark
SIZES = {"favicon.png": 64, "apple-touch-icon.png": 180}


def render(font_path: Path, size: int) -> Image.Image:
    scale = 8  # draw large, then downsample for smooth edges
    big = size * scale
    mark = int(big * 0.84)
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))

    tile = Image.new("RGBA", (mark, mark), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tile)
    radius = int(mark * 0.08)
    draw.rounded_rectangle((0, 0, mark - 1, mark - 1), radius=radius, fill=CINNABAR)
    inset = int(mark * 0.07)
    draw.rounded_rectangle((inset, inset, mark - 1 - inset, mark - 1 - inset),
                           radius=max(radius // 2, 1), outline=FRAME, width=max(int(mark * 0.035), 1))

    font = ImageFont.truetype(str(font_path), int(mark * 0.66))
    box = draw.textbbox((0, 0), "篆", font=font)
    x = (mark - (box[2] - box[0])) / 2 - box[0]
    y = (mark - (box[3] - box[1])) / 2 - box[1]
    draw.text((x, y), "篆", font=font, fill=PAPER)

    tile = tile.rotate(3, resample=Image.Resampling.BICUBIC, expand=True)
    canvas.alpha_composite(tile, ((big - tile.width) // 2, (big - tile.height) // 2))
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--font", type=Path, default=DEFAULT_FONT)
    parser.add_argument("--out", type=Path, default=ROOT / "public")
    args = parser.parse_args()
    for name, size in SIZES.items():
        render(args.font, size).save(args.out / name)
        print(f"{name}: {size}x{size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

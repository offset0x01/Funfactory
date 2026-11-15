#!/usr/bin/env python3
"""Make the three Home Screen icons for a game: a colored tile with one or two big letters.

  python3 templates/make_icons.py games/<name> LL                      # default colors
  python3 templates/make_icons.py games/<name> LL "#0b0820" "#ff8a3d"   # background, letters

Writes icon-192.png, icon-512.png and apple-touch-icon.png (180 px) into the folder.
Swap in real art later if the game has some; keep the same file names and sizes.
"""
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont


def make(size: int, text: str, bg: str, fg: str) -> Image.Image:
    img = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(img)
    pad = size // 10
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=size // 6, outline=fg, width=max(2, size // 40))
    try:
        font = ImageFont.load_default(size=int(size * (0.5 if len(text) == 1 else 0.36)))
    except TypeError:  # older Pillow: tiny built-in font only
        font = ImageFont.load_default()
    box = d.textbbox((0, 0), text, font=font)
    d.text(((size - box[2] - box[0]) / 2, (size - box[3] - box[1]) / 2), text, font=font, fill=fg)
    return img


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    folder, text = pathlib.Path(sys.argv[1]), sys.argv[2][:2].upper()
    bg, fg = (sys.argv[3:5] + ["#0b0820", "#ff8a3d"][len(sys.argv[3:5]):])
    for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
        make(size, text, bg, fg).save(folder / name)
        print("wrote", folder / name)

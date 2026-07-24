#!/usr/bin/env python3
"""Generate the Budget App launcher icons (gradient squircles).

Builds two icons under <base_dir>:
  launch.iconset  — green squircle with a bold white £  (Budget App)
  stop.iconset    — red squircle with a white stop square (Stop Budget App)
plus a 1024px master PNG for each, saved next to this script.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT_DIR, "build")

SIZE = 1024
MARGIN = 100          # macOS-style transparent margin
RADIUS = 190

GREEN = ((52, 211, 153), (4, 120, 87))    # emerald -> deep green
RED = ((248, 113, 113), (153, 27, 27))    # soft red -> deep red


def load_font(px):
    for path in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/SFNSRounded.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, px)
            except Exception:
                continue
    return ImageFont.load_default()


def vertical_gradient(w, h, top, bottom):
    grad = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        grad.putpixel((0, y), tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return grad.resize((w, h))


def squircle(top, bottom):
    """Gradient rounded-square with a soft top highlight."""
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    box = (MARGIN, MARGIN, SIZE - MARGIN, SIZE - MARGIN)
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=RADIUS, fill=255)

    img.paste(vertical_gradient(SIZE, SIZE, top, bottom).convert("RGBA"), (0, 0), mask)

    hi = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(hi).rounded_rectangle(
        (MARGIN, MARGIN, SIZE - MARGIN, SIZE // 2), radius=RADIUS, fill=38
    )
    hi = Image.composite(hi, Image.new("L", (SIZE, SIZE), 0), mask)
    white = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
    return Image.alpha_composite(img, Image.merge("RGBA", (*white.split()[:3], hi)))


def launch_icon():
    img = squircle(*GREEN)
    draw = ImageDraw.Draw(img)
    font = load_font(600)
    l, t, r, b = draw.textbbox((0, 0), "£", font=font)
    gx, gy = (SIZE - (r - l)) / 2 - l, (SIZE - (b - t)) / 2 - t
    draw.text((gx + 8, gy + 10), "£", font=font, fill=(0, 60, 40, 90))
    draw.text((gx, gy), "£", font=font, fill=(255, 255, 255, 255))
    return img


def stop_icon():
    img = squircle(*RED)
    draw = ImageDraw.Draw(img)
    s = 300  # half-side of the stop square
    c = SIZE // 2
    draw.rounded_rectangle((c - s, c - s, c + s, c + s), radius=70, fill=(255, 255, 255, 255))
    return img


def emit(master, iconset):
    os.makedirs(iconset, exist_ok=True)
    for px, name in [
        (16, "icon_16x16.png"), (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"), (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"), (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"), (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"), (1024, "icon_512x512@2x.png"),
    ]:
        master.resize((px, px), Image.LANCZOS).save(os.path.join(iconset, name))


def main():
    launch = launch_icon()
    launch.save(os.path.join(OUT_DIR, "budget-app-1024.png"))
    emit(launch, os.path.join(BASE, "launch.iconset"))

    stop = stop_icon()
    stop.save(os.path.join(OUT_DIR, "stop-1024.png"))
    emit(stop, os.path.join(BASE, "stop.iconset"))
    print("wrote iconsets to", BASE)


if __name__ == "__main__":
    main()

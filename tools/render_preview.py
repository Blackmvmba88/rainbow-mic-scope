#!/usr/bin/env python3
"""Render a static promotional preview for the repository README."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "screenshot.png"


def hsv_to_rgb(hue: float, sat: float = 1.0, val: float = 1.0) -> tuple[int, int, int]:
    chroma = val * sat
    h = (hue % 360.0) / 60.0
    x = chroma * (1.0 - abs(h % 2.0 - 1.0))
    if 0 <= h < 1:
        rgb = chroma, x, 0
    elif 1 <= h < 2:
        rgb = x, chroma, 0
    elif 2 <= h < 3:
        rgb = 0, chroma, x
    elif 3 <= h < 4:
        rgb = 0, x, chroma
    elif 4 <= h < 5:
        rgb = x, 0, chroma
    else:
        rgb = chroma, 0, x
    match = val - chroma
    return tuple(int((channel + match) * 255) for channel in rgb)


def draw_portal(draw: ImageDraw.ImageDraw, width: int, height: int, glow: bool = False) -> None:
    cx = width // 2
    cy = height // 2 + 44
    count = 160
    base = min(width, height)

    for i in range(count):
        t = i / count
        angle = t * math.tau - math.pi / 2
        audio = (
            0.48 * math.sin(t * math.tau * 5.0 + 0.8)
            + 0.24 * math.sin(t * math.tau * 13.0)
            + 0.15 * math.sin(t * math.tau * 29.0)
        )
        audio = max(-1.0, min(1.0, audio))
        inner = base * (0.155 + min(audio, 0.0) * 0.04)
        outer = base * (0.305 + max(audio, 0.0) * 0.17 + abs(audio) * 0.08)
        x1 = cx + math.cos(angle) * inner
        y1 = cy + math.sin(angle) * inner
        x2 = cx + math.cos(angle) * outer
        y2 = cy + math.sin(angle) * outer
        color = hsv_to_rgb(t * 360)
        alpha = 82 if glow else 255
        line_width = 13 if glow else 4
        draw.line((x1, y1, x2, y2), fill=(*color, alpha), width=line_width)


def main() -> None:
    width, height = 1600, 900
    bg = Image.new("RGBA", (width, height), "#05060aff")

    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw_portal(ImageDraw.Draw(glow), width, height, glow=True)
    glow = glow.filter(ImageFilter.GaussianBlur(8))
    bg.alpha_composite(glow)

    foreground = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(foreground)
    draw_portal(draw, width, height)

    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 54)
        mono_font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 26)
    except OSError:
        title_font = ImageFont.load_default()
        mono_font = ImageFont.load_default()

    draw.text((64, 54), "Rainbow Mic Scope", fill="#f8fafcff", font=title_font)
    draw.text(
        (68, 124),
        "MODE PORTAL   THEME RAINBOW   PID AUTO-GAIN   WEBUI v1.4",
        fill="#cbd5e1ff",
        font=mono_font,
    )
    draw.rounded_rectangle((64, 770, 520, 830), radius=16, outline="#ffffff2d", width=2, fill="#07101fcc")
    draw.text((88, 788), "Canvas + Web Audio + expanding trail", fill="#e0f2feff", font=mono_font)

    bg.alpha_composite(foreground)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bg.convert("RGB").save(OUT, quality=95)
    print(OUT)


if __name__ == "__main__":
    main()

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "assets"
WIDTH = 1280
HEIGHT = 640


FONT_REGULAR = Path("C:/Windows/Fonts/segoeui.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/segoeuib.ttf")
FONT_MONO = Path("C:/Windows/Fonts/CascadiaMono.ttf")
FONT_ZH = Path("C:/Windows/Fonts/Noto Sans SC (TrueType).otf")
FONT_ZH_BOLD = Path("C:/Windows/Fonts/Noto Sans SC Bold (TrueType).otf")


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    if path.exists():
        return ImageFont.truetype(str(path), size)
    return ImageFont.truetype(str(FONT_REGULAR), size)


def gradient_background(width: int, height: int, seed: int = 7) -> Image.Image:
    random.seed(seed)
    img = Image.new("RGB", (width, height), "#060914")
    pix = img.load()
    for y in range(height):
        for x in range(width):
            nx = x / width
            ny = y / height
            cyan = max(0, 1 - math.hypot(nx - 0.78, ny - 0.28) * 1.4)
            violet = max(0, 1 - math.hypot(nx - 0.08, ny - 0.82) * 1.8)
            green = max(0, 1 - math.hypot(nx - 0.82, ny - 0.82) * 2.0)
            r = int(5 + 12 * nx + 22 * violet + 4 * cyan)
            g = int(8 + 24 * ny + 38 * cyan + 30 * green)
            b = int(22 + 44 * cyan + 46 * violet + 16 * green)
            pix[x, y] = (r, g, b)

    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for x in range(-height, width + height, 54):
        d.line([(x, height), (x + height, 0)], fill=(86, 130, 255, 24), width=1)
    for y in range(40, height, 58):
        d.line([(0, y), (width, y - 64)], fill=(40, 255, 226, 18), width=1)
    for _ in range(130):
        x = random.randrange(width)
        y = random.randrange(height)
        alpha = random.randrange(25, 80)
        color = random.choice([(93, 232, 255, alpha), (142, 111, 255, alpha), (89, 255, 188, alpha)])
        d.ellipse((x - 1, y - 1, x + 1, y + 1), fill=color)
    return Image.alpha_composite(img.convert("RGBA"), overlay)


def glow_line(layer: Image.Image, points: list[tuple[int, int]], color: tuple[int, int, int], width: int = 2) -> None:
    glow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.line(points, fill=(*color, 160), width=width + 5, joint="curve")
    glow = glow.filter(ImageFilter.GaussianBlur(7))
    layer.alpha_composite(glow)
    d = ImageDraw.Draw(layer)
    d.line(points, fill=(*color, 230), width=width, joint="curve")


def rounded_panel(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill, outline=None, width=1) -> None:
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw: ImageDraw.ImageDraw, xy, value: str, fnt, fill, anchor=None) -> None:
    draw.text(xy, value, font=fnt, fill=fill, anchor=anchor)


def draw_pill(draw: ImageDraw.ImageDraw, xy: tuple[int, int], label: str, accent, fnt) -> int:
    x, y = xy
    bbox = draw.textbbox((0, 0), label, font=fnt)
    w = bbox[2] - bbox[0] + 34
    rounded_panel(draw, (x, y, x + w, y + 38), 19, fill=(9, 22, 38, 178), outline=(*accent, 190), width=1)
    draw.ellipse((x + 14, y + 15, x + 22, y + 23), fill=(*accent, 255))
    text(draw, (x + 30, y + 9), label, fnt, (213, 232, 246, 245))
    return w


def draw_status_tile(draw: ImageDraw.ImageDraw, box, title: str, body: str, accent, mono, small) -> None:
    rounded_panel(draw, box, 16, fill=(6, 15, 28, 186), outline=(135, 190, 230, 110), width=1)
    x1, y1, _, _ = box
    draw.line((x1 + 18, y1 + 18, x1 + 18, y1 + 52), fill=(*accent, 255), width=3)
    text(draw, (x1 + 34, y1 + 15), title, mono, (232, 244, 255, 255))
    text(draw, (x1 + 34, y1 + 48), body, small, (149, 177, 196, 255))


def draw_right_visual(img: Image.Image, lang: str) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = 930, 312

    for radius, color, width in [
        (198, (71, 222, 255), 2),
        (152, (133, 101, 255), 2),
        (108, (76, 255, 190), 2),
    ]:
        glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.arc((cx - radius, cy - radius, cx + radius, cy + radius), 205, 528, fill=(*color, 115), width=width + 8)
        layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(8)))
        d.arc((cx - radius, cy - radius, cx + radius, cy + radius), 205, 528, fill=(*color, 230), width=width)

    nodes = [
        (762, 214, "PLAN", (84, 229, 255)),
        (1078, 226, "BUILD", (139, 111, 255)),
        (1110, 390, "VERIFY", (92, 255, 181)),
        (932, 512, "LEARN", (255, 218, 91)),
        (742, 368, "SYNC", (255, 87, 190)),
    ]
    center_box = (808, 262, 1088, 382)
    for nx, ny, _, c in nodes:
        glow_line(layer, [(cx, cy), (nx, ny)], c, width=1)

    rounded_panel(d, center_box, 22, fill=(5, 17, 31, 232), outline=(135, 232, 255, 230), width=2)
    mono = font(FONT_MONO, 18)
    mono_small = font(FONT_MONO, 14)
    label = "ACTIVE RUN" if lang == "en" else "主动运行"
    sub = "review  |  validate  |  promote" if lang == "en" else "审查  |  验证  |  晋升"
    text(d, (948, 298), label, font(FONT_BOLD if lang == "en" else FONT_ZH_BOLD, 22), (238, 248, 255, 255), anchor="mm")
    d.line((844, 321, 1052, 321), fill=(85, 236, 255, 230), width=2)
    text(d, (948, 348), sub, mono if lang == "en" else font(FONT_ZH, 18), (168, 212, 231, 255), anchor="mm")

    for nx, ny, label, c in nodes:
        r = 24
        d.ellipse((nx - r, ny - r, nx + r, ny + r), fill=(5, 15, 28, 235), outline=(*c, 255), width=2)
        text(d, (nx, ny), label, mono_small, (238, 247, 255, 255), anchor="mm")

    for i, (x, y) in enumerate([(1114, 112), (1168, 154), (1136, 496), (704, 132), (1032, 104), (782, 498)]):
        color = [(70, 222, 255), (133, 101, 255), (88, 255, 187)][i % 3]
        d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(*color, 180))
        d.ellipse((x - 12, y - 12, x + 12, y + 12), outline=(*color, 48), width=1)

    img.alpha_composite(layer)


def draw_banner(lang: str) -> Image.Image:
    img = gradient_background(WIDTH, HEIGHT)
    d = ImageDraw.Draw(img)

    # Ambient right-side graph lines.
    graph = Image.new("RGBA", img.size, (0, 0, 0, 0))
    glow_line(graph, [(626, 470), (728, 407), (818, 426), (914, 360), (1042, 404), (1184, 326)], (75, 235, 255), 2)
    glow_line(graph, [(604, 188), (718, 232), (812, 196), (932, 244), (1034, 196), (1160, 246)], (139, 111, 255), 2)
    img.alpha_composite(graph)

    # Main copy area uses open space, not a heavy card.
    badge = "CODEX APP AUTONOMY KIT" if lang == "en" else "CODEX APP 自主运行套件"
    title_lines = ["Codex App", "Autonomous Runs"] if lang == "en" else ["Codex App", "自主持续运行"]
    subtitle = (
        "Long active sessions for real project work"
        if lang == "en"
        else "长时间主动推进项目，不再每一步等待继续"
    )
    features = (
        ["Reviewer agents", "Learning promotion", "Safety guardrails"]
        if lang == "en"
        else ["只读审查代理", "学习晋升", "窄范围安全护栏"]
    )
    tiles = (
        [("RUN STATE", "resume-ready logs"), ("REVIEW LANE", "read-only auditors"), ("PROMOTION", "validated learning")]
        if lang == "en"
        else [("运行状态", "可恢复日志"), ("审查通道", "只读审查"), ("学习晋升", "验证后同步")]
    )
    bottom = (
        "Codex App only  /  high automation  /  narrow human checkpoints"
        if lang == "en"
        else "仅 Codex App 端  /  高自动化  /  只保留关键风险确认"
    )

    heading_font = font(FONT_BOLD if lang == "en" else FONT_ZH_BOLD, 66 if lang == "en" else 58)
    sub_font = font(FONT_REGULAR if lang == "en" else FONT_ZH, 25 if lang == "en" else 27)
    pill_font = font(FONT_REGULAR if lang == "en" else FONT_ZH, 17)
    mono = font(FONT_MONO if lang == "en" else FONT_ZH_BOLD, 18)
    small = font(FONT_MONO if lang == "en" else FONT_ZH, 16)

    rounded_panel(d, (72, 70, 354, 112), 21, fill=(7, 20, 34, 172), outline=(91, 234, 255, 190), width=1)
    text(d, (96, 82), badge, font(FONT_MONO if lang == "en" else FONT_ZH_BOLD, 15), (99, 236, 255, 255))

    text(d, (72, 166), title_lines[0], heading_font, (245, 250, 255, 255))
    text(d, (72, 238), title_lines[1], heading_font, (245, 250, 255, 255))
    text(d, (76, 332), subtitle, sub_font, (177, 209, 226, 255))

    x = 76
    for label, color in zip(features, [(83, 229, 255), (136, 113, 255), (91, 255, 189)]):
        w = draw_pill(d, (x, 386), label, color, pill_font)
        x += w + 12

    tile_y = 465
    tile_w = 206 if lang == "en" else 186
    for index, (title, body) in enumerate(tiles):
        x1 = 76 + index * (tile_w + 18)
        draw_status_tile(d, (x1, tile_y, x1 + tile_w, tile_y + 82), title, body, [(83, 229, 255), (136, 113, 255), (91, 255, 189)][index], mono, small)

    d.line((76, 574, 360, 574), fill=(82, 233, 255, 130), width=1)
    text(d, (76, 590), bottom, font(FONT_REGULAR if lang == "en" else FONT_ZH, 17), (133, 170, 193, 255))

    draw_right_visual(img, lang)

    # Subtle edge vignette while keeping the title and product visual bright.
    vignette = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    for i in range(84):
        alpha = int(95 * (1 - i / 84) ** 2)
        vd.rectangle((i, i, WIDTH - i, HEIGHT - i), outline=(0, 0, 0, alpha), width=1)
    img = Image.alpha_composite(img, vignette)
    return img.convert("RGB")


def save_assets() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    bg = gradient_background(1672, 941, seed=11).convert("RGB")
    bg.save(ASSETS / "promo-background-image2.png", quality=95)
    for lang, stem in [("en", "promo-en"), ("zh", "promo-zh")]:
        img = draw_banner(lang)
        img.save(ASSETS / f"{stem}.png", optimize=True)
        img.save(ASSETS / f"{stem}.webp", quality=92, method=6)
        print(f"wrote {stem}.png/.webp")


if __name__ == "__main__":
    save_assets()

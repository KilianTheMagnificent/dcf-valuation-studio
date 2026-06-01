"""Generate the macOS .icns app icon: an indigo→cyan rounded square with a
white integral mark (matching the in-app logo). Writes an .iconset folder;
the caller runs `iconutil` to produce icon.icns."""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
S = 1024


def vertical_gradient(size, top, bot):
    g = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / (size - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return g.resize((size, size))


def load_font(px):
    candidates = [
        "/System/Library/Fonts/SFNSRounded.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Times.ttc",
    ]
    for p in candidates:
        try:
            return ImageFont.truetype(p, px)
        except Exception:
            continue
    return ImageFont.load_default()


# --- compose master 1024 icon ------------------------------------------------
grad = vertical_gradient(S, (79, 70, 229), (34, 211, 238))  # indigo -> cyan
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=228, fill=255)
icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
icon.paste(grad, (0, 0), mask)

draw = ImageDraw.Draw(icon)
# Big white integral glyph; fall back to "DCF" if the font lacks U+222B.
glyph, fpx = "∫", 720
font = load_font(fpx)
try:
    bbox = draw.textbbox((0, 0), glyph, font=font)
    if (bbox[2] - bbox[0]) < S * 0.12:  # glyph missing -> tofu/narrow
        raise ValueError
except Exception:
    glyph, font = "DCF", load_font(300)
    bbox = draw.textbbox((0, 0), glyph, font=font)

w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
draw.text(((S - w) / 2 - bbox[0], (S - h) / 2 - bbox[1] - S * 0.02),
          glyph, font=font, fill=(255, 255, 255, 245))

# --- write the .iconset ------------------------------------------------------
iconset = os.path.join(HERE, "icon.iconset")
os.makedirs(iconset, exist_ok=True)
specs = [(16, 1), (16, 2), (32, 1), (32, 2), (128, 1), (128, 2),
         (256, 1), (256, 2), (512, 1), (512, 2)]
for base, scale in specs:
    px = base * scale
    name = f"icon_{base}x{base}{'@2x' if scale == 2 else ''}.png"
    icon.resize((px, px), Image.LANCZOS).save(os.path.join(iconset, name))

print("iconset written to", iconset)

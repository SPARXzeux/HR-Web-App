"""
One-time helper: converts "Tracker Icon.png" (the DelCargo Tracker brand
mark) into the icon.ico / icon.icns files PyInstaller and Inno Setup need,
and a small icon.png used for the in-app window/taskbar icon.

The source PNG is a large square canvas with a lot of padding around a
small centered mark — fine for a source asset, but it would look like a
tiny illegible dot if scaled straight down to a 16x16 taskbar icon. This
script auto-crops to the actual artwork first, then generates properly
legible multi-resolution icons.

Usage (run once, and again any time Tracker Icon.png changes):
    pip install pillow --break-system-packages   # if not already installed
    python generate_icons.py

Produces (all in this same folder):
    icon.ico   — Windows icon (16/32/48/256px), used by build_windows.bat
    icon.icns  — macOS icon, used by build_mac.sh
    icon.png   — 256px PNG, used by agent_gui.py for the in-app window icon
"""

import sys
from PIL import Image

SRC = "Tracker Icon.png"
ICO_OUT = "icon.ico"
ICNS_OUT = "icon.icns"
PNG_OUT = "icon.png"

ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def autocrop_to_content(img: Image.Image, pad_ratio: float = 0.12) -> Image.Image:
    """Crops out the excess background margin around the logo mark, then
    re-pads modestly and returns a square canvas so the icon reads clearly
    at small sizes instead of shrinking to a speck."""
    rgba = img.convert("RGBA")
    bg = rgba.getpixel((0, 0))  # sample a corner pixel as the background color

    # Build an alpha-ish diff mask: anything sufficiently different from
    # the background corner color counts as "content".
    def differs(px):
        return sum(abs(a - b) for a, b in zip(px, bg)) > 30

    w, h = rgba.size
    px = rgba.load()
    left, top, right, bottom = w, h, 0, 0
    # Sample every 2px for speed on a 1024x1024 source — plenty precise.
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if differs(px[x, y]):
                left, top = min(left, x), min(top, y)
                right, bottom = max(right, x), max(bottom, y)

    if right <= left or bottom <= top:
        # Couldn't find distinct content (shouldn't happen) — fall back to
        # using the image as-is rather than crashing the build.
        return rgba

    content_w, content_h = right - left, bottom - top
    pad = int(max(content_w, content_h) * pad_ratio)
    left, top = max(0, left - pad), max(0, top - pad)
    right, bottom = min(w, right + pad), min(h, bottom + pad)
    cropped = rgba.crop((left, top, right, bottom))

    # Pad out to a centered square on the same background color so the
    # brand's dark badge look is preserved, just tighter.
    side = max(cropped.size)
    canvas = Image.new("RGBA", (side, side), bg)
    offset = ((side - cropped.width) // 2, (side - cropped.height) // 2)
    canvas.paste(cropped, offset, cropped)
    return canvas


def main():
    try:
        img = Image.open(SRC)
    except FileNotFoundError:
        print(f"Couldn't find {SRC} in this folder. Make sure it's saved as "
              f"'tracker-agent/{SRC}' before running this script.")
        sys.exit(1)

    square = autocrop_to_content(img)

    square.resize((256, 256), Image.LANCZOS).save(PNG_OUT)
    print(f"Wrote {PNG_OUT}")

    square.save(ICO_OUT, sizes=ICO_SIZES)
    print(f"Wrote {ICO_OUT}")

    try:
        square.resize((1024, 1024), Image.LANCZOS).save(ICNS_OUT)
        print(f"Wrote {ICNS_OUT}")
    except Exception as e:
        # Pillow can usually write .icns on any OS, but if this environment
        # can't, it's only needed for the Mac build — don't fail the whole
        # script over it.
        print(f"[warn] Couldn't write {ICNS_OUT} ({e}). Only needed for "
              f"build_mac.sh — Windows build is unaffected.")

    print("\nDone. Re-run build_windows.bat / build_mac.sh to bake the new icon in.")


if __name__ == "__main__":
    main()

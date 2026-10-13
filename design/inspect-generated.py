"""把 GPT 生成的图做成一张总览图，便于一次性验收；同时打印尺寸/比例/体积。"""
import io
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\Vibe Coding\seu-run-assistant"
GEN = os.path.join(ROOT, "design", "generated")
ASSETS = os.path.join(ROOT, "assets")

ITEMS = [
    ("visual-reference", os.path.join(GEN, "01-visual-reference.png")),
    ("site-mockup-desktop", os.path.join(GEN, "02-site-mockup-desktop.png")),
    ("site-mockup-mobile", os.path.join(GEN, "02-site-mockup-mobile.png")),
    ("hero-backdrop", os.path.join(ASSETS, "hero-backdrop.png")),
    ("banner-form", os.path.join(ASSETS, "banner-form.png")),
    ("banner-batch", os.path.join(ASSETS, "banner-batch.png")),
    ("banner-live", os.path.join(ASSETS, "banner-live.png")),
    ("empty-track", os.path.join(ASSETS, "empty-track.png")),
    ("texture-paper", os.path.join(ASSETS, "texture-paper.png")),
    ("og-cover", os.path.join(ASSETS, "og-cover.png")),
]


def font(size):
    for path in (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\arial.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


rows = []
print(f"{'name':22s} {'size':>12s} {'ratio':>7s} {'MB':>7s}")
for name, path in ITEMS:
    if not os.path.exists(path):
        print(f"{name:22s} ！！ 不存在: {path}")
        continue
    im = Image.open(path)
    w, h = im.size
    mb = os.path.getsize(path) / 1024 / 1024
    print(f"{name:22s} {w:>6d}x{h:<5d} {w/h:7.3f} {mb:7.2f}")
    rows.append((name, im.convert("RGB"), (w, h)))

# 总览图：两列，按行排
cell_w, cell_h = 900, 470
cols = 2
rows_n = (len(rows) + cols - 1) // cols
label_h = 34
sheet = Image.new("RGB", (cols * (cell_w + 20) + 20, rows_n * (cell_h + label_h + 20) + 20), "#F6F7F2")
d = ImageDraw.Draw(sheet)
f = font(22)
for i, (name, im, size) in enumerate(rows):
    cx = 20 + (i % cols) * (cell_w + 20)
    cy = 20 + (i // cols) * (cell_h + label_h + 20)
    d.rectangle([cx, cy, cx + cell_w, cy + label_h], fill="#11243F")
    d.text((cx + 10, cy + 6), f"{name}   {size[0]}x{size[1]}", fill="#FFFFFF", font=f)
    thumb = im.copy()
    thumb.thumbnail((cell_w, cell_h), Image.LANCZOS)
    ox = cx + (cell_w - thumb.width) // 2
    oy = cy + label_h + (cell_h - thumb.height) // 2
    sheet.paste(thumb, (ox, oy))
sheet.save(os.path.join(GEN, "_contact-sheet.png"))
print("\n总览图:", os.path.join(GEN, "_contact-sheet.png"))

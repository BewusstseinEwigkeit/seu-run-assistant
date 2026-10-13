"""
把生成的原始 PNG 归档，并转码成页面要用的 WebP（含尺寸与体积控制）。
原始文件先复制到 design/generated/originals/，不会被覆盖。
"""
import os
import shutil

from PIL import Image

ROOT = r"D:\Vibe Coding\seu-run-assistant"
ASSETS = os.path.join(ROOT, "assets")
ORIGINALS = os.path.join(ROOT, "design", "generated", "originals")
os.makedirs(ORIGINALS, exist_ok=True)

# (源文件, 输出文件, 最长边(0=不改), WebP 质量, 体积上限 KB)
JOBS = [
    ("hero-backdrop.png", "hero-backdrop.webp", 0, 82, 260),
    ("banner-form.png", "banner-form.webp", 0, 80, 170),
    ("banner-batch.png", "banner-batch.webp", 0, 80, 170),
    ("banner-live.png", "banner-live.webp", 0, 80, 170),
    ("empty-track.png", "empty-track.webp", 1200, 84, 110),
    ("texture-paper.png", "texture-paper.webp", 1024, 88, 320),
]


def archive(name):
    src = os.path.join(ASSETS, name)
    dst = os.path.join(ORIGINALS, name)
    if os.path.exists(src) and not os.path.exists(dst):
        shutil.copy2(src, dst)
    return dst


def save_webp(src_path, out_path, max_side, quality, limit_kb):
    im = Image.open(src_path).convert("RGB")
    if max_side and max(im.size) > max_side:
        scale = max_side / max(im.size)
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    q = quality
    while True:
        im.save(out_path, "WEBP", quality=q, method=6)
        kb = os.path.getsize(out_path) / 1024
        if kb <= limit_kb or q <= 55:
            return im.size, kb, q
        q -= 6


print(f"{'输出':28s} {'尺寸':>12s} {'KB':>8s} {'q':>3s}")
for name, out_name, max_side, quality, limit in JOBS:
    src = os.path.join(ASSETS, name)
    if not os.path.exists(src):
        print(f"{out_name:28s} ！！ 源文件不存在 {src}")
        continue
    archive(name)
    out = os.path.join(ASSETS, out_name)
    size, kb, q = save_webp(src, out, max_side, quality, limit)
    print(f"{out_name:28s} {size[0]:>5d}x{size[1]:<6d} {kb:8.1f} {q:3d}")

# 封面图按 1200x630 出，og:image 用 PNG 兼容性最好
cover_src = os.path.join(ASSETS, "og-cover.png")
if os.path.exists(cover_src):
    archive("og-cover.png")
    im = Image.open(os.path.join(ORIGINALS, "og-cover.png")).convert("RGB")
    target = (1200, 630)
    src_ratio = im.width / im.height
    tgt_ratio = target[0] / target[1]
    if src_ratio > tgt_ratio:      # 太宽 → 裁两侧
        new_w = round(im.height * tgt_ratio)
        left = (im.width - new_w) // 2
        im = im.crop((left, 0, left + new_w, im.height))
    else:                          # 太高 → 裁上下
        new_h = round(im.width / tgt_ratio)
        top = (im.height - new_h) // 2
        im = im.crop((0, top, im.width, top + new_h))
    im = im.resize(target, Image.LANCZOS)
    im.save(cover_src, "PNG", optimize=True)
    print(f"{'og-cover.png':28s} {target[0]:>5d}x{target[1]:<6d} {os.path.getsize(cover_src)/1024:8.1f}   裁剪到 1200x630")

print("\n原始 PNG 归档目录:", ORIGINALS)

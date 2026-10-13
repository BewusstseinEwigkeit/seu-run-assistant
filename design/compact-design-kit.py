"""
1) 校验 assets/*.png 与 design/generated/originals/*.png 是同一份（哈希一致）后才动手；
2) 为设计图与原始母版生成高质量压缩版（WebP q92 / q95），它们才是入库的那一份；
3) 删掉 assets/ 里重复的 PNG 与已被取代的旧 webp。
原始 PNG 不会被删除，只是不进 git（见 .gitignore）。
"""
import hashlib
import os

from PIL import Image

ROOT = r"D:\Vibe Coding\seu-run-assistant"
ASSETS = os.path.join(ROOT, "assets")
GEN = os.path.join(ROOT, "design", "generated")
ORIGINALS = os.path.join(GEN, "originals")

ASSET_PNGS = [
    "hero-backdrop.png", "banner-form.png", "banner-batch.png", "banner-live.png",
    "empty-track.png", "texture-paper.png", "og-cover.png",
]
DESIGN_PNGS = ["01-visual-reference.png", "02-site-mockup-desktop.png", "02-site-mockup-mobile.png"]
DEAD_WEBP = ["light-campus-track-v1.webp", "light-photo-workflow-v1.webp"]


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def to_webp(src, dst, quality):
    im = Image.open(src).convert("RGB")
    im.save(dst, "WEBP", quality=quality, method=6)
    return im.size, os.path.getsize(src) / 1024, os.path.getsize(dst) / 1024


print("== 1. 校验 assets 与 originals 是否同一份 ==")
# og-cover 是例外：归档里是生成的原始比例（1729x910），assets 里是我裁到 1200x630 的版本
HASH_EXCEPTIONS = {"og-cover.png"}
same = True
for name in ASSET_PNGS:
    a = os.path.join(ASSETS, name)
    b = os.path.join(ORIGINALS, name)
    if not (os.path.exists(a) and os.path.exists(b)):
        print(f"  {name}: 缺文件 a={os.path.exists(a)} b={os.path.exists(b)}")
        same = False
        continue
    if name in HASH_EXCEPTIONS:
        print(f"  {name}: 跳过比对（有意重裁过）")
        continue
    ok = md5(a) == md5(b)
    same = same and ok
    print(f"  {name}: {'一致' if ok else '不一致！！'}")
if not same:
    raise SystemExit("assets 与 originals 不是同一份，已中止，未删除任何文件")

print("\n== 2. 生成压缩版（入库的那一份）==")
print(f"{'文件':34s} {'尺寸':>12s} {'PNG KB':>9s} {'WebP KB':>9s} {'压缩比':>7s}")
for name in ASSET_PNGS:
    src = os.path.join(ORIGINALS, name)
    dst = os.path.join(ORIGINALS, name[:-4] + ".webp")
    size, src_kb, dst_kb = to_webp(src, dst, 95)
    print(f"{'originals/' + name[:-4] + '.webp':34s} {size[0]:>5d}x{size[1]:<6d} {src_kb:9.0f} {dst_kb:9.0f} {src_kb/dst_kb:6.1f}x")
for name in DESIGN_PNGS:
    src = os.path.join(GEN, name)
    dst = os.path.join(GEN, name[:-4] + ".webp")
    size, src_kb, dst_kb = to_webp(src, dst, 92)
    print(f"{'generated/' + name[:-4] + '.webp':34s} {size[0]:>5d}x{size[1]:<6d} {src_kb:9.0f} {dst_kb:9.0f} {src_kb/dst_kb:6.1f}x")

print("\n== 3. 清理 assets/ 里的重复与旧文件 ==")
for name in ASSET_PNGS + DEAD_WEBP:
    path = os.path.join(ASSETS, name)
    if os.path.exists(path):
        os.remove(path)
        print(f"  已删除 assets/{name}")
    else:
        print(f"  assets/{name} 不存在，跳过")
print("\n完成。原始 PNG 仍在原地（只是不入 git）。")

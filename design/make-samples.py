"""
生成设计交付物里的"样本图"部分：
  design/palette.png          —— 色卡（取自 index.html 的真实 CSS 变量）
  design/samples/*.png        —— 可先用的占位资产（GPT 出的图可直接替换同名文件）
用法：python design/make-samples.py
"""
import io
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
SAMPLES = os.path.join(ROOT, "samples")
os.makedirs(SAMPLES, exist_ok=True)

# 与 index.html 的 CSS 变量保持一致
PALETTE = [
    ("主蓝 primary", "#2563EB", "主按钮 / 选中态 / 关键线条"),
    ("深蓝 deep", "#0C4EB3", "按钮悬停 / 强调文字"),
    ("极浅蓝 pale", "#E8F1FF", "选中底 / 高亮块"),
    ("深青 teal", "#0F766E", "数据可视化线条"),
    ("薄荷 mint", "#2FC5A1", "成功 / 数值点缀"),
    ("琥珀 amber", "#F59E0B", "当前位置 / 终点"),
    ("墨色 ink", "#11243F", "标题 / 深色胶囊按钮"),
    ("次级文字", "#53657A", "说明文字"),
    ("纸白 paper", "#FFFEFA", "卡片底"),
    ("页面象牙 ivory", "#F6F7F2", "页面底"),
    ("浅面 surface-soft", "#F6F8FB", "输入框 / 面板底"),
    ("分隔线 hairline", "#D9E2EC", "1px 描边"),
]


def font(size):
    for path in (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhl.ttc", r"C:\Windows\Fonts\arial.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def draw_palette():
    scale = 2
    W, H = 1600 * scale, 900 * scale
    img = Image.new("RGB", (W, H), "#F6F7F2")
    d = ImageDraw.Draw(img)
    title = font(46 * scale)
    label = font(24 * scale)
    sub = font(20 * scale)
    d.text((80 * scale, 56 * scale), "视觉色卡 · Visual Palette", fill="#11243F", font=title)
    d.text((80 * scale, 122 * scale), "浅色编辑风：蓝为主，青绿只做数据，琥珀只做“当前位置”", fill="#53657A", font=sub)

    cols, cw, ch = 4, 350 * scale, 150 * scale
    x0, y0, gap = 80 * scale, 200 * scale, 24 * scale
    for i, (name, hexv, note) in enumerate(PALETTE):
        cx = x0 + (i % cols) * (cw + gap)
        cy = y0 + (i // cols) * (ch + gap + 66 * scale)
        d.rounded_rectangle([cx, cy, cx + cw, cy + ch], radius=18 * scale, fill=hexv,
                            outline="#D9E2EC", width=2 * scale)
        d.text((cx, cy + ch + 12 * scale), name, fill="#11243F", font=label)
        d.text((cx, cy + ch + 42 * scale), hexv + "   " + note, fill="#53657A", font=sub)
    img = img.resize((W // scale, H // scale), Image.LANCZOS)
    img.save(os.path.join(ROOT, "palette.png"))
    print("palette.png")


def rounded(d, box, r, **kw):
    d.rounded_rectangle(box, radius=r, **kw)


def stadium_points(cx, cy, half_len, radius, steps=360):
    """跑道形（两个直道 + 两个半圆）闭合曲线"""
    pts = []
    for i in range(steps + 1):
        t = i / steps * math.tau
        # 参数化：右侧半圆 + 左侧半圆，中间直道
        if -math.pi / 2 <= t < math.pi / 2:
            pts.append((cx + half_len + radius * math.cos(t), cy + radius * math.sin(t)))
        elif math.pi / 2 <= t < 3 * math.pi / 2:
            pts.append((cx - half_len - radius * math.cos(t - math.pi), cy + radius * math.sin(t)))
    return pts


def smooth_loop(cx, cy, half_len, radius, steps=420):
    pts = []
    for i in range(steps + 1):
        t = i / steps * math.tau
        # 超椭圆式跑道：左右半圆 + 上下直道
        x = cx + half_len * math.cos(t) if abs(math.cos(t)) > 0 else cx
        # 用参数方程：x = cx + half_len*cos + radius*sign(cos)，y = cy + radius*sin
        x = cx + half_len * math.copysign(1, math.cos(t)) * abs(math.cos(t)) ** 0 + radius * math.cos(t) * 0
        x = cx + half_len * math.cos(t) + radius * math.cos(t)
        y = cy + radius * math.sin(t) * 1.0
        pts.append((x, y))
    return pts


def track_loop(cx, cy, straight_half, radius, steps=600, squash=1.0):
    """标准跑道形：x = cx ± straight_half + radius*cosθ, y = cy + radius*sinθ（θ 全域）"""
    pts = []
    for i in range(steps + 1):
        t = i / steps * math.tau
        x = cx + straight_half * math.copysign(1.0, math.cos(t)) + radius * math.cos(t)
        y = cy + radius * math.sin(t) * squash
        pts.append((x, y))
    return pts


def soft_background(size, top="#EAF3FF", bottom="#FFFEFA"):
    W, H = size
    img = Image.new("RGB", size, bottom)
    d = ImageDraw.Draw(img)
    tr, tg, tb = Image.new("RGB", (1, 1), top).getpixel((0, 0))
    br, bg, bb = Image.new("RGB", (1, 1), bottom).getpixel((0, 0))
    for y in range(H):
        k = (y / max(1, H - 1)) ** 0.9
        d.line([(0, y), (W, y)], fill=(int(tr + (br - tr) * k), int(tg + (bg - tg) * k), int(tb + (bb - tb) * k)))
    return img


def draw_hero_backdrop():
    scale = 2
    W, H = 2400 * scale, 1200 * scale
    img = soft_background((W, H), "#DCEBFF", "#FFFDF8")
    # 右侧柔焦散景 + 树冠色块
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    random.seed(7)
    for _ in range(70):
        r = random.randint(60, 220) * scale
        x = random.randint(int(W * 0.45), W)
        y = random.randint(int(H * 0.15), H)
        g = random.choice([(47, 197, 161, 26), (37, 99, 235, 20), (122, 168, 116, 30), (255, 255, 255, 60)])
        d.ellipse([x - r, y - r, x + r, y + r], fill=g)
    # 一小片模糊的跑道弧线（只作为色块）
    d.arc([W * 0.58, H * 0.22, W * 1.05, H * 1.2], start=200, end=340, fill=(196, 92, 80, 46), width=46 * scale)
    layer = layer.filter(ImageFilter.GaussianBlur(34 * scale))
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    # 极轻纸张颗粒
    grain = Image.effect_noise((W, H), 9).convert("L").point(lambda v: 128 + (v - 128) * 0.16)
    img = Image.blend(img, Image.merge("RGB", (grain, grain, grain)), 0.05)
    img = img.resize((W // scale, H // scale), Image.LANCZOS)
    img.save(os.path.join(SAMPLES, "hero-backdrop.png"))
    print("hero-backdrop.png")


def draw_banner_form():
    scale = 2
    W, H = 1600 * scale, 600 * scale
    img = soft_background((W, H), "#F0F6FF", "#FFFEFA")
    d = ImageDraw.Draw(img, "RGBA")
    # 悬浮白卡 + 青绿跑道曲线
    rounded(d, [140 * scale, 120 * scale, 900 * scale, 520 * scale], 26 * scale,
            fill=(255, 255, 255, 236), outline=(217, 226, 236, 255), width=3 * scale)
    pts = track_loop(520 * scale, 320 * scale, 150 * scale, 92 * scale, squash=1.0)
    d.line(pts, fill=(15, 118, 110, 255), width=7 * scale, joint="curve")
    d.ellipse([pts[0][0] - 20 * scale, pts[0][1] - 20 * scale, pts[0][0] + 20 * scale, pts[0][1] + 20 * scale],
              fill=(15, 118, 110, 255))
    d.ellipse([pts[-1][0] - 16 * scale, pts[-1][1] - 16 * scale, pts[-1][0] + 16 * scale, pts[-1][1] + 16 * scale],
              fill=(245, 158, 11, 255))
    # 取景框（虚线）
    for x in range(int(980 * scale), int(1400 * scale), 34 * scale):
        d.line([(x, 170 * scale), (x + 20 * scale, 170 * scale)], fill=(37, 99, 235, 170), width=4 * scale)
        d.line([(x, 470 * scale), (x + 20 * scale, 470 * scale)], fill=(37, 99, 235, 170), width=4 * scale)
    for y in range(int(170 * scale), int(470 * scale), 34 * scale):
        d.line([(980 * scale, y), (980 * scale, y + 20 * scale)], fill=(37, 99, 235, 170), width=4 * scale)
        d.line([(1400 * scale, y), (1400 * scale, y + 20 * scale)], fill=(37, 99, 235, 170), width=4 * scale)
    # 手机轮廓
    rounded(d, [1120 * scale, 200 * scale, 1330 * scale, 460 * scale], 28 * scale,
            fill=(232, 241, 255, 235), outline=(37, 99, 235, 120), width=4 * scale)
    img = img.resize((W // scale, H // scale), Image.LANCZOS)
    img.save(os.path.join(SAMPLES, "banner-form.png"))
    print("banner-form.png")


def draw_banner_batch():
    scale = 2
    W, H = 1600 * scale, 600 * scale
    img = soft_background((W, H), "#F2F8FF", "#FFFEFA")
    d = ImageDraw.Draw(img, "RGBA")
    random.seed(3)
    for i in range(4):  # 错落的日期卡
        x = 150 * scale + i * 90 * scale
        y = 160 * scale + i * 34 * scale
        rounded(d, [x, y, x + 300 * scale, y + 190 * scale], 20 * scale,
                fill=(255, 255, 255, 240), outline=(217, 226, 236, 255), width=3 * scale)
        for row in range(3):
            yy = y + 44 * scale + row * 40 * scale
            d.line([(x + 30 * scale, yy), (x + 250 * scale - row * 40 * scale, yy)],
                   fill=(214, 226, 240, 255), width=8 * scale)
    # 清单勾
    rounded(d, [640 * scale, 210 * scale, 900 * scale, 400 * scale], 20 * scale, fill=(232, 241, 255, 240))
    d.line([(680 * scale, 300 * scale), (720 * scale, 340 * scale), (860 * scale, 250 * scale)],
           fill=(47, 197, 161, 255), width=10 * scale, joint="curve")
    # 进度条 + 节点
    d.line([(980 * scale, 300 * scale), (1440 * scale, 300 * scale)], fill=(214, 226, 240, 255), width=10 * scale)
    d.line([(980 * scale, 300 * scale), (1240 * scale, 300 * scale)], fill=(37, 99, 235, 255), width=10 * scale)
    for i, x in enumerate([980, 1110, 1240, 1370, 1440]):
        r = 16 * scale if i < 3 else 12 * scale
        color = (37, 99, 235, 255) if i < 3 else (214, 226, 240, 255)
        if i == 2:
            color = (245, 158, 11, 255)
        d.ellipse([x * scale - r, 300 * scale - r, x * scale + r, 300 * scale + r], fill=color)
    img = img.resize((W // scale, H // scale), Image.LANCZOS)
    img.save(os.path.join(SAMPLES, "banner-batch.png"))
    print("banner-batch.png")


def draw_banner_live():
    scale = 2
    W, H = 1600 * scale, 600 * scale
    img = soft_background((W, H), "#EFF7F4", "#FFFEFA")
    d = ImageDraw.Draw(img, "RGBA")
    # 计时环
    d.ellipse([230 * scale, 120 * scale, 710 * scale, 600 * scale], outline=(214, 226, 240, 255), width=8 * scale)
    d.arc([230 * scale, 120 * scale, 710 * scale, 600 * scale], start=200, end=340,
          fill=(47, 197, 161, 255), width=10 * scale)
    # 虚线路径
    x = 760 * scale
    for i in range(24):
        x0 = x + i * 28 * scale
        d.line([(x0, 360 * scale), (x0 + 16 * scale, 360 * scale)], fill=(15, 118, 110, 190), width=6 * scale)
    d.ellipse([x + 23 * 28 * scale - 18 * scale, 342 * scale, x + 23 * 28 * scale + 18 * scale, 378 * scale],
              fill=(245, 158, 11, 255))
    img = img.resize((W // scale, H // scale), Image.LANCZOS)
    img.save(os.path.join(SAMPLES, "banner-live.png"))
    print("banner-live.png")


def draw_empty_track():
    scale = 2
    W, H = 1200 * scale, 800 * scale
    img = Image.new("RGB", (W, H), "#F6F8FB")
    d = ImageDraw.Draw(img, "RGBA")
    # 虚线边界
    for x in range(int(200 * scale), int(1000 * scale), 40 * scale):
        d.line([(x, 120 * scale), (x + 22 * scale, 120 * scale)], fill=(148, 163, 184, 210), width=5 * scale)
        d.line([(x, 680 * scale), (x + 22 * scale, 680 * scale)], fill=(148, 163, 184, 210), width=5 * scale)
    for y in range(int(120 * scale), int(680 * scale), 40 * scale):
        d.line([(200 * scale, y), (200 * scale, y + 22 * scale)], fill=(148, 163, 184, 210), width=5 * scale)
        d.line([(1000 * scale, y), (1000 * scale, y + 22 * scale)], fill=(148, 163, 184, 210), width=5 * scale)
    # 内部虚线闭合路径
    pts = track_loop(600 * scale, 400 * scale, 190 * scale, 130 * scale)
    for i in range(0, len(pts) - 1, 2):
        d.line([pts[i], pts[i + 1]], fill=(15, 118, 110, 200), width=5 * scale)
    d.ellipse([pts[0][0] - 14 * scale, pts[0][1] - 14 * scale, pts[0][0] + 14 * scale, pts[0][1] + 14 * scale],
              fill=(15, 118, 110, 255))
    # 四角"可点击"圆环
    for (cx, cy) in [(240, 160), (960, 160), (960, 640), (240, 640)]:
        d.ellipse([cx * scale - 20 * scale, cy * scale - 20 * scale, cx * scale + 20 * scale, cy * scale + 20 * scale],
                  outline=(37, 99, 235, 150), width=5 * scale)
    img = img.resize((W // scale, H // scale), Image.LANCZOS)
    img.save(os.path.join(SAMPLES, "empty-track.png"))
    print("empty-track.png")


def draw_texture():
    size = 512
    img = Image.effect_noise((size, size), 26).convert("L")
    img = img.point(lambda v: int(250 + (v - 128) * 0.10))
    img = img.convert("RGB")
    # 轻微模糊让颗粒更细腻，并保证四边接缝一致（噪声本身无方向性）
    img = img.filter(ImageFilter.GaussianBlur(0.4))
    img.save(os.path.join(SAMPLES, "texture-paper.png"))
    print("texture-paper.png")


def draw_og_cover():
    scale = 2
    W, H = 1200 * scale, 630 * scale
    img = soft_background((W, H), "#EAF3FF", "#FFFEFA")
    d = ImageDraw.Draw(img, "RGBA")
    pts = track_loop(880 * scale, 430 * scale, 150 * scale, 92 * scale)
    d.line(pts, fill=(15, 118, 110, 235), width=8 * scale, joint="curve")
    d.ellipse([pts[-1][0] - 18 * scale, pts[-1][1] - 18 * scale, pts[-1][0] + 18 * scale, pts[-1][1] + 18 * scale],
              fill=(245, 158, 11, 255))
    img = img.resize((W // scale, H // scale), Image.LANCZOS)
    img.save(os.path.join(SAMPLES, "og-cover.png"))
    print("og-cover.png")


if __name__ == "__main__":
    draw_palette()
    draw_hero_backdrop()
    draw_banner_form()
    draw_banner_batch()
    draw_banner_live()
    draw_empty_track()
    draw_texture()
    draw_og_cover()
    print("输出目录:", SAMPLES)

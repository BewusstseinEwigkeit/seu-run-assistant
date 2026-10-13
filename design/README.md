# design/ —— 视觉资产工作区

这里放**给生图模型用的提示词**、**参考截图**、**生成结果**和**本地样本图**。生图已完成，产出物已经接进页面。

## 现状（v1 资产已接入）

| 位置 | 内容 | 入库? |
|---|---|---|
| `design/generated/*.webp` | GPT 生成的三张设计图的压缩版（q92，共 182 KB）：风格板 + 桌面/手机视觉稿 | ✅ |
| `design/generated/*.png` | 同上的原始 PNG（共 3.7 MB） | ❌ 本地保留 |
| `design/generated/_contact-sheet.png` | 验收总览图（把 10 张生成图拼一张） | ❌ 本地保留 |
| `design/generated/originals/*.webp` | **7 张资产的母版**（q95、全分辨率，共 506 KB），以后要换尺寸/质量都从这份转 | ✅ |
| `design/generated/originals/*.png` | 同上的原始 PNG（共 10.3 MB） | ❌ 本地保留 |
| `assets/*.webp` | 实际进页面的 6 张（共 126 KB） | ✅ |
| `assets/og-cover.jpg` | 封面图（1200×630，34 KB） | ✅ |
| `design/refs/` | 当前实现的真实界面截图（含整页图），一条命令就能重拍 | ❌ 本地保留 |
| `design/samples/` | 我早期用脚本画的占位资产，已被生成图取代，留作构图参考 | ✅ |
| `design/prompts/`、`palette.png`、三个脚本 | 提示词、色卡、可重跑的工具 | ✅ |

体积：原始 PNG 合计约 **14 MB** → 入库的设计资料约 **0.9 MB**。原始大图与截图不入库（见 `.gitignore`），需要时用脚本重新生成或转码。

### 已接线的位置

| 资产 | 用在哪 |
|---|---|
| `hero-backdrop.webp` | `.app-hero` 背景（含 3 处响应式覆盖，共 4 处 CSS） |
| `banner-form.webp` | 照片与提交面板顶部横幅（原 `light-photo-workflow-v1.webp`，已删） |
| `banner-batch.webp` | 批量面板顶部横幅 |
| `banner-live.webp` | 实时跑操面板展开后的横幅（新增） |
| `empty-track.webp` | 轨迹预览的空状态（生成轨迹后自动隐藏，换场地/清空后自动回来） |
| `texture-paper.webp` | `body::after` 全屏纸张颗粒，透明度 5%、`pointer-events:none` |
| `og-cover.jpg` | `<meta property="og:image">` |
| 图标 | 没有用生成的图标：改成 index.html 内联 SVG 精灵（`#i-key/#i-pin/#i-clock/#i-stopwatch/#i-gauge/#i-camera/#i-checklist/#i-calendar`），已用在 Token / 运动场地 / 起止时间 / 配速 / 跑道内缩 / 照片上传 / 日期范围 / 时间设置 / 照片池 / 轨迹预演 / 我的锻炼记录 等标签上 |

### 已清理

- `assets/hero-backdrop.png` 等 7 张重复 PNG（母版在 `design/generated/originals/`）
- `assets/light-campus-track-v1.webp`、`assets/light-photo-workflow-v1.webp`（已被新横幅取代，0 引用）

---

```
design/
├── README.md                  ← 你在看的这份
├── palette.png                ← 色卡（取自 index.html 的真实 CSS 变量）
├── capture-refs.js            ← 无头浏览器跑一遍页面：验证功能 + 重拍 refs/ 截图
├── make-samples.py            ← 重新生成 palette.png 与 samples/
├── transcode-assets.py        ← 归档原始 PNG + 转码成 assets/*.webp（含体积上限）
├── inspect-generated.py       ← 打印生成图尺寸/比例/体积 + 出一张验收总览图
├── generated/                 ← GPT 生成的设计图 + originals/ 原始 PNG 归档
├── refs/                      ← 参考截图（当前实现）
├── prompts/                   ← 三份提示词（见下）
└── samples/                   ← 早期占位资产（留作参考）
```

## 怎么用（三步）

1. **先出风格板**：打开 `prompts/01-visual-reference.md`，把"给 GPT 的上下文"+"中文提示词"发过去，附上 `refs/01-form-panel.png` 与 `palette.png`。这张定调，后面所有图对齐它。
2. **再出整站视觉稿**：用 `prompts/02-site-mockup.md`，附上 `refs/00-first-screen.png`、`01-form-panel.png`、`03-batch-panel.png`、`04-live-panel.png`、`06-mobile-form.png`。
3. **最后出真正要用的图**：用 `prompts/03-assets.md` 逐张生成，按里面写的**文件名与目录**放回 `assets/`（图标放 `assets/icons/`），我来负责转码、裁切、压缩和接到页面里。

## 几条容易翻车的点

- **生图模型特别爱写字**：所有提示词里都写了"不要任何可读文字"，一旦出现文字/乱码就重新生成，别将就。
- **比例比像素重要**：尺寸差不多就行，比例对上即可（横幅统一 8:3，背景 2:1，封面 1200×630）。
- **首屏背景必须"左空右满"**：文字压在左边，右边才是画面内容。
- **图标建议让我直接用 SVG 写**：成套图标的线宽一致性，生图模型基本做不稳，而且 SVG 更小更清晰。
- **不要在提示词里暴露项目真实用途**：现有提示词已经刻意只描述形式（布局、配色、组件、图形动机），继续沿用这个口径。

## 本地样本图（samples/）是什么

它们是我用脚本按同一套视觉规则画出来的**占位资产**：配色、线宽、圆角、构图比例都按 `prompts/03-assets.md` 的目标来。可以：

- 现在就接进页面看效果（比空着强）；
- 或者当作给 GPT 的"构图参考"（比纯文字描述更省事）；
- GPT 出图后按同名文件替换即可。

改配色或尺寸后重新生成：

```powershell
python design/make-samples.py
```

## 参考截图怎么重新生成

```powershell
node design/capture-refs.js
```

它会在无头 Chrome 里以假数据跑一遍页面（本地桥接接口被 mock 掉，不联网、不碰真实账号），然后：

- 断言新功能正常：分钟级配速、跑道内缩、轨迹不出界、手动引导点、实时轨迹动画；
- 把 `refs/` 里的截图重新拍一遍（界面改了以后重跑这个就行）。

# 提示词 1 · 视觉参考图（风格情绪板）

> 交付物：一张图，用来把"这个产品要长什么样"一次性讲清楚，后续所有图和页面都对齐它。
> 建议尺寸：**2560 × 1440**（16:9），或竖版 1600 × 2000（4:5，适合发消息）。
> 参考输入：`design/refs/00-first-screen.png`、`design/refs/01-form-panel.png`、`design/palette.png`

---

## 一、给 GPT 的上下文（先发这段）

这是一个**本地优先的数据录入工具的网页界面**。它由几块组成：顶部四步引导条、一张表单卡片（文本输入、下拉选择、两个日期时间输入、日期快捷标签、一组"速度参数"的分钟/秒选择器 + 滑块、一个数值输入）、一张可视化卡片（一块类地图面板：虚线边界多边形 + 一条平滑闭合路径 + 起点/终点标记）、一张批量任务面板（日期范围、选项、照片池、生成结果列表、进度条）、一张实时进度面板（进度条 + 指标行 + 会一点点画出来的路径图）。

它现在的样子偏"浅色纸张 + 蓝色主色 + 薄荷绿点缀"，但**排版和质感不够统一、不够高级**。我需要一张视觉参考图，把它的视觉语言定下来。**不要**在提示词里提到真实业务、机构、场景或它的实际用途，只描述形式。

---

## 二、直接粘贴给生图模型的中文提示词

```
一张产品视觉语言情绪板（design style board），主题是"浅色、克制、编辑感的数据工具界面"。

画面结构：浅象牙白到极浅蓝的细腻渐变底，带极轻的纸张颗粒质感；版面上以 12 列网格排布四组内容——
左上：一组色卡（六色，等宽圆角矩形），自上而下浅到深；
右上：两行字体样张（一行窄体粗黑标题 + 一行中性无衬线正文），只呈现字形的节奏与粗细对比，不要可读文字；
左下：三枚组件特写——一张圆角 12px 的白色卡片（1px 浅蓝灰描边、柔和长投影）、一枚实心蓝主按钮与一枚描边次按钮、一个带滑块的输入控件；
右下：一组极简线性图标（钥匙、定位、时钟、秒表、仪表盘、相机、清单、日历），统一 2px 描边、圆角端点、单色。
版面上再点缀两条极细的抽象几何线：一条平滑闭合的跑道形曲线（青绿）与一条虚线边界矩形（灰蓝），作为"数据可视化"的视觉动机。

配色（严格使用）：主蓝 #2563EB、深蓝 #0C4EB3、极浅蓝 #E8F1FF、薄荷/青绿 #2FC5A1 与深青 #0F766E、暖琥珀 #F59E0B、墨色 #11243F、次级文字 #53657A、纸张白 #FFFEFA、页面象牙 #F6F7F2、分隔线 rgba(28,76,130,0.14)。

风格：高端设计系统展示页、极干净、大量留白、柔和自然光、无强对比阴影、微妙内阴影、印刷品质感。
画面中不要出现任何可读文字、字母、数字、水印、logo、二维码、真人面孔、真实品牌元素；不要出现网页截图边框或浏览器窗口。
输出：2560×1440，PNG，边缘锐利干净。
```

---

## 三、English prompt（英文模型通常更稳，可直接用这段）

```
A product visual-language mood board for a light, restrained, editorial-style data utility web app.

Layout: a soft ivory-to-pale-blue gradient background with a very subtle paper grain; a 12-column grid holding four groups —
top-left: a small palette of six rounded swatch rectangles, light to dark;
top-right: two type specimens (a condensed heavy display line and a neutral sans-serif body line) shown only as shape and weight contrast, no readable words;
bottom-left: three component close-ups — a white card with 12px radius, 1px pale blue-grey border and a soft long shadow, a solid blue primary button next to an outlined secondary button, and an input control with a slider;
bottom-right: a row of minimal line icons (key, map pin, clock, stopwatch, gauge, camera, checklist, calendar), uniform 2px stroke, round caps, monochrome.
Add two ultra-thin abstract geometry accents: a smooth closed running-track-like curve in teal-green and a dashed boundary rectangle in slate blue, as the "data visualization" motif.

Strict palette: primary blue #2563EB, deep blue #0C4EB3, pale blue #E8F1FF, mint/teal #2FC5A1 and deep teal #0F766E, warm amber #F59E0B, ink #11243F, secondary text #53657A, paper white #FFFEFA, page ivory #F6F7F2, hairline rgba(28,76,130,0.14).

Style: premium design-system presentation sheet, extremely clean, generous whitespace, soft natural light, no harsh shadows, subtle inner shadow, print quality.
No readable text, no letters, no numbers, no watermark, no logo, no QR code, no human faces, no brand elements, no browser chrome, no page screenshot frame.
Output: 2560x1440 PNG, crisp clean edges.
```

---

## 四、负面提示词（Negative）

```
文字, 字母, 数字, 乱码文字, 水印, 签名, logo, 二维码, 真人脸, 手, 品牌标识, 浏览器窗口, 网页截图边框, 深色背景主题, 霓虹色, 高饱和渐变, 彩虹色, 3D 玻璃拟态, 强烈投影, 噪点过重, 低分辨率, 模糊, 像素锯齿, 卡通可爱风, 表情包
```

---

## 五、验收标准

- [ ] 六色色卡与给定 hex 肉眼一致（蓝为主、青绿为点缀、琥珀只做极少量强调）
- [ ] 组件特写能看清：卡片圆角约 12px、1px 描边、柔和长投影
- [ ] 字体样张能体现"窄体粗标题 + 中性正文"的对比
- [ ] 整套图标线宽一致、端点圆角、单色
- [ ] 画面里**没有任何可读文字**（生图模型最容易在这里翻车，出现文字就重生成）
- [ ] 整体是浅色、克制、留白充足，不花哨

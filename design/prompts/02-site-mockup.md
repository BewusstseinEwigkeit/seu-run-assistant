# 提示词 2 · 整站视觉样式参考图（页面级 mockup）

> 交付物：一张"整站重设计后的样子"的页面级视觉稿，用来当**布局与气质的靶子**（不是最终代码）。
> 建议尺寸：**2560 × 1600**（桌面版一张）；另出一张 **828 × 1792**（手机版一张）。
> 参考输入（务必一起发给它）：`design/refs/00-first-screen.png`、`design/refs/01-form-panel.png`、`design/refs/03-batch-panel.png`、`design/refs/04-live-panel.png`、`design/refs/06-mobile-form.png`

---

## 一、给 GPT 的上下文（先发这段）

把它当作"重新设计一个本地工具型网页"的视觉稿任务：现有实现功能齐了，但**层级、留白、卡片质感、状态色**都不够统一。我要一张桌面版 + 一张手机版的视觉稿，把下面这些区块画清楚（**不要**提真实业务、机构、用途，只按形式描述）：

1. 顶部细长条：左侧一个圆形图标 + 两行品牌文字（占位方块即可），右侧三个文字导航项 + 一个深色胶囊按钮。
2. 四步引导条：四个等宽小卡，当前步骤高亮，已完成的带小勾。
3. 主表单卡（右侧一列，宽约 5 列）：标题 + 说明、一个长文本输入框（右侧有"显示/隐藏"小按钮）、一个下拉选择、两个并排的日期时间输入、一行 3 个日期快捷标签 + 一个日期选择器、一组"分钟 + 秒"双下拉 + 一条滑块 + 一个勾选项、一个数值输入带右侧自动值文案、一条提示小字。
4. 可视化卡：一块类地图面板，浅灰底 + 一块虚线矩形边界（灰蓝）+ 一条平滑闭合曲线（青绿，线宽 2px）+ 起点圆点（青绿）与终点圆点（琥珀）+ 边界四个角上有编号的小圆点（蓝色）；面板下方一条灰色小字信息行。
5. 批量任务面板：日期范围两个输入 + "跳过周末"勾选、场地下拉 + "每天随机"勾选、时间设置勾选、同样的速度参数面板、照片池两个上传框（并排）、一个"生成全部"按钮 + 一张结果列表（每行：左侧状态圆点 + 一行摘要文字）、进度条、失败列表、底部主按钮。
6. 实时面板（折叠态 + 展开态各画一个）：展开态里有三个按钮、一行状态文字、进度条、类地图面板（只画出一小段路径 + 一个正在移动的圆点）、三行指标。
7. 右侧（或下方）一块"记录列表"只读面板：几行记录，带绿/红状态点与小字。

视觉要求：浅色纸张感、象牙白底、白卡 + 1px 浅蓝灰描边 + 柔和长投影、圆角 12px、主蓝 #2563EB，青绿 #2FC5A1 / #0F766E 只做数据与状态点缀，琥珀 #F59E0B 只做"当前位置"。所有文字用占位灰条或抽象字形代替。

---

## 二、直接粘贴给生图模型的中文提示词（桌面版）

```
一张高保真的网页 UI 视觉稿（desktop web app mockup），1440 宽栅格，浅色编辑风数据工具。

整体：象牙白页面底（#F6F7F2）＋极浅蓝雾（#E8F1FF）渐变的顶部区；白色卡片 12px 圆角、1px 浅蓝灰描边（rgba(28,76,130,0.14)）、柔和长投影；区块之间留白充足；细密的分隔线极浅。

从上到下：
1) 顶部细长条：左侧圆形图标 + 两行文字（用灰条占位），右侧三个文字导航（灰条占位）与一枚深墨色胶囊按钮（#11243F，白字占位）。
2) 四步引导条：四个等宽小卡横向排列，当前步骤卡为浅蓝底（#E8F1FF）+ 蓝色左边条，其余为白底细描边。
3) 主体两列：左列（约 7 列宽）一张大卡，里面画一块"类地图"可视化面板——浅灰底（#F6F8FB）、一块灰蓝虚线矩形边界、一条青绿色（#0F766E）平滑闭合曲线、青绿起点圆点与琥珀（#F59E0B）终点圆点、边界四角有 4 个蓝色小圆点并带编号；面板下方一行小灰字。
   右列（约 5 列宽）一张表单卡：标题 + 说明两行（灰条占位）、一个长输入框（右端有小按钮）、一个下拉选择、两个并排的日期时间输入、一行三个胶囊快捷标签（首个为蓝色实心）+ 一个日期选择器、一条滑块（蓝色已填充轨道）+ 一组"分钟/秒"双下拉 + 一个勾选框、一个数值输入框 + 右侧一行青绿色小字、最后一行灰色提示小字。
4) 下方通栏卡：左侧两个并排上传框（虚线描边、中间一个细线性上传箭头图标），右侧一张结果列表（6 行，每行一个状态圆点 + 一行灰条文字），列表下方一条细进度条（蓝色填充 100%）与一行小字。
5) 再下方一张折叠卡：左侧两行文字（灰条），右侧一个向下箭头。
6) 最底部一枚通栏蓝色主按钮。

配色严格：主蓝 #2563EB、深蓝 #0C4EB3、极浅蓝 #E8F1FF、青绿 #2FC5A1 / 深青 #0F766E、琥珀 #F59E0B、墨色 #11243F、次级文字 #53657A、纸白 #FFFEFA。
风格：干净、克制、留白多、锐利 2x 倍图观感、Dribbble 级别精修、自然柔和光、无强对比。
画面中不要出现任何可读文字、字母或数字（全部用灰条或抽象字形占位），不要水印、logo、真人、浏览器窗口边框之外的装饰。输出 2560×1600 PNG。
```

---

## 三、English prompt（桌面版）

```
A high-fidelity desktop web-app UI design mockup, 1440px grid, light editorial data-tool style.

Overall: ivory page (#F6F7F2) with a pale blue (#E8F1FF) gradient wash across the top area; white cards with 12px radius, 1px pale blue-grey hairline border rgba(28,76,130,0.14) and soft long shadows; generous spacing; extremely light divider lines.

Top to bottom:
1) A slim top bar: circular icon plus two text lines (render as grey placeholder bars), three nav text items and one dark ink pill button (#11243F) on the right.
2) A four-step guide strip: four equal small cards; the current one has a pale blue fill (#E8F1FF) with a blue left rule, others are white with hairline borders.
3) Main two-column area: the left column (~7 cols) is a large card containing a map-like visualization panel — pale grey surface (#F6F8FB), a slate dashed rectangular boundary, one smooth closed curve in deep teal (#0F766E), a teal start dot and an amber (#F59E0B) end dot, and four numbered blue dots at the boundary corners; a small grey caption line under the panel.
   The right column (~5 cols) is a form card: title + two-line description (placeholder bars), a long text input with a small inline button, a select dropdown, two side-by-side date-time inputs, a row of three pill quick-chips (first one solid blue) plus a date picker, a slider with a filled blue track, a minute/second select pair, a checkbox, a numeric input with a teal caption on its right, and a final small grey hint line.
4) A full-width card below: two side-by-side dashed upload dropzones with a thin line-art upload arrow icon, next to a 6-row result list (status dot + grey placeholder bar), a thin blue progress bar at 100% and a small caption.
5) Another collapsed card: two lines of placeholder text with a chevron on the right.
6) A full-width solid blue primary button at the very bottom.

Strict palette: blue #2563EB, deep blue #0C4EB3, pale blue #E8F1FF, mint/teal #2FC5A1 / #0F766E, amber #F59E0B, ink #11243F, secondary #53657A, paper white #FFFEFA.
Style: clean, restrained, whitespace-heavy, crisp 2x rendering, Dribbble-grade polish, soft natural light, no harsh contrast.
Absolutely no readable text, letters or numbers anywhere (use grey bars and abstract glyph shapes), no watermark, no logo, no people, no OS/browser chrome. Output 2560x1600 PNG.
```

---

## 四、手机版（828 × 1792）

```
基于上面的视觉语言，改画一份手机端视觉稿：单列布局、卡片满宽、圆角 12px；顺序为 顶部细条 → 四步引导条（横向可滑动的四个小卡）→ 表单卡（输入框与下拉满宽、两个日期时间上下堆叠、三个快捷标签一行）→ 速度参数面板（双下拉 + 滑块 + 勾选项）→ 类地可视化面板（正方形，虚线边界 + 青绿闭合曲线 + 起终点圆点）→ 结果列表卡 → 底部固定的蓝色通栏主按钮（带 8px 安全边距）。所有文字用灰条占位，不要任何可读文字。
```

---

## 五、负面提示词（Negative）

```
可读文字, 字母, 数字, 乱码, 水印, logo, 二维码, 真人, 手, 表情包, 深色主题, 霓虹, 高饱和渐变, 玻璃拟态, 强烈投影, 3D 立体按钮, 过度装饰, 花哨插画, 阴影方向混乱, 元素重叠, 对齐不齐, 低分辨率, 模糊, 浏览器地址栏, 操作系统窗口
```

---

## 六、验收标准

- [ ] 区块齐全且顺序正确：顶栏 → 四步条 → 表单卡 + 地图卡 → 结果/进度卡 → 折叠卡 → 主按钮
- [ ] 卡片统一 12px 圆角 + 1px 浅描边 + 柔和长投影，没有"有的重有的轻"
- [ ] 主色只用蓝；青绿只出现在曲线/数值；琥珀只出现在"终点/当前位置"
- [ ] 地图面板里：虚线边界**完整包住**闭合曲线（曲线的圈明显小于边界），这代表"路径在允许范围内"
- [ ] 全图无任何可读文字
- [ ] 手机版没有横向溢出，底部主按钮固定可见

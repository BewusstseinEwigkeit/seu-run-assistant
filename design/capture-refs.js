/*
 * 一次性脚本：验证新功能（分钟级配速 / 实时跑操轨迹动画 / 手动引导点），
 * 并把设计参考截图落到 design/refs/。
 * 用法：node design/capture-refs.js
 */
const { chromium } = require('playwright');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const PAGE_URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
const REFS = path.join(ROOT, 'design', 'refs');
const TEST_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoidGVzdC11c2VyIiwiZXhwIjoxNzkyNjAyNTcyLCJuYmYiOjE3OTAwMTA1NzJ9.signature';
const WHITE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAI0lEQVR4nGP89esXAymAiSTVDKMaiANMRKqDg1ENxACSQwkAJ5sDDoQWAdsAAAAASUVORK5CYII=', 'base64');
const DARK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAI0lEQVR4nGPk4OBgIAUwkaSaYVQDcYCJSHVwMKqBGEByKAEAfWAAOF8xZ3AAAAAASUVORK5CYII=', 'base64');

const RULES = {
  code: 200, success: true,
  data: [{
    ruleId: 'r1', routeRule: '2026~2027学年1学期锻炼任务', minTime: '4', maxTime: '12',
    minPace: '3.3333', maxPace: '10', standardKilometre: '1.2',
    ruleStartTime: '06:00:00', ruleEndTime: '22:30:00',
    plans: [
      { planId: 'p1', routeName: '九龙湖-桃园田径场', routeKilometre: 1.2, latlngs: rect(31.8896, 118.8288, 205, 116) },
      { planId: 'p2', routeName: '九龙湖-梅园田径场', routeKilometre: 1.2, latlngs: rect(31.8832, 118.8289, 189, 113) },
      { planId: 'p3', routeName: '四牌楼-四牌楼田径场', routeKilometre: 1.2, latlngs: rect(32.0569, 118.7921, 173, 114) }
    ]
  }]
};

// 以 (lat,lng) 为中心的矩形场地（米）→ 经纬度角点
function rect(lat, lng, heightM, widthM) {
  const latM = 111320, lngM = 111320 * Math.cos(lat * Math.PI / 180);
  const dLat = (heightM / 2) / latM, dLng = (widthM / 2) / lngM;
  return [
    { lat: lat - dLat, lng: lng - dLng },
    { lat: lat - dLat, lng: lng + dLng },
    { lat: lat + dLat, lng: lng + dLng },
    { lat: lat + dLat, lng: lng - dLng }
  ];
}

async function mockApi(page, captured) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
  await page.route('https://worldtimeapi.org/**', (r) => r.abort());
  await page.route('http://127.0.0.1:17864/api/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors, body: '' }); return; }
    let body = { code: 200, success: true, data: {} };
    if (url.indexOf('listRule') >= 0) body = RULES;
    else if (url.indexOf('getRecordByMonthOrWeek') >= 0) body = { code: 200, success: true, data: { recordList: [] } };
    else if (url.indexOf('uploadRecordImageStart') >= 0) body = { code: 200, success: true, msg: 'https://example.invalid/start.jpg', data: {} };
    else if (url.indexOf('uploadRecordImageEnd') >= 0) body = { code: 200, success: true, msg: 'https://example.invalid/end.jpg', data: {} };
    else if (url.indexOf('saveStartRecord') >= 0) body = { code: 200, success: true, data: { id: 'record-1' } };
    else if (url.indexOf('saveRecord') >= 0) body = { code: 200, success: true, data: null };
    if (captured) captured.push({ url, method: req.method(), body: req.postData() || '' });
    await route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function setup(page) {
  const captured = [];
  await mockApi(page, captured);
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(PAGE_URL);
  await page.locator('#input-token').fill(`bearer ${TEST_JWT}`);
  await page.locator('#tab-run').click();
  await page.locator('#input-image_start').setInputFiles({ name: 'start.png', mimeType: 'image/png', buffer: WHITE_PNG });
  await page.locator('#input-image_end').setInputFiles({ name: 'end.png', mimeType: 'image/png', buffer: WHITE_PNG });
  await page.locator('#batch-image_start-pool').setInputFiles([
    { name: 'IMG_1005_0712.jpg', mimeType: 'image/png', buffer: WHITE_PNG },
    { name: 'IMG_1007_2105.jpg', mimeType: 'image/png', buffer: DARK_PNG }
  ]);
  await page.locator('#batch-image_end-pool').setInputFiles([
    { name: 'IMG_1007_2112.jpg', mimeType: 'image/png', buffer: DARK_PNG }
  ]);
  await page.waitForTimeout(600);
  return captured;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  → ' + detail : ''));
}

// 弹出提示会盖住整页（#overlay），真实点击前要先关掉
async function dismissAlert(page) {
  const ok = page.locator('#ml_Alert_Ok');
  if (await ok.isVisible().catch(() => false)) {
    await ok.click().catch(() => {});
  }
}

(async () => {
  fs.mkdirSync(REFS, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await setup(page);

  // ---------- 1. 分钟级配速控件 ----------
  await page.locator('#select-route_info').selectOption('p1');
  const paceUi = await page.evaluate(() => {
    const minute = document.getElementById('input-pace-minute');
    const second = document.getElementById('input-pace-second');
    return {
      minuteOptions: Array.from(minute.options).map((o) => o.value),
      secondOptions: Array.from(second.options).map((o) => o.value),
      hint: document.getElementById('pace-hint').textContent,
      sliderMin: document.getElementById('input-pace').min,
      sliderMax: document.getElementById('input-pace').max
    };
  });
  check('配速「分」可选 3~10', /^3$/.test(paceUi.minuteOptions[0]) && /^10$/.test(paceUi.minuteOptions[paceUi.minuteOptions.length - 1]), JSON.stringify(paceUi.minuteOptions));
  check('配速「秒」按 5 秒步长且贴合边界', paceUi.secondOptions[0] === '0' && paceUi.secondOptions.indexOf('20') >= 0, JSON.stringify(paceUi.secondOptions.slice(0, 4)));
  check('配速提示给出可选区间', paceUi.hint.indexOf("3'20''") >= 0 && paceUi.hint.indexOf("10'00''") >= 0, paceUi.hint);

  // 选固定配速 6 分 00 秒
  await page.locator('#pace-random').uncheck();
  await page.evaluate(() => {
    const minute = document.getElementById('input-pace-minute');
    const second = document.getElementById('input-pace-second');
    minute.value = '6';
    second.value = '0';
    minute.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const fixedPace = await page.evaluate(() => ({
    seconds: window.ml_pace_seconds_for_plan(),
    label: document.getElementById('pace-value-label').textContent,
    batchLabel: document.getElementById('pace-value-label-batch').textContent
  }));
  check('固定配速 6 分生效并同步到批量页', fixedPace.seconds === 360 && fixedPace.label.indexOf("6'00''") >= 0 && fixedPace.batchLabel.indexOf("6'00''") >= 0, JSON.stringify(fixedPace));

  // ---------- 2. 按所选配速生成，时长/里程/配速自洽 ----------
  const generated = await page.evaluate(async () => {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const ymd = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
    const out = await window.ml_generate_time_and_track(ymd);
    const meta = window.ml_student_choose_route_data.metadata;
    return {
      durationSeconds: out.durationSeconds,
      distanceKm: meta.totalDistance / 1000,
      paceSeconds: meta.paceSecondsPerKm,
      lapPerimeter: meta.lapPerimeterMeters,
      lapCount: meta.lapCount,
      inset: meta.trackInsetMeters,
      insetAuto: meta.trackInsetIsAuto,
      clearance: meta.minClearanceMeters,
      points: out.track.length,
      inside: out.track.every((p) => window.ml_isPointInPolygon(p.lat, p.lng, window.ml_boundary_cache['p1'].paths))
    };
  });
  const impliedPace = generated.durationSeconds / generated.distanceKm;
  check('所选配速 6 分 = 时长 ÷ 里程', Math.abs(impliedPace - 360) <= 3, `时长 ${generated.durationSeconds}s / 里程 ${generated.distanceKm.toFixed(2)}km = ${(impliedPace / 60).toFixed(2)} 分/km`);
  check('自动内缩把单圈收到 400m 量级', generated.lapPerimeter > 360 && generated.lapPerimeter < 460, `单圈 ${Math.round(generated.lapPerimeter)}m × ${generated.lapCount} 圈，内缩 ${generated.inset.toFixed(1)}m`);
  check('轨迹全部落在限制范围内且留有余量', generated.inside && generated.clearance > 3, `离边界最近 ${generated.clearance.toFixed(1)}m，${generated.points} 个点`);
  check('里程不低于标准里程 1.2km', generated.distanceKm >= 1.2, `${generated.distanceKm.toFixed(3)} km`);

  // ---------- 3. 手动引导点 ----------
  await page.locator('#manual-guide').check();
  await page.locator('#ml_Alert_Ok').click().catch(() => {});
  const guide = await page.evaluate(() => {
    const svg = document.getElementById('track-preview');
    const box = svg.getBoundingClientRect();
    const view = window.ml_current_track_view;
    const scale = Math.min(box.width / view.vbW, box.height / view.vbH);
    const offX = (box.width - view.vbW * scale) / 2;
    const offY = (box.height - view.vbH * scale) / 2;
    const boundary = window.ml_boundary_cache['p1'].paths;
    const lats = boundary.map((p) => p.lat), lngs = boundary.map((p) => p.lng);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    // 在场地中心周围点出一个"内圈"：四个点各距中心 35m
    const latM = 111320, lngM = 111320 * Math.cos(midLat * Math.PI / 180);
    const ring = [
      { lat: midLat - 35 / latM, lng: midLng - 48 / lngM },
      { lat: midLat - 35 / latM, lng: midLng + 48 / lngM },
      { lat: midLat + 35 / latM, lng: midLng + 48 / lngM },
      { lat: midLat + 35 / latM, lng: midLng - 48 / lngM }
    ];
    ring.forEach((p) => {
      const c = window.ml_track_view_project(view, p);
      svg.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        clientX: box.left + offX + c.x * scale,
        clientY: box.top + offY + c.y * scale
      }));
    });
    return { count: window.ml_active_waypoints().length };
  });
  check('点击预览图能加引导点', guide.count === 4, `${guide.count} 个点`);

  const guided = await page.evaluate(async () => {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 2);
    const ymd = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
    const out = await window.ml_generate_time_and_track(ymd);
    const meta = window.ml_student_choose_route_data.metadata;
    const boundary = window.ml_boundary_cache['p1'].paths;
    // 引导点围成的小圈：轨迹点应该都离场地中心不远（说明按引导走，而不是贴着外圈）
    const lats = boundary.map((p) => p.lat), lngs = boundary.map((p) => p.lng);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const latM = 111320;
    const maxOffsetM = Math.max.apply(null, out.track.map((p) => Math.abs(p.lat - midLat) * latM));
    return { guided: meta.guidedByWaypoints, guideCount: meta.guidePointCount, lap: meta.lapPerimeterMeters, maxOffsetM, inside: out.track.every((p) => window.ml_isPointInPolygon(p.lat, p.lng, boundary)) };
  });
  check('引导点 ≥3 时按引导路线生成', guided.guided === true && guided.guideCount === 4, `引导 ${guided.guideCount} 点，单圈 ${Math.round(guided.lap)}m`);
  check('引导后的圈明显小于限制范围且不出界', guided.maxOffsetM < 60 && guided.inside, `轨迹离中心最远 ${guided.maxOffsetM.toFixed(0)}m`);

  // ---------- 截图：运行面板（含引导点）----------
  await dismissAlert(page);
  await page.locator('#select-route_info').scrollIntoViewIfNeeded();
  const heroPanelShot = page.locator('#hero-quick-panel');
  if (await heroPanelShot.count()) {
    await heroPanelShot.screenshot({ path: path.join(REFS, '09-form-panel-guided.png') }).catch(() => {});
  }

  // 清掉引导点，回到默认（自动内缩）状态再截首屏
  await page.locator('#ml_Alert_Ok').click().catch(() => {});
  await page.locator('#btn-clear-waypoints').click({ timeout: 5000 }).catch(() => {
    console.log('（清空按钮点不到，改用状态直接清）');
  });
  await page.evaluate(() => { window.ml_clear_waypoints(); document.getElementById('manual-guide').checked = false; });

  // ---------- 4. 实时跑操：轨迹一点点画出来 ----------
  await dismissAlert(page);
  await page.locator('#live-run-details > summary').click();
  await page.locator('#btn-live-start').click();
  await page.waitForTimeout(1500);
  await dismissAlert(page);
  await page.waitForTimeout(3500);
  const liveEarly = await page.evaluate(() => {
    const polyline = document.querySelector('#live-track-preview polyline');
    return {
      points: polyline ? polyline.getAttribute('points').split(' ').length : 0,
      meta: document.getElementById('live-track-meta').textContent,
      metrics: document.getElementById('live-metrics').textContent,
      status: document.getElementById('live-status').textContent
    };
  });
  await page.waitForTimeout(5000);
  const liveLater = await page.evaluate(() => {
    const polyline = document.querySelector('#live-track-preview polyline');
    return {
      points: polyline ? polyline.getAttribute('points').split(' ').length : 0,
      meta: document.getElementById('live-track-meta').textContent
    };
  });
  check('实时跑操会画出轨迹点', liveEarly.points > 2, `已画 ${liveEarly.points} 个点`);
  check('实时地图随时间继续生长', liveLater.points > liveEarly.points, `${liveEarly.points} → ${liveLater.points} 个点`);
  check('实时面板同时显示进度数值', liveEarly.metrics.indexOf('已跑距离') >= 0, liveEarly.status.slice(0, 40));
  await page.locator('#live-run-details').screenshot({ path: path.join(REFS, '04-live-panel.png') });
  await page.evaluate(() => { ml_live_state.abortRequested = true; ml_live_stop(); });

  // ---------- 截图：整体布局与各面板 ----------
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(REFS, '00-first-screen.png') });
  const heroPanel = page.locator('#hero-quick-panel');
  if (await heroPanel.count()) {
    await heroPanel.screenshot({ path: path.join(REFS, '01-form-panel.png') });
  }
  const previewWrap = page.locator('#track-preview-wrap');
  if (await previewWrap.isVisible().catch(() => false)) {
    await previewWrap.screenshot({ path: path.join(REFS, '08-track-preview.png') });
  }
  const workbench = page.locator('#workbench');
  if (await workbench.count()) {
    await workbench.screenshot({ path: path.join(REFS, '02-photo-review.png') }).catch(() => {});
  }
  await page.locator('#tab-batch').click();
  await page.locator('#batch-start-date').fill(await shiftDate(page, -6));
  await page.locator('#batch-end-date').fill(await shiftDate(page, 0));
  await page.locator('#btn-generate-batch-plans').click();
  await page.waitForTimeout(1200);
  await dismissAlert(page);
  await page.locator('#batch-area').screenshot({ path: path.join(REFS, '03-batch-panel.png') });
  await page.locator('#tab-guide').click();
  await page.locator('#guide-area').screenshot({ path: path.join(REFS, '05-guide.png') });

  await page.setViewportSize({ width: 414, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#tab-run').click();
  await page.screenshot({ path: path.join(REFS, '06-mobile-form.png') });
  await page.locator('#tab-batch').click();
  await page.screenshot({ path: path.join(REFS, '07-mobile-batch.png') });

  console.log('\n截图输出目录: ' + REFS);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n验证 ${results.length - failed.length}/${results.length} 通过`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})();

async function shiftDate(page, offsetDays) {
  return await page.evaluate((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }, offsetDays);
}

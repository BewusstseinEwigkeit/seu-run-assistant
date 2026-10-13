let testApi;
try {
  testApi = require('@playwright/test');
} catch (error) {
  testApi = require('playwright/test');
}
const { test, expect } = testApi;
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Synthetic JWT only: keeps the regression test offline and free of credentials.
const TEST_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoidGVzdC11c2VyIiwiZXhwIjoxNzkyNjAyNTcyLCJuYmYiOjE3OTAwMTA1NzJ9.signature';

test.use({ channel: 'chrome' });

const PAGE_URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

// 两张纯色小图：白=白天照片，深色=夜间照片。用来验证照片池的明暗度匹配。
const WHITE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAI0lEQVR4nGP89esXAymAiSTVDKMaiANMRKqDg1ENxACSQwkAJ5sDDoQWAdsAAAAASUVORK5CYII=', 'base64');
const DARK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAI0lEQVR4nGPk4OBgIAUwkaSaYVQDcYCJSHVwMKqBGEByKAEAfWAAOF8xZ3AAAAAASUVORK5CYII=', 'base64');

function imageFile(name, buffer) {
  return { name: name, mimeType: 'image/png', buffer: buffer };
}

// 服务端 listRule 的两块矩形场地（真实的 latlngs 就是这种粗角点）
const TEST_RULES = {
  code: 200,
  success: true,
  data: [{
    ruleId: 'r1',
    routeRule: '2026~2027学年1学期锻炼任务',
    minTime: '4',
    maxTime: '12',
    minPace: '3.3333',
    maxPace: '10',
    standardKilometre: '1.2',
    ruleStartTime: '06:00:00',
    ruleEndTime: '22:30:00',
    plans: [{
      planId: 'p1',
      routeName: '测试桃园田径场',
      routeKilometre: 1.2,
      latlngs: [
        { lat: 31.8890, lng: 118.8280 },
        { lat: 31.8890, lng: 118.8300 },
        { lat: 31.8910, lng: 118.8300 },
        { lat: 31.8910, lng: 118.8280 }
      ]
    }, {
      planId: 'p2',
      routeName: '测试梅园田径场',
      routeKilometre: 1.2,
      latlngs: [
        { lat: 31.8830, lng: 118.8288 },
        { lat: 31.8830, lng: 118.8300 },
        { lat: 31.8846, lng: 118.8300 },
        { lat: 31.8846, lng: 118.8288 }
      ]
    }]
  }]
};

// 桥接服务的假实现：转发接口全部拦下来，只回固定数据。
// 需要预检（blade-requested-with / miniappversion 这类非白名单头）时也要能通过，
// 所以 OPTIONS 单独回一次带 CORS 头的 204。
async function mockBridgeApi(page, captured) {
  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  };
  await page.route('http://127.0.0.1:17864/api/**', async (route) => {
    const request = route.request();
    const url = request.url();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
      return;
    }
    let body = { code: 200, success: true, data: {} };
    if (url.indexOf('listRule') >= 0) {
      body = TEST_RULES;
    } else if (url.indexOf('getRecordByMonthOrWeek') >= 0) {
      body = { code: 200, success: true, data: { recordList: [] } };
    } else if (url.indexOf('uploadRecordImageStart') >= 0) {
      body = { code: 200, success: true, msg: 'https://example.invalid/start.jpg', data: {} };
    } else if (url.indexOf('uploadRecordImageEnd') >= 0) {
      body = { code: 200, success: true, msg: 'https://example.invalid/end.jpg', data: {} };
    } else if (url.indexOf('saveStartRecord') >= 0) {
      body = { code: 200, success: true, data: { id: 'record-1' } };
    } else if (url.indexOf('saveRecord') >= 0) {
      body = { code: 200, success: true, data: null };
    }
    if (captured) {
      captured.push({
        url: url,
        method: request.method(),
        body: request.postData() || '',
        headers: request.headers()
      });
    }
    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });
}

// 过去 N 天的日期（不含今天），避免"禁止提前跑"影响断言
async function pastDates(page, days) {
  return await page.evaluate((count) => {
    const out = [];
    for (let i = count; i >= 1; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    }
    return out;
  }, days);
}

async function selectBatchRange(page, dates) {
  await page.locator('#batch-start-date').fill(dates[0]);
  await page.locator('#batch-end-date').fill(dates[dates.length - 1]);
  await page.locator('#batch-skip-weekends').uncheck();
}

test('首屏实际表单与大图教程在桌面和手机均可读', async ({ page }) => {
  const pageUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('http://127.0.0.1:17864/health', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
  });
  await page.goto(pageUrl);

  await expect(page.locator('#hero-seu-entry')).toHaveCount(0);
  await expect(page.locator('.hero-network-note')).toContainText('网页不能替你启动 .bat');
  await expect(page.locator('.hero-flow-step')).toHaveCount(4);
  await expect(page.locator('.hero-flow-step.is-current')).toHaveCount(1);
  await expect(page.locator('#hero-extract-token')).toBeVisible();
  await expect(page.locator('#token-bridge-status')).toHaveAttribute('role', 'status');
  await expect(page.locator('#token-bridge-status')).toContainText('本地桥接服务未启动');
  await page.route('http://127.0.0.1:17864/scan', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, token: TEST_JWT, copied: true })
    });
  });
  // 场地表由服务端 listRule 下发；填入 Token 后页面会拉取。返回一个假场地，
  // 否则下拉框保持占位（route 为空），flow step 会卡在"填写"一步。
  await page.route('http://127.0.0.1:17864/api/**', async (route) => {
    if (route.request().url().indexOf('listRule') >= 0) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200, success: true,
          data: [{
            ruleId: 'r1', routeRule: '测试锻炼任务', minTime: '4', maxTime: '12',
            minPace: '3.3333', maxPace: '10', standardKilometre: '1.2',
            ruleStartTime: '06:00:00', ruleEndTime: '22:30:00',
            plans: [{
              planId: 'p1', routeName: '测试田径场', routeKilometre: 1.2,
              latlngs: [{ lat: 31.889, lng: 118.828 }, { lat: 31.889, lng: 118.830 }, { lat: 31.891, lng: 118.830 }, { lat: 31.891, lng: 118.828 }]
            }]
          }]
        })
      });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, success: true, data: {} }) });
    }
  });
  await page.locator('#hero-extract-token').click();
  await expect(page.locator('#input-token')).toHaveValue(TEST_JWT);
  await expect(page.locator('#token-bridge-status')).toContainText('Token 已提取并填入当前页面');
  // 场地表由服务端下发（mock 的 planId 是 p1），等它加载完再做后续断言；
  // 下拉框初始是空占位，场地没加载时 flow step 2 不会进入完成态
  await expect(page.locator('#select-route_info')).toHaveValue('p1', { timeout: 8000 });
  await expect(page.locator('.date-chip[data-date-offset="0"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.date-chip[data-date-offset="0"]')).toHaveClass(/is-selected/);
  await expect(page.locator('#hero-quick-panel #input-token')).toBeVisible();
  await expect(page.locator('#consistency-details')).not.toHaveAttribute('open', '');
  await expect(page.locator('.photo-upload-zone')).toHaveCount(2);
  await expect(page.locator('#preview-image_start')).toHaveAttribute('data-file-target', 'input-image_start');
  await expect(page.locator('.date-chip')).toHaveCount(3);
  await expect(page.locator('#exercise-date-picker')).toBeVisible();
  await page.locator('[data-date-offset="-1"]').click();
  const selectedDate = await page.locator('#exercise-date-picker').inputValue();
  const selectedTimes = await page.evaluate(() => ({
    start: document.querySelector('#exercise-start_time').value.slice(0, 10),
    end: document.querySelector('#exercise-end_time').value.slice(0, 10)
  }));
  expect(selectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(selectedTimes.start).toBe(selectedDate);
  expect(selectedTimes.end).toBe(selectedDate);
  await page.locator('#btn-generate-all').click();
  await expect(page.locator('#ml_Alert_Ok')).toBeVisible();
  await expect(page.locator('#exercise-date-picker')).toHaveValue(selectedDate);
  const randomizedDate = await page.locator('#exercise-start_time').inputValue();
  expect(randomizedDate.slice(0, 10)).toBe(selectedDate);
  await expect(page.locator('.date-chip[data-date-offset="-1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.date-chip[data-date-offset="-1"]')).toHaveClass(/is-selected/);
  await expect(page.locator('.date-chip[data-date-offset="0"]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#ml_Alert_Ok').click();
  await page.locator('#consistency-details > summary').click();
  await expect(page.locator('#consistency-enable-auto-check')).toBeChecked();
  await page.locator('#consistency-details > summary').click();
  await expect(page.locator('#consistency-enable-auto-check')).not.toBeChecked();

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('#preview-image_start').click();
  const fileChooser = await fileChooserPromise;
  expect(fileChooser.isMultiple()).toBe(false);
  await fileChooser.setFiles({
    name: 'start.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  });
  await expect(page.locator('#input-image_start')).toHaveValue(/start\.png/);

  await page.locator('#input-token').fill('bearer placeholder.token.value');
  await expect(page.locator('.hero-flow-step[data-flow-step="1"]')).toHaveClass(/is-complete/);
  await expect(page.locator('.hero-flow-step[data-flow-step="2"]')).toHaveClass(/is-complete/);
  await expect(page.locator('.hero-flow-step[data-flow-step="3"]')).toHaveClass(/is-current/);

  await page.locator('#input-image_end').setInputFiles({
    name: 'end.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  });
  await expect(page.locator('.hero-flow-step[data-flow-step="3"]')).toHaveClass(/is-complete/);
  await expect(page.locator('.hero-flow-step[data-flow-step="4"]')).toHaveClass(/is-current/);
  await expect(page.locator('.hero-flow-step[data-flow-step="4"]')).not.toHaveClass(/is-complete/);
  await page.evaluate(() => window.ml_set_run_submit_status('运动记录提交成功。', 'success'));
  await expect(page.locator('.hero-flow-step[data-flow-step="4"]')).toHaveClass(/is-complete/);
  await page.locator('#exercise-end_time').fill(await page.locator('#exercise-end_time').inputValue());
  await expect(page.locator('.hero-flow-step[data-flow-step="4"]')).not.toHaveClass(/is-complete/);

  const typography = await page.evaluate(() => ({
    bodyFamily: getComputedStyle(document.body).fontFamily,
    displayFamily: getComputedStyle(document.querySelector('.hero-brand-title')).fontFamily,
    displaySize: parseFloat(getComputedStyle(document.querySelector('.hero-brand-title')).fontSize)
  }));
  expect(typography.bodyFamily).toContain('Noto Sans SC Local');
  expect(typography.displayFamily).toContain('Barlow Condensed Local');
  expect(typography.displaySize).toBeGreaterThanOrEqual(72);

  await page.locator('#hero-start-tool').click();
  await expect(page.locator('#tab-run')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#input-token')).toBeFocused();
  await expect(page.locator('#run-submit-status')).toHaveAttribute('role', 'status');
  await expect(page.locator('#run-submit-status')).toHaveAttribute('aria-live', 'polite');

  await page.locator('#tab-guide').click();
  await expect(page.locator('#project-reference-strip .reference-shot img')).toHaveCount(4);
  const firstReferenceSize = await page.locator('#project-reference-strip .reference-shot img').first().boundingBox();
  expect(firstReferenceSize.width).toBeGreaterThanOrEqual(560);

  const referenceImages = page.locator('#project-reference-strip .reference-shot img');
  for (let index = 0; index < await referenceImages.count(); index += 1) {
    await referenceImages.nth(index).scrollIntoViewIfNeeded();
    await expect.poll(() => referenceImages.nth(index).evaluate((image) => (
      image.complete && image.naturalWidth > 0
    ))).toBe(true);
  }
  const referenceRatios = await referenceImages.evaluateAll((images) => (
    images.map((image) => {
      const bounds = image.getBoundingClientRect();
      return {
        natural: image.naturalWidth / image.naturalHeight,
        rendered: bounds.width / bounds.height
      };
    })
  ));
  referenceRatios.forEach(({ natural, rendered }) => {
    expect(Math.abs(rendered - natural)).toBeLessThan(0.03);
  });

  const smallestHelperText = await page.locator('.guide-note, .security-note, .reference-caption small').evaluateAll((elements) => (
    Math.min(...elements.map((element) => parseFloat(getComputedStyle(element).fontSize)))
  ));
  expect(smallestHelperText).toBeGreaterThanOrEqual(13);

  await page.locator('#project-reference-strip .reference-shot').first().click();
  await expect(page.locator('#image-lightbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#image-lightbox')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl);
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('新 Blade-Auth bearer Token 格式可通过本地校验', async ({ page }) => {
  const pageUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
  await page.goto(pageUrl);

  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  expect(html).not.toMatch(/['\"](?:xweb_xhr|Sec-Fetch-[^'\"]+)['\"]\s*:/);
  expect(html).toContain('/api/blade-exercise/exerciseRecord/getStudentInfo');
  expect(html).toContain('/api/blade-exercise/v2/exerciseRecord');
  expect(html).toContain('ml_exercise_record_api + "/saveStartRecord"');
  expect(html).toContain('ml_exercise_record_api + "/saveRecord"');
  expect(html).not.toContain('/api/miniapp/student/checkToken');
  expect(html).toContain('ml_student_tenant_id || ml_system_info.tenant');
  expect(html).toContain('服务端拒绝了当前微信会话凭证（401）');
  // 小程序真实发送的请求头：OAuth 客户端凭据 + blade-requested-with + Blade-Auth
  expect(html).toContain('"Basic d2VjaGF0OndlY2hhdF9zZWNyZXQ="');
  expect(html).toContain('"blade-requested-with": ml_requested_with');
  // 图片上传走 v1 前缀，接口名是 uploadRecordImageStart / End
  expect(html).toContain('ml_exercise_upload_api + "/" + ml_api_name');
  expect(html).toContain('ml_api_name = "uploadRecordImageStart"');
  expect(html).toContain('ml_api_name = "uploadRecordImageEnd"');
  // 写接口必须经过加密请求包装
  expect(html).toContain('await ml_encrypted_post(');
  // 图片地址在 msg 里（data 是空对象 {}），取错字段会让 startImage 变成对象，
  // 服务端报 "Cannot deserialize value of type java.lang.String from Object value"
  expect(html).toContain('typeof response_json_data.msg === "string"');
  expect(html).toContain('throw new Error("上传图片失败：接口未返回照片地址")');
  // 内置场地表的 rule_id / plan_id 属于旧部署，提交前必须用服务端 listRule 覆盖，
  // 否则 saveStartRecord 会因为查不到规则返回 500 服务器异常
  expect(html).toContain('ml_build_route_tables_from_rules');
  expect(html).toContain('await ml_load_route_data_from_server(');
  expect(html).toContain('ml_sync_route_selects');
  // saveRecord 成功时 data 是 null / {}，拿它当成功标志会把成功当成失败
  expect(html).not.toContain('return response_json_data.data;');
  expect(html).toContain('console.log("saveRecord 响应:"');
  // 模拟间隔可调（默认 5 秒），单次与批量共用；旧的固定长等待已移除
  expect(html).toContain('id="input-simulated-delay"');
  expect(html).toContain('id="input-simulated-delay-batch"');
  expect(html).not.toContain('60 + Math.random() * 120');
  expect(html).not.toContain('8000 + Math.floor(Math.random() * 17000)');
  // 时间与轨迹合并成一键生成，且两者必须自洽
  expect(html).not.toContain('id="btn-random-track"');
  expect(html).not.toContain('id="btn-random-time"');
  expect(html).toContain('id="btn-generate-all"');
  expect(html).toContain('ml_generate_time_and_track');
  // 历史记录：提交前按天查重
  expect(html).toContain('getRecordByMonthOrWeek');
  expect(html).toContain('ml_find_existing_record');
  expect(html).toContain('当天已有记录');

  const tokenInput = page.locator('#input-token');
  const validationMessage = page.locator('#token-validation-message');
  await tokenInput.fill(`bearer ${TEST_JWT}`);
  await expect(validationMessage).toBeHidden();

  await page.locator('#tab-batch').click();
  const batchTokenInput = page.locator('#input-token-batch');
  const batchValidationMessage = page.locator('#token-validation-message-batch');
  await batchTokenInput.fill(`| Blade-Auth | bearer ${TEST_JWT} |`);
  await expect(batchValidationMessage).toBeHidden();
});

test('请求头与请求体加解密与小程序实现一致', async ({ page }) => {
  const pageUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
  await page.goto(pageUrl);

  const headers = await page.evaluate(() => window.ml_api_headers(`bearer ${'a.b.c'}`));
  expect(headers['Authorization']).toBe('Basic d2VjaGF0OndlY2hhdF9zZWNyZXQ=');
  expect(headers['blade-requested-with']).toBe('BladeHttpRequest');
  expect(headers['Blade-Auth']).toBe('bearer a.b.c');
  // 小程序从不发送 Tenant-Id，租户由 Token 自身携带
  expect(headers['Tenant-Id']).toBeUndefined();

  const crypto = await page.evaluate(async () => {
    const plainAscii = '{"a":1}';
    const plainChinese = `{"routeName":"九龙湖-桃园田径场","nowStatus":0,"speed":"0'00''"}`;
    return {
      ascii: await window.ml_aes_encrypt(plainAscii),
      chinese: await window.ml_aes_encrypt(plainChinese),
      roundTrip: (await window.ml_aes_decrypt(await window.ml_aes_encrypt(plainChinese))) === plainChinese
    };
  });

  // 固定密钥 + 固定 IV，密文必须是确定值；期望值由小程序的 crypto-js 实现生成
  expect(crypto.ascii).toBe('Z3cqNf4gCJDnin5PTUUr3A==');
  expect(crypto.chinese).toBe('KxyWzm0xwFctJP4Pqr6KRR0Y5KpLQ0WzYLzW4IEOY5IYw7gQ/UPr8u7GIlW/DNRBN9YuWRtvMpsyybjHGp6F8Kv/8M8VcWg7R0naqxYbtyM=');
  expect(crypto.roundTrip).toBe(true);
});

test('模拟间隔可调，单次与批量保持同步', async ({ page }) => {
  const pageUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
  await page.goto(pageUrl);

  const main = page.locator('#input-simulated-delay');
  const batch = page.locator('#input-simulated-delay-batch');
  await expect(main).toHaveValue('5');
  await expect(batch).toHaveValue('5');

  // 单次页面改值 → 批量页面跟着变
  await main.fill('0');
  expect(await batch.inputValue()).toBe('0');
  expect(await page.evaluate(() => window.ml_simulated_delay_ms())).toBe(0);

  // 切到批量页面改值 → 单次页面跟着变
  await page.locator('#tab-batch').click();
  await batch.fill('3');
  expect(await main.inputValue()).toBe('3');
  const delayMs = await page.evaluate(() => window.ml_simulated_delay_ms());
  expect(delayMs).toBeGreaterThanOrEqual(3000);
  expect(delayMs).toBeLessThan(5200);

  // 非法值回落到默认 5 秒
  await batch.fill('-4');
  expect(await main.inputValue()).toBe('5');
});

test('一键生成的时间与轨迹自洽（时长=距离×配速，且点在场地内）', async ({ page }) => {
  const pageUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
  await page.goto(pageUrl);

  const result = await page.evaluate(async () => {
    const planId = 'test-plan';
    const polygon = [
      { lat: 31.8890, lng: 118.8280 },
      { lat: 31.8890, lng: 118.8300 },
      { lat: 31.8910, lng: 118.8300 },
      { lat: 31.8910, lng: 118.8280 }
    ];
    window.ml_boundary_cache[planId] = { paths: polygon };
    window.ml_choose_route_data = {
      plan_id: planId,
      route_name: '测试场地',
      min_time: 4,
      max_time: 12,
      min_pace: 3.3333,
      max_pace: 10,
      route_distance_km: 1.2,
      rule_start_time: '06:00:00',
      rule_end_time: '22:30:00'
    };
    // 用昨天的日期：生成器禁止产出未来时间，用今天会依赖测试运行时刻
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ymd = yesterday.getFullYear() + '-' +
      String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
      String(yesterday.getDate()).padStart(2, '0');
    const outcome = await window.ml_generate_time_and_track(ymd);
    const start = document.getElementById('exercise-start_time').value;
    const end = document.getElementById('exercise-end_time').value;
    return {
      ymd: ymd,
      durationSeconds: outcome.durationSeconds,
      metaTime: outcome.metadata.totalTime,
      distanceKm: outcome.metadata.totalDistance / 1000,
      trackLength: outcome.track.length,
      inside: outcome.track.every((p) => window.ml_isPointInPolygon(p.lat, p.lng, polygon)),
      start: start,
      end: end
    };
  });

  const paceMinPerKm = result.durationSeconds / 60 / result.distanceKm;
  expect(result.trackLength).toBeGreaterThan(10);
  expect(result.inside).toBe(true);
  expect(result.distanceKm).toBeGreaterThanOrEqual(1.2);
  expect(result.durationSeconds).toBeGreaterThanOrEqual(4 * 60);
  expect(result.durationSeconds).toBeLessThanOrEqual(12 * 60);
  expect(paceMinPerKm).toBeGreaterThanOrEqual(3.3333 - 0.02);
  expect(paceMinPerKm).toBeLessThanOrEqual(10 + 0.02);
  // 轨迹 metadata 与表单时间必须一致
  expect(result.metaTime).toBe(result.durationSeconds);
  const formSeconds = (new Date(result.end) - new Date(result.start)) / 1000;
  expect(Math.abs(formSeconds - result.durationSeconds)).toBeLessThanOrEqual(1);
  // 禁止提前跑：生成结果必须落在所选的那一天，且已经过去
  expect(result.start.slice(0, 10)).toBe(result.ymd);
  expect(new Date(result.end).getTime()).toBeLessThanOrEqual(Date.now());
});

test('按天查重：当天已有记录能被识别出来', async ({ page }) => {
  const pageUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
  await page.goto(pageUrl);

  // 拦掉桥接请求，用固定数据代替真实服务端
  await page.route('http://127.0.0.1:17864/api/**', async (route) => {
    const isRecordQuery = route.request().url().indexOf('getRecordByMonthOrWeek') >= 0;
    const body = isRecordQuery
      ? {
          code: 200,
          success: true,
          data: {
            recordList: [
              { recordId: '1', recordTime: '2026-09-23', routeName: '桃园田径场', exerciseStatus: 1, isUse: 0, ruleId: '2101919551519227905' },
              // ruleId = -1 属于"打卡锻炼"，不应参与查重
              { recordId: '9', recordTime: '2026-09-24', routeName: '桃园田径场', exerciseStatus: 1, isUse: 0, ruleId: -1 }
            ]
          }
        }
      : { code: 200, success: true, data: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  const result = await page.evaluate(async () => {
    window.ml_student_token = 'dummy-token';
    const sameDay = await window.ml_find_existing_record('2026-09-23');
    const otherDay = await window.ml_find_existing_record('2026-09-24');
    return {
      described: sameDay ? window.ml_describe_record(sameDay) : null,
      describedNotCounted: sameDay ? window.ml_is_counted_record(sameDay) : null,
      otherDay: otherDay
    };
  });

  expect(result.described).toContain('2026-09-23');
  expect(result.described).toContain('桃园田径场');
  // exerciseStatus 0 才是有效，1 是无效；isUse 表示是否已计入次数
  expect(result.described).toContain('无效');
  expect(result.describedNotCounted).toBe(false);
  expect(result.otherDay).toBeNull();
});

test('历史记录面板展开后渲染记录', async ({ page }) => {
  const pageUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
  await page.goto(pageUrl);

  await expect(page.locator('#history-record-list')).toContainText('尚未加载');
  await expect(page.locator('#history-summary-note')).toBeVisible();

  await page.route('http://127.0.0.1:17864/api/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        success: true,
        data: {
          recordList: [
            { recordId: '1', recordTime: '2026-09-23', routeName: '桃园田径场', routeRule: '2026~2027学年1学期锻炼任务', strExerciseTimes: '00:09:06', routeKilometre: '1.330', exerciseStatus: 0, isUse: 1, ruleId: '2101919551519227905' },
            { recordId: '2', recordTime: '2026-09-22', routeName: '橘园田径场', routeRule: '2026~2027学年1学期锻炼任务', strExerciseTimes: '00:07:00', routeKilometre: '1.200', exerciseStatus: 1, isUse: 0, ruleId: '2101919551519227905' },
            // ruleId = -1 不属于当前锻炼任务，小程序不展示，这里也必须被过滤掉
            { recordId: '3', recordTime: '2026-09-21', routeName: '桃园田径场', routeRule: '打卡锻炼', exerciseStatus: 1, isUse: 0, ruleId: -1 }
          ]
        }
      })
    });
  });

  await page.evaluate(() => { window.ml_student_token = 'dummy-token'; });
  await page.locator('#history-details > summary').click();

  const list = page.locator('#history-record-list li');
  await expect(list).toHaveCount(2);
  // exerciseStatus 0 = 有效（不是 2），并带上规则名称与用时
  await expect(list.nth(0)).toContainText('2026-09-23');
  await expect(list.nth(0)).toContainText('有效');
  await expect(list.nth(0)).toContainText('2026~2027学年1学期锻炼任务');
  await expect(list.nth(0)).toContainText('00:09:06');
  await expect(list.nth(0)).toHaveClass(/text-success/);
  await expect(list.nth(1)).toContainText('无效');
  await expect(list.nth(1)).toContainText('00:07:00');
  await expect(list.nth(1)).toHaveClass(/text-danger/);
  await expect(page.locator('#history-summary-note')).toContainText('2 条记录');
});

test('批量页与单次页共用一个 Token，不用填两遍', async ({ page }) => {
  await page.goto(PAGE_URL);
  await page.locator('#tab-batch').click();

  // 单次页填一次 → 批量页自动跟上
  await page.locator('#input-token').fill(`bearer ${TEST_JWT}`);
  await expect(page.locator('#input-token-batch')).toHaveValue(`bearer ${TEST_JWT}`);
  expect(await page.evaluate(() => window.ml_resolve_token())).toBe(`bearer ${TEST_JWT}`);

  // 反过来在批量页填 → 单次页也跟上，Token 始终只有一份
  await page.locator('#input-token-batch').fill(`| Blade-Auth | bearer ${TEST_JWT} |`);
  await expect(page.locator('#input-token')).toHaveValue(`| Blade-Auth | bearer ${TEST_JWT} |`);
  await expect(page.locator('#token-validation-message-batch')).toBeHidden();
  await expect(page.locator('#token-validation-message')).toBeHidden();
  expect(await page.evaluate(() => window.ml_local_check_token_form(window.ml_resolve_token()))).toBe(true);
});

test('照片池按明暗度匹配时段，并尽量轮换使用', async ({ page }) => {
  await page.goto(PAGE_URL);

  const result = await page.evaluate(() => {
    const pool = [
      { key: 'd1', fileName: 'day1.png', period: 'day' },
      { key: 'd2', fileName: 'day2.png', period: 'day' },
      { key: 'n1', fileName: 'night1.png', period: 'night' }
    ];
    const nightUsage = {};
    const nightPicks = [0, 1, 2].map(function() {
      return window.ml_pick_pool_photo(pool, 'night', nightUsage).entry.fileName;
    });
    const dayUsage = {};
    const dayPicks = [0, 1].map(function() {
      return window.ml_pick_pool_photo(pool, 'day', dayUsage).entry.fileName;
    });
    const noNightPool = [{ key: 'd1', fileName: 'day1.png', period: 'day' }];
    const fallback = window.ml_pick_pool_photo(noNightPool, 'night', {});
    return {
      nightPicks: nightPicks,
      dayPicks: dayPicks.slice().sort(),
      fallback: { fileName: fallback.entry.fileName, matched: fallback.matched },
      summary: window.ml_photo_pool_summary(pool)
    };
  });

  // 夜间的记录只挑夜间照片
  expect(result.nightPicks).toEqual(['night1.png', 'night1.png', 'night1.png']);
  // 白天的记录在白天的照片之间轮换，不会反复抽到同一张
  expect(result.dayPicks).toEqual(['day1.png', 'day2.png']);
  // 池里没有对应时段的照片时退回全池，并把"没匹配上"告诉调用方
  expect(result.fallback.fileName).toBe('day1.png');
  expect(result.fallback.matched).toBe(false);
  expect(result.summary).toContain('白天 2');
  expect(result.summary).toContain('夜间 1');
});

test('批量一次性生成多份轨迹，刷新场地表也不会丢掉生成结果', async ({ page }) => {
  await page.goto(PAGE_URL);
  await mockBridgeApi(page);
  await page.route('https://worldtimeapi.org/**', (route) => route.abort());

  await page.locator('#input-token').fill(`bearer ${TEST_JWT}`);
  await page.locator('#tab-batch').click();
  await page.locator('#batch-image_start-pool').setInputFiles([
    imageFile('day1.png', WHITE_PNG),
    imageFile('day2.png', WHITE_PNG),
    imageFile('night1.png', DARK_PNG)
  ]);
  await page.locator('#batch-image_end-pool').setInputFiles([
    imageFile('end-day1.png', WHITE_PNG),
    imageFile('end-night1.png', DARK_PNG)
  ]);
  const dates = await pastDates(page, 2);
  await selectBatchRange(page, dates);
  await page.locator('#batch-random-time').uncheck();   // 固定 07:00 → 白天

  const prepared = await page.evaluate(async () => {
    const result = await window.ml_prepare_batch_plans({});
    return {
      errors: result.errors,
      poolSummary: window.ml_photo_pool_summary(result.startPool),
      plans: result.plans.map(function(plan) {
        return {
          date: plan.date,
          planId: plan.planId,
          routeName: plan.routeName,
          trackLength: plan.track.length,
          start: plan.start,
          end: plan.end,
          durationSeconds: plan.durationSeconds,
          distance: plan.metadata.totalDistance,
          period: plan.period,
          startPhoto: plan.startPhotoName,
          endPhoto: plan.endPhotoName,
          inside: plan.track.every(function(point) {
            return window.ml_isPointInPolygon(point.lat, point.lng, window.ml_boundary_cache[plan.planId].paths);
          })
        };
      })
    };
  });

  // 一次生成多份：两天各一份，而且都是服务端下发的场地
  expect(prepared.errors).toEqual([]);
  expect(prepared.plans.length).toBe(2);
  expect(prepared.poolSummary).toContain('白天 2');
  prepared.plans.forEach((plan, index) => {
    expect(plan.date).toBe(dates[index]);
    expect(['p1', 'p2']).toContain(plan.planId);
    expect(plan.trackLength).toBeGreaterThan(10);
    expect(plan.inside).toBe(true);
    expect(plan.distance).toBeGreaterThanOrEqual(1200);
    expect(plan.durationSeconds).toBeGreaterThanOrEqual(240);
    expect(plan.durationSeconds).toBeLessThanOrEqual(720);
    expect(plan.start.slice(0, 10)).toBe(plan.date);
    expect(plan.end.slice(0, 10)).toBe(plan.date);
    // 07:00 是白天 → 抽到白天的照片
    expect(plan.period).toBe('day');
    expect(plan.startPhoto).toMatch(/^day/);
    expect(plan.endPhoto).toBe('end-day1.png');
  });

  // 把时间固定成晚上：同一批照片应该换成夜间那张
  // （随机时间关掉时走的是"固定 07:00"，所以这里要重新打开随机时间，让生成器可用）
  await page.locator('#batch-random-time').check();
  const nightPlans = await page.evaluate(async () => {
    const original = window.ml_generateValidTimeForDate;
    window.ml_generateValidTimeForDate = function(dateStr, durationSeconds) {
      const pad = (n) => String(n).padStart(2, '0');
      const start = new Date(dateStr + 'T21:05:00');
      const end = new Date(start.getTime() + durationSeconds * 1000);
      const hhmmss = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      return { start: dateStr + 'T' + hhmmss(start), end: dateStr + 'T' + hhmmss(end) };
    };
    try {
      const result = await window.ml_prepare_batch_plans({});
      return result.plans.map(function(plan) {
        return { period: plan.period, startPhoto: plan.startPhotoName, endPhoto: plan.endPhotoName, start: plan.start };
      });
    } finally {
      window.ml_generateValidTimeForDate = original;
    }
  });
  expect(nightPlans.length).toBe(2);
  nightPlans.forEach((plan) => {
    expect(plan.start).toContain('T21:05:00');
    expect(plan.period).toBe('night');
    expect(plan.startPhoto).toBe('night1.png');
    expect(plan.endPhoto).toBe('end-night1.png');
  });

  // 预演结果落进页面列表
  await page.locator('#batch-random-time').uncheck();
  const rendered = await page.evaluate(async () => {
    const result = await window.ml_prepare_batch_plans({});
    window.ml_batch_state.plans = result.plans;
    window.ml_batch_state.planErrors = result.errors;
    window.ml_batch_state.pools = { startPool: result.startPool, endPool: result.endPool };
    window.ml_renderBatchPlans();
    return {
      rows: document.querySelectorAll('#batch-plan-list li').length,
      summary: document.getElementById('batch-plan-summary').textContent,
      firstRow: document.querySelector('#batch-plan-list li').textContent
    };
  });
  expect(rendered.rows).toBe(2);
  expect(rendered.summary).toContain('已生成 2 份轨迹');
  expect(rendered.firstRow).toContain('km');

  // 提交前会重新拉一次 listRule；刷新不能把已经生成好的轨迹换成服务端的粗角点
  const preserved = await page.evaluate(async () => {
    const planId = 'p1';
    window.ml_student_token = window.ml_resolve_token();
    window.ml_boundary_cache[planId] = { paths: window.ml_boundary_cache[planId].paths };
    window.ml_choose_route_data = window.ml_all_route_info[planId];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ymd = yesterday.getFullYear() + '-' +
      String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
      String(yesterday.getDate()).padStart(2, '0');
    const generated = await window.ml_generate_time_and_track(ymd);
    const before = {
      trackLength: window.ml_student_choose_route_data.track.length,
      planId: window.ml_choose_route_data.plan_id
    };
    await window.ml_load_route_data_from_server(window.ml_student_token);
    return {
      generatedTrackLength: generated.track.length,
      before: before,
      afterTrackLength: window.ml_student_choose_route_data.track.length,
      afterPlanId: window.ml_choose_route_data.plan_id
    };
  });
  expect(preserved.before.planId).toBe('p1');
  expect(preserved.afterPlanId).toBe('p1');
  // 刷新后拿到的仍然是那份生成好的密集轨迹（服务端原始 latlngs 只有 4 个点）
  expect(preserved.afterTrackLength).toBe(preserved.before.trackLength);
  expect(preserved.afterTrackLength).toBe(preserved.generatedTrackLength);
  expect(preserved.afterTrackLength).toBeGreaterThan(10);
});

test('批量提交直接用预演好的方案，请求体与服务端规则对齐', async ({ page }) => {
  await page.goto(PAGE_URL);
  const captured = [];
  await mockBridgeApi(page, captured);
  await page.route('https://worldtimeapi.org/**', (route) => route.abort());

  await page.locator('#input-token').fill(`bearer ${TEST_JWT}`);
  await page.locator('#tab-batch').click();
  await page.locator('#batch-image_start-pool').setInputFiles([imageFile('day1.png', WHITE_PNG)]);
  await page.locator('#batch-image_end-pool').setInputFiles([imageFile('end-day1.png', WHITE_PNG)]);
  await page.locator('#batch-random-time').uncheck();
  await page.locator('#input-simulated-delay-batch').fill('0');
  const dates = await pastDates(page, 2);
  await selectBatchRange(page, dates);
  // 场地表由服务端下发后再选；批量下拉框里的选项就是这里重建的
  await expect(page.locator('#select-route_info')).toHaveValue('p1', { timeout: 8000 });
  await page.selectOption('#select-route_info-batch', 'p1');

  // 不先点「一次性生成全部轨迹」：提交本身就要先把整批轨迹生成出来
  await page.evaluate(() => window.ml_batch_upload({}));

  await expect(page.locator('#ml_Alert_Title')).toHaveText('批量上传完成');
  await expect(page.locator('#batch-progress-text')).toContainText('成功: 2');
  await expect(page.locator('#batch-plan-list li')).toHaveCount(2);
  await expect(page.locator('#batch-plan-summary')).toContainText('已生成 2 份轨迹');

  const saveStart = captured.filter((item) => item.url.indexOf('saveStartRecord') >= 0);
  const saveRecord = captured.filter((item) => item.url.indexOf('saveRecord') >= 0);
  const imageStart = captured.filter((item) => item.url.indexOf('uploadRecordImageStart') >= 0);
  const imageEnd = captured.filter((item) => item.url.indexOf('uploadRecordImageEnd') >= 0);
  expect(saveStart.length).toBe(2);
  expect(saveRecord.length).toBe(2);
  expect(imageStart.length).toBe(2);
  expect(imageEnd.length).toBe(2);

  // 图片上传仍然走 v1 前缀 + miniappversion，写记录走 v2 前缀 + 加密请求体
  expect(imageStart[0].url).toContain('/api/blade-exercise/exerciseRecord/uploadRecordImageStart');
  expect(imageStart[0].headers['miniappversion']).toBe('V2.1.7');
  expect(saveStart[0].url).toContain('/api/blade-exercise/v2/exerciseRecord/saveStartRecord');
  expect(saveRecord[0].url).toContain('/api/blade-exercise/v2/exerciseRecord/saveRecord');

  const decoded = [];
  for (const item of saveStart.concat(saveRecord)) {
    decoded.push({
      kind: item.url.indexOf('saveStartRecord') >= 0 ? 'start' : 'finish',
      headers: item.headers,
      payload: JSON.parse(await page.evaluate((body) => window.ml_aes_decrypt(body), item.body))
    });
  }

  decoded.forEach((item) => {
    // 请求体是 AES 密文，服务端拿到明文后能读到当天的场地与时间
    expect(item.payload.planId).toBe('p1');
    expect(item.payload.routeName).toBe('测试桃园田径场');
    expect(item.payload.ruleId).toBe('r1');
    expect(dates).toContain(item.payload.recordTime);
    // Playwright 的 request.headers() 一律小写
    expect(item.headers['blade-requested-with']).toBe('BladeHttpRequest');
    expect(item.headers['blade-auth']).toBe(`bearer ${TEST_JWT}`);
    expect(item.headers['authorization']).toBe('Basic d2VjaGF0OndlY2hhdF9zZWNyZXQ=');
    // 小程序从不发 Tenant-Id：租户在 Token 里
    expect(item.headers['tenant-id']).toBeUndefined();
  });

  const finishPayloads = decoded.filter((item) => item.kind === 'finish');
  finishPayloads.forEach((item) => {
    // 提交的是生成好的密集轨迹，而不是服务端下发的 4 个角点
    const track = JSON.parse(item.payload.strLatitudeLongitude);
    expect(track.length).toBeGreaterThan(10);
    expect(item.payload.endImage).toBe('https://example.invalid/end.jpg');
    expect(item.payload.routeKilometre).toBeGreaterThanOrEqual(1.2);
    expect(item.payload.exerciseTimes).toBeGreaterThanOrEqual(240);
    expect(item.payload.exerciseTimes).toBeLessThanOrEqual(720);
  });
  expect(finishPayloads.map((item) => item.payload.recordTime).sort()).toEqual(dates.slice().sort());

  // 失败日期重试：按失败列表里的日期重新生成 + 重新提交，不需要用户再填一遍任何东西
  await page.locator('#ml_Alert_Ok').click();
  const retryDate = (await pastDates(page, 3))[0];
  await page.evaluate((date) => {
    localStorage.setItem('ml_seu_exercise_helper_batch_failures', JSON.stringify([{ date: date, error: '网络错误' }]));
  }, retryDate);
  const savesBeforeRetry = captured.filter((item) => item.url.indexOf('saveRecord') >= 0).length;
  await page.locator('#btn-retry-failed-batch').click();
  await expect(page.locator('#ml_Alert_Title')).toHaveText('失败日期重试完成');
  await expect(page.locator('#batch-plan-list li')).toHaveCount(1);
  await expect(page.locator('#batch-plan-list li').first()).toContainText(retryDate);
  const retriedSaves = captured.filter((item) => item.url.indexOf('saveRecord') >= 0).slice(savesBeforeRetry);
  expect(retriedSaves.length).toBe(1);
  const retriedPayload = JSON.parse(await page.evaluate((body) => window.ml_aes_decrypt(body), retriedSaves[0].body));
  expect(retriedPayload.recordTime).toBe(retryDate);
  // 重试成功后失败列表应该被清空
  await expect(page.locator('#batch-failed-list')).toContainText('暂无失败记录');
});

test('首屏标题在第一屏内，页面长度受控', async ({ page }) => {
  await page.goto(PAGE_URL);

  const layout = await page.evaluate(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { top: Math.round(rect.top + window.scrollY), bottom: Math.round(rect.bottom + window.scrollY) };
    };
    return {
      title: box('.hero-brand-title'),
      flow: box('.hero-flow'),
      actions: box('.hero-actions'),
      viewportHeight: window.innerHeight,
      pageHeight: document.body.scrollHeight,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  });

  // hero 原来是 align-items:center，右侧表单卡很高，把标题顶到了折线以下
  expect(layout.title.top).toBeLessThan(320);
  expect(layout.title.bottom).toBeLessThan(layout.viewportHeight * 0.6);
  expect(layout.flow.bottom).toBeLessThan(layout.viewportHeight);
  expect(layout.actions.bottom).toBeLessThan(layout.viewportHeight);

  // 页面长度：收紧前约 3800+，这里给一个上限当护栏
  expect(layout.pageHeight).toBeLessThan(3400);
  expect(layout.overflowX).toBe(false);

  // 照片区：上传框与预览框并排成一行，不再上下各占一大块
  const photo = await page.evaluate(() => {
    const pair = document.querySelector('.photo-pair');
    return {
      columns: getComputedStyle(pair).gridTemplateColumns.split(' ').length,
      height: Math.round(pair.getBoundingClientRect().height)
    };
  });
  expect(photo.columns).toBe(2);
  expect(photo.height).toBeLessThan(260);

  // 我的锻炼记录挪到首屏左栏后仍然可用
  await expect(page.locator('#history-details')).toBeVisible();
  await expect(page.locator('#history-record-list')).toContainText('尚未加载');
});

test('固定配速、跑道内缩与手动引导点', async ({ page }) => {
  await page.goto(PAGE_URL);
  await mockBridgeApi(page);
  await page.route('https://worldtimeapi.org/**', (route) => route.abort());
  await page.locator('#input-token').fill(`bearer ${TEST_JWT}`);
  await page.locator('#tab-run').click();
  await page.selectOption('#select-route_info', 'p1');

  // 配速的可选区间由服务端规则算出：3'20'' ~ 10'00''
  const paceUi = await page.evaluate(() => ({
    min: Number(document.getElementById('input-pace').min),
    max: Number(document.getElementById('input-pace').max),
    minutes: Array.from(document.getElementById('input-pace-minute').options).map((o) => Number(o.value))
  }));
  expect(paceUi.min).toBe(200);
  expect(paceUi.max).toBe(600);
  expect(paceUi.minutes[0]).toBe(3);
  expect(paceUi.minutes[paceUi.minutes.length - 1]).toBe(10);

  // 用户自己挑 6 分 00 秒：时长必须等于 里程 × 该配速
  await page.locator('#pace-random').uncheck();
  await page.evaluate(() => {
    const minute = document.getElementById('input-pace-minute');
    const second = document.getElementById('input-pace-second');
    minute.value = '6';
    second.value = '0';
    minute.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(await page.evaluate(() => window.ml_pace_seconds_for_plan())).toBe(360);

  const generated = await page.evaluate(async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ymd = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
      String(yesterday.getDate()).padStart(2, '0');
    const out = await window.ml_generate_time_and_track(ymd);
    const polygon = window.ml_boundary_cache['p1'].paths;
    const meta = window.ml_student_choose_route_data.metadata;
    return {
      durationSeconds: out.durationSeconds,
      distanceKm: meta.totalDistance / 1000,
      lapPerimeter: meta.lapPerimeterMeters,
      inset: meta.trackInsetMeters,
      clearance: meta.minClearanceMeters,
      inside: out.track.every((point) => window.ml_isPointInPolygon(point.lat, point.lng, polygon))
    };
  });
  // 时长 = 里程 × 配速（6'00''/km）
  expect(Math.abs(generated.durationSeconds / generated.distanceKm - 360)).toBeLessThan(6);
  // 自动内缩把单圈收到标准跑道的 400m 量级，而不是贴着限制范围跑
  expect(generated.lapPerimeter).toBeGreaterThan(340);
  expect(generated.lapPerimeter).toBeLessThan(460);
  expect(generated.inset).toBeGreaterThan(3);
  expect(generated.inside).toBe(true);
  expect(generated.clearance).toBeGreaterThan(5);
  expect(generated.distanceKm).toBeGreaterThanOrEqual(1.2);

  // 手动引导点：勾选后在预览图上点 4 个点，轨迹就按点的路线走
  await page.locator('#manual-guide').check();
  await page.locator('#ml_Alert_Ok').click();
  const guided = await page.evaluate(async () => {
    const svg = document.getElementById('track-preview');
    const box = svg.getBoundingClientRect();
    const view = window.ml_current_track_view;
    const scale = Math.min(box.width / view.vbW, box.height / view.vbH);
    const offX = (box.width - view.vbW * scale) / 2;
    const offY = (box.height - view.vbH * scale) / 2;
    const boundary = window.ml_boundary_cache['p1'].paths;
    const lats = boundary.map((p) => p.lat);
    const lngs = boundary.map((p) => p.lng);
    const midLat = (Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2;
    const midLng = (Math.min.apply(null, lngs) + Math.max.apply(null, lngs)) / 2;
    const latM = 111320;
    const lngM = 111320 * Math.cos(midLat * Math.PI / 180);
    [
      { lat: midLat - 35 / latM, lng: midLng - 48 / lngM },
      { lat: midLat - 35 / latM, lng: midLng + 48 / lngM },
      { lat: midLat + 35 / latM, lng: midLng + 48 / lngM },
      { lat: midLat + 35 / latM, lng: midLng - 48 / lngM }
    ].forEach((point) => {
      const c = window.ml_track_view_project(view, point);
      svg.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        clientX: box.left + offX + c.x * scale,
        clientY: box.top + offY + c.y * scale
      }));
    });
    const target = new Date();
    target.setDate(target.getDate() - 2);
    const dateStr = target.getFullYear() + '-' + String(target.getMonth() + 1).padStart(2, '0') + '-' +
      String(target.getDate()).padStart(2, '0');
    const out = await window.ml_generate_time_and_track(dateStr);
    const meta = window.ml_student_choose_route_data.metadata;
    const maxOffsetM = Math.max.apply(null, out.track.map((p) => Math.abs(p.lat - midLat) * latM));
    return {
      waypoints: window.ml_active_waypoints().length,
      guided: meta.guidedByWaypoints,
      guidePoints: meta.guidePointCount,
      maxOffsetM: maxOffsetM,
      inside: out.track.every((p) => window.ml_isPointInPolygon(p.lat, p.lng, boundary))
    };
  });
  expect(guided.waypoints).toBe(4);
  expect(guided.guided).toBe(true);
  expect(guided.guidePoints).toBe(4);
  expect(guided.maxOffsetM).toBeLessThan(60);
  expect(guided.inside).toBe(true);
});



// CI demo：用 sample 資料驅動系統，觸發「一鍵報到全部（測試用）」並截圖。
// 僅供 GitHub Actions demo 使用，需要 playwright（CI 內安裝，非專案相依套件）。
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = process.env.OUT || 'demo-artifacts';
const BASE = process.env.BASE || 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // CI 使用 playwright 內建 chromium；本機驗證可設 PW_CHANNEL=chrome 用系統 Chrome
  const launchOpts = process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {};
  const browser = await chromium.launch(launchOpts);

  // 1) 報到端（手機）：輸入代碼並報到，顯示成功訊息
  const phone = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 });
  const checkin = await phone.newPage();
  await checkin.goto(`${BASE}/checkin.html`, { waitUntil: 'networkidle' });
  await sleep(1200);
  await checkin.fill('#codeInput', '0901');
  await checkin.click('#checkinBtn');
  await sleep(800);
  await checkin.screenshot({ path: path.join(OUT, 'checkin.png') });
  console.log('saved checkin.png');

  // 2) 呈現端：點「一鍵報到全部（測試用）」把所有 sample 參與者報到上牆
  const big = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
  const display = await big.newPage();
  await display.goto(`${BASE}/display.html`, { waitUntil: 'networkidle' });
  await sleep(1500);
  await display.click('#testCheckinAllBtn');
  await display.waitForSelector('.shape-avatar, .avatar', { timeout: 15000 });
  await sleep(4500);
  console.log('avatars placed:', await display.locator('.shape-avatar, .avatar').count());
  await display.screenshot({ path: path.join(OUT, 'display-wall.png') });
  console.log('saved display-wall.png');

  // 3) 點開人物彈窗
  const target = display.locator('.shape-avatar, .avatar').filter({ hasText: '王小明' }).first();
  await (await target.count() ? target : display.locator('.shape-avatar, .avatar').first()).click();
  await display.waitForSelector('#detailModal.active', { timeout: 5000 });
  await sleep(1200);
  await display.screenshot({ path: path.join(OUT, 'display-modal.png') });
  console.log('saved display-modal.png');

  await browser.close();
})().catch((e) => { console.error('DEMO ERROR:', e); process.exit(1); });

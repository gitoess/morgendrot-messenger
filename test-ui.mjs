import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');
const BASE = 'http://127.0.0.1:3342/';

const results = [];

function log(test, status, detail) {
  const entry = { test, status, detail };
  results.push(entry);
  const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[INFO]';
  console.log(`${icon} ${test}: ${detail}`);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1400, height: 900 },
  });
  const page = await browser.newPage();

  // Ensure screenshot directory
  const fs = await import('fs');
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  try {
    // ====== TEST 1: Dashboard loads ======
    console.log('\n=== TEST 1: Dashboard loads ===');
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
    // Wait for Alpine.js initialization
    await page.waitForFunction(() => {
      return document.querySelector('[x-data]') &&
             document.querySelector('[x-data]').__x !== undefined ||
             document.querySelectorAll('button').length > 3;
    }, { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-dashboard.png'), fullPage: true });

    // Check for tiles
    const tileCount = await page.evaluate(() => {
      const grid = document.querySelector('.grid.gap-4');
      if (!grid) return 0;
      return grid.querySelectorAll('button').length;
    });

    // Check for Steuerung tile specifically
    const hasSteuerung = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.includes('Steuerung')) return true;
      }
      return false;
    });

    const headerText = await page.evaluate(() => document.querySelector('h1')?.textContent || '');
    const statusBadge = await page.evaluate(() => {
      const span = document.querySelector('span[x-text="statusLabel()"]');
      return span ? span.textContent.trim() : '';
    });

    log('Test 1', tileCount > 0 ? 'PASS' : 'FAIL', `Dashboard loaded. Header: "${headerText}", Status: "${statusBadge}", Tiles found: ${tileCount}, Steuerung tile: ${hasSteuerung}`);

    // List all tile titles
    const tileNames = await page.evaluate(() => {
      const tiles = document.querySelectorAll('.grid.gap-4 button h3');
      return Array.from(tiles).map(h => h.textContent.trim());
    });
    log('Test 1', 'INFO', `Tile names: ${tileNames.join(', ')}`);

    // ====== TEST 2: Open Boss/Steuerung view ======
    console.log('\n=== TEST 2: Open Boss/Steuerung view ===');
    // Click the Steuerung tile
    const clicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('.grid.gap-4 button');
      for (const btn of buttons) {
        if (btn.textContent.includes('Steuerung')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (!clicked) {
      log('Test 2', 'FAIL', 'Could not find Steuerung tile to click');
    } else {
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-boss-view.png'), fullPage: true });

      // Check which sections are visible
      const sections = await page.evaluate(() => {
        const bossView = document.querySelector('[x-show="view === \'boss\'"]');
        if (!bossView) return [];
        const h4s = bossView.querySelectorAll('h4');
        return Array.from(h4s).map(h => h.textContent.trim());
      });

      const backBtnVisible = await page.evaluate(() => {
        const btn = document.querySelector('button');
        return btn && btn.textContent.includes('Zurück');
      });

      log('Test 2', sections.length > 0 ? 'PASS' : 'FAIL', `Boss view sections: ${sections.join(', ')}. Back button visible: ${backBtnVisible}`);
    }

    // ====== TEST 3: Test Profile Cards ======
    console.log('\n=== TEST 3: Test Profile Cards ===');
    // Get current computedRoleId before clicking
    const roleIdBefore = await page.evaluate(() => {
      const el = document.querySelector('[x-text="boss.computedRoleId"]');
      return el ? el.textContent.trim() : 'N/A';
    });

    // Click on "Standard Arbeiter" card (ID 14)
    const profileClicked = await page.evaluate(() => {
      const bossView = document.querySelector('[x-show="view === \'boss\'"]');
      if (!bossView) return false;
      const buttons = bossView.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.includes('Standard Arbeiter') && btn.textContent.includes('ID 14')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    await new Promise(r => setTimeout(r, 500));

    const roleIdAfter = await page.evaluate(() => {
      const el = document.querySelector('[x-text="boss.computedRoleId"]');
      return el ? el.textContent.trim() : 'N/A';
    });

    // Check if card is highlighted (has emerald border)
    const cardHighlighted = await page.evaluate(() => {
      const bossView = document.querySelector('[x-show="view === \'boss\'"]');
      if (!bossView) return false;
      const buttons = bossView.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.includes('Standard Arbeiter')) {
          return btn.className.includes('border-emerald') || btn.classList.contains('border-emerald-500/60');
        }
      }
      return false;
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-profile-card-selected.png'), fullPage: true });
    log('Test 3', profileClicked ? 'PASS' : 'FAIL', `Profile card clicked: ${profileClicked}. RoleID before: ${roleIdBefore}, after: ${roleIdAfter}. Card highlighted: ${cardHighlighted}`);

    // ====== TEST 4: Test 6-Bit Calculator ======
    console.log('\n=== TEST 4: Test 6-Bit Calculator ===');
    // Click on the details/summary to expand
    const summaryClicked = await page.evaluate(() => {
      const summaries = document.querySelectorAll('summary');
      for (const s of summaries) {
        if (s.textContent.includes('Eigene Kombination') || s.textContent.includes('6-Bit')) {
          s.click();
          return true;
        }
      }
      return false;
    });

    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-6bit-calculator.png'), fullPage: true });

    // Read checkbox states
    const checkboxStates = await page.evaluate(() => {
      const details = document.querySelector('details.group');
      if (!details) return {};
      const labels = details.querySelectorAll('label');
      const result = {};
      labels.forEach(label => {
        const cb = label.querySelector('input[type="checkbox"]');
        const nameSpan = label.querySelector('.font-mono');
        if (cb && nameSpan) {
          result[nameSpan.textContent.trim()] = cb.checked;
        }
      });
      return result;
    });

    const roleIdCalc = await page.evaluate(() => {
      const el = document.querySelector('[x-text="boss.computedRoleId"]');
      return el ? el.textContent.trim() : 'N/A';
    });

    log('Test 4', summaryClicked ? 'PASS' : 'FAIL', `6-Bit Calculator expanded: ${summaryClicked}. Checkbox states: ${JSON.stringify(checkboxStates)}. Computed RoleID: ${roleIdCalc}`);

    // Verify ID 14 = BW(8) + L(4) + S(2) = 14
    const expectedBits = { D: false, LW: false, BW: true, L: true, S: true, P: false };
    const bitsMatch = Object.entries(expectedBits).every(([k, v]) => checkboxStates[k] === v);
    log('Test 4', bitsMatch ? 'PASS' : 'FAIL', `Bits match expected for ID 14 (BW+L+S): ${bitsMatch}`);

    // ====== TEST 5: Test Device Registration ======
    console.log('\n=== TEST 5: Test Device Registration ===');
    const testAddr = '0xabc123def456789012345678901234567890123456789012345678901234abcd';
    const testName = 'Test-Sensor-1';

    // Set values directly through Alpine's reactive data to ensure x-model bindings work
    const setResult = await page.evaluate((addr, name) => {
      const el = document.querySelector('[x-data]');
      if (!el || !el._x_dataStack) return { ok: false, reason: 'no Alpine data' };
      const data = el._x_dataStack[0];
      if (!data || !data.boss) return { ok: false, reason: 'no boss data' };
      data.boss.newDeviceAddr = addr;
      data.boss.newDeviceName = name;
      data.boss.newDeviceRole = 'arbeiter';
      return { ok: true, addr: data.boss.newDeviceAddr, name: data.boss.newDeviceName, role: data.boss.newDeviceRole };
    }, testAddr, testName);
    console.log('  Set Alpine data:', JSON.stringify(setResult));

    await new Promise(r => setTimeout(r, 500));

    // Call addDevice directly via Alpine data
    const addResult = await page.evaluate(() => {
      const el = document.querySelector('[x-data]');
      if (!el || !el._x_dataStack) return { ok: false, reason: 'no Alpine data' };
      const data = el._x_dataStack[0];
      const beforeCount = data.boss.devices.length;
      data.addDevice();
      const afterCount = data.boss.devices.length;
      return {
        ok: true,
        beforeCount,
        afterCount,
        devices: data.boss.devices.map(d => ({ address: d.address.slice(0, 16) + '...', role: d.role, name: d.name })),
        cmdResult: data.cmdResult || ''
      };
    });
    console.log('  addDevice result:', JSON.stringify(addResult));

    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05a-device-added.png'), fullPage: true });

    // Check if device appears in the rendered DOM
    const deviceInTable = await page.evaluate((addr) => {
      const tds = document.querySelectorAll('td');
      for (const td of tds) {
        if (td.textContent.includes(addr.slice(0, 12)) || td.textContent.includes('Test-Sensor')) return true;
      }
      return false;
    }, testAddr);

    const deviceCount = await page.evaluate(() => {
      const el = document.querySelector('[x-data]');
      const data = el?._x_dataStack?.[0];
      return data ? data.boss.devices.length : -1;
    });

    const roleVal = 'arbeiter';
    log('Test 5', (addResult.ok && addResult.afterCount > addResult.beforeCount) ? 'PASS' : 'FAIL',
      `Device added: ${addResult.ok}, Count ${addResult.beforeCount} -> ${addResult.afterCount}, Visible in DOM: ${deviceInTable}, Role: ${roleVal}${addResult.cmdResult ? ', cmdResult: ' + addResult.cmdResult : ''}`);

    // Now remove the specific test device we added
    const removeResult = await page.evaluate((addr) => {
      const el = document.querySelector('[x-data]');
      if (!el || !el._x_dataStack) return { ok: false, reason: 'no Alpine data' };
      const data = el._x_dataStack[0];
      const idx = data.boss.devices.findIndex(d => d.address === addr);
      if (idx === -1) return { ok: false, reason: 'test device not found' };
      const beforeCount = data.boss.devices.length;
      data.removeDevice(idx);
      return { ok: true, beforeCount, afterCount: data.boss.devices.length, removedIdx: idx };
    }, testAddr);

    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05b-device-removed.png'), fullPage: true });

    log('Test 5', (removeResult.ok && removeResult.afterCount === removeResult.beforeCount - 1) ? 'PASS' : 'FAIL',
      `Device removed: ${removeResult.ok}, Count ${removeResult.beforeCount} -> ${removeResult.afterCount}`);

    // ====== TEST 6: Navigate back ======
    console.log('\n=== TEST 6: Navigate back ===');
    const backClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.includes('Zurück')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-back-to-dashboard.png'), fullPage: true });

    const dashboardVisible = await page.evaluate(() => {
      const h2s = document.querySelectorAll('h2');
      for (const h of h2s) {
        if (h.textContent.includes('Was möchtest du tun')) return true;
      }
      return false;
    });

    const tilesBack = await page.evaluate(() => {
      const grid = document.querySelector('.grid.gap-4');
      if (!grid) return 0;
      return grid.querySelectorAll('button').length;
    });

    log('Test 6', dashboardVisible ? 'PASS' : 'FAIL', `Back clicked: ${backClicked}, Dashboard visible: ${dashboardVisible}, Tiles count: ${tilesBack}`);

  } catch (err) {
    console.error('Error during testing:', err.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error.png'), fullPage: true }).catch(() => {});
    log('General', 'FAIL', `Unexpected error: ${err.message}`);
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n==========================================');
  console.log('           TEST SUMMARY');
  console.log('==========================================');
  const passes = results.filter(r => r.status === 'PASS').length;
  const fails = results.filter(r => r.status === 'FAIL').length;
  const infos = results.filter(r => r.status === 'INFO').length;
  console.log(`PASS: ${passes}  |  FAIL: ${fails}  |  INFO: ${infos}`);
  console.log('==========================================');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : 'ℹ';
    console.log(`  ${icon} ${r.test}: ${r.detail}`);
  });
  console.log('==========================================');
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);

  process.exit(fails > 0 ? 1 : 0);
})();

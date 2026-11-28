'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

/** Next-Messenger (wie `npm run dm`) — nicht die Lite-UI am API-Port. */
const NEXT_UI_PORT = 3341;
const API_PORT = 3342;

function looksLikeRepoRoot(dir) {
  return Boolean(dir && fs.existsSync(path.join(dir, 'src', 'start-with-secrets.ts')));
}

/**
 * Repo/Standalone-Root finden.
 * Dev: main.cjs in morgendrot-messenger-desktop → Parent = Repo.
 * Standalone-Bundle: main.cjs neben src/.
 * Portable-EXE: entpackt nach %TEMP% — __dirname hilft nicht; electron-builder setzt
 * PORTABLE_EXECUTABLE_DIR auf den Ordner der .exe (z. B. exports/messenger-desktop-exe).
 */
function getRepoRoot() {
  const candidates = [];

  function pushWalk(start, maxUp) {
    if (!start) return;
    let cur = path.resolve(start);
    for (let i = 0; i <= maxUp; i++) {
      candidates.push(cur);
      const parent = path.resolve(cur, '..');
      if (parent === cur) break;
      cur = parent;
    }
  }

  pushWalk(__dirname, 2);
  pushWalk(process.env.PORTABLE_EXECUTABLE_DIR, 4);
  if (process.env.PORTABLE_EXECUTABLE_FILE) {
    pushWalk(path.dirname(process.env.PORTABLE_EXECUTABLE_FILE), 4);
  }
  try {
    pushWalk(path.dirname(process.execPath), 4);
  } catch (_) {}
  try {
    if (typeof app.getPath === 'function') {
      pushWalk(path.dirname(app.getPath('exe')), 4);
    }
  } catch (_) {}

  const seen = new Set();
  for (const c of candidates) {
    const n = path.resolve(c);
    if (seen.has(n)) continue;
    seen.add(n);
    if (looksLikeRepoRoot(n)) return n;
  }
  return null;
}

let REPO_ROOT;
let backend = null;
let nextProc = null;
let mainWindow = null;
let uiReady = false;
let pollTimer = null;

const DEBUG_LOG = path.join(
  process.env.TEMP || process.env.TMP || require('os').tmpdir(),
  'morgendrot-desktop-start.log'
);
function dlog(msg) {
  try {
    fs.appendFileSync(DEBUG_LOG, new Date().toISOString() + ' ' + msg + '\n');
  } catch (_) {}
}

function showLoadingWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return;
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    title: 'Morgendrot Messenger',
    backgroundColor: '#020617',
    show: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
    },
  });
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Morgendrot Messenger</title></head>' +
    '<body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;' +
    'background:#020617;color:#94a3b8;font-family:system-ui,sans-serif;font-size:15px;">' +
    '<div>Messenger startet …</div>' +
    '<div style="font-size:12px;color:#64748b">API + Next (wie npm run dm)</div>' +
    '</body></html>';
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function probeUrl(url, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs || 1500 }, (res) => {
      res.resume();
      const code = res.statusCode || 0;
      resolve(code >= 200 && code < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      try {
        req.destroy();
      } catch (_) {}
      resolve(false);
    });
  });
}

function loadNextUi() {
  if (uiReady) return;
  uiReady = true;
  const url = `http://127.0.0.1:${NEXT_UI_PORT}/`;
  dlog('loadNextUi ' + url);
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = new BrowserWindow({
      width: 1100,
      height: 820,
      title: 'Morgendrot Messenger',
      backgroundColor: '#020617',
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
      },
    });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
  mainWindow.webContents.once('did-fail-load', (_e, code, desc, validatedURL, isMainFrame) => {
    dlog('did-fail-load ' + code + ' ' + desc + ' main=' + isMainFrame);
    // -3 ERR_ABORTED = Redirect/Abbruch — oft harmlos, wenn danach did-finish-load kommt.
    if (code === -3) return;
    uiReady = false;
    if (isMainFrame && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Morgendrot Messenger',
        message: 'Next-UI Ladefehler (' + code + '): ' + desc + '\nErneuter Versuch …',
      });
    }
    setTimeout(() => {
      if (!uiReady) startReadyPoll();
    }, 1500);
  });
  mainWindow.webContents.once('did-finish-load', () => {
    const u = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents.getURL() : '?';
    dlog('did-finish-load ' + u);
    if (u && u.indexOf(String(NEXT_UI_PORT)) !== -1) uiReady = true;
  });
  mainWindow.loadURL(url).then(() => dlog('loadURL resolved')).catch((err) => {
    // Redirect localhost↔127.0.0.1 → oft ERR_ABORTED; UI kann trotzdem fertig laden.
    dlog('loadURL reject ' + (err && err.message));
  });
  mainWindow.focus();
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function nodeExecutable() {
  if (process.env.npm_node_execpath && fs.existsSync(process.env.npm_node_execpath)) {
    return process.env.npm_node_execpath;
  }
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('where.exe', ['node'], { encoding: 'utf8' });
      const first = String(out).trim().split(/\r?\n/)[0].trim();
      if (first && fs.existsSync(first)) return first;
    } else {
      const out = execFileSync('which', ['node'], { encoding: 'utf8' });
      const p = String(out).trim();
      if (p && fs.existsSync(p)) return p;
    }
  } catch (_) {}
  return process.platform === 'win32' ? 'node.exe' : 'node';
}

function sharedEnv() {
  return {
    ...process.env,
    UI_VARIANT: 'messenger',
    ENABLE_UI: 'true',
    API_PORT: String(API_PORT),
    UI_PORT: String(NEXT_UI_PORT),
    MORGENDROT_API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`,
    NEXT_PUBLIC_MORG_PRODUCT: 'messenger',
  };
}

function killTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch (_) {}
  } else {
    try {
      child.kill('SIGTERM');
    } catch (_) {}
  }
}

function startBackend() {
  const tsxCli = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const entry = path.join(REPO_ROOT, 'src', 'start-with-secrets.ts');
  const nodeBin = nodeExecutable();
  backend = spawn(nodeBin, [tsxCli, entry], {
    cwd: REPO_ROOT,
    env: sharedEnv(),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backend.on('error', (err) => {
    dialog.showErrorBox('Morgendrot Messenger', 'Backend konnte nicht gestartet werden:\n' + (err && err.message));
  });
  backend.on('exit', (code, signal) => {
    if (uiReady) return;
    if (code !== 0 && code !== null && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Morgendrot Messenger',
        message:
          'Backend beendet (Code ' +
          code +
          (signal ? ', ' + signal : '') +
          ').\nPrüfe .env und ob Port ' +
          API_PORT +
          ' frei ist.',
      });
    }
  });
}

function startNext() {
  const frontendDir = path.join(REPO_ROOT, 'frontend');
  const nextBin = path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  if (!fs.existsSync(nextBin)) {
    dialog.showErrorBox(
      'Morgendrot Messenger',
      'Next fehlt.\nErwartet: ' + nextBin + '\n\nIm Repo: cd frontend && npm install'
    );
    return;
  }
  // Direkt node+next — kein npm.cmd (unter Electron/Windows: spawn EINVAL ohne shell).
  nextProc = spawn(
    nodeExecutable(),
    [nextBin, 'dev', '--webpack', '--port', String(NEXT_UI_PORT), '--hostname', '127.0.0.1'],
    {
      cwd: frontendDir,
      env: sharedEnv(),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  nextProc.on('error', (err) => {
    dlog('next error ' + (err && err.message));
    dialog.showErrorBox(
      'Morgendrot Messenger',
      'Next-UI konnte nicht gestartet werden:\n' + (err && err.message) + '\n\nIm Repo: cd frontend && npm install'
    );
  });
}

function killChildren() {
  killTree(nextProc);
  nextProc = null;
  killTree(backend);
  backend = null;
}

/** Warte auf Next :3341 (normale Messenger-UI). API allein reicht nicht. */
function startReadyPoll() {
  if (pollTimer || uiReady) return;
  let tries = 0;
  const maxTries = 180; // ~90s — Next cold start
  pollTimer = setInterval(async () => {
    tries++;
    if (uiReady) {
      clearInterval(pollTimer);
      pollTimer = null;
      return;
    }
    // Node-http (nicht Chromium-fetch) — sonst bleibt der Splash oft hängen.
    const up = await probeUrl(`http://127.0.0.1:${NEXT_UI_PORT}/`, 1500);
    if (tries === 1 || tries % 10 === 0) dlog('poll try=' + tries + ' up=' + up);
    if (up) {
      loadNextUi();
      return;
    }
    if (tries >= maxTries) {
      clearInterval(pollTimer);
      pollTimer = null;
      if (!uiReady && mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Morgendrot Messenger',
          message:
            'Next-Messenger auf Port ' +
            NEXT_UI_PORT +
            ' nicht erreichbar.\n\n' +
            'Wie bei npm run dm: im Repo frontend/node_modules prüfen;\n' +
            'Ports ' +
            API_PORT +
            '/' +
            NEXT_UI_PORT +
            ' freihalten.',
        });
      }
    }
  }, 500);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (uiReady) mainWindow.loadURL(`http://127.0.0.1:${NEXT_UI_PORT}/`);
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    REPO_ROOT = getRepoRoot();
    if (!REPO_ROOT) {
      const hint = [
        process.env.PORTABLE_EXECUTABLE_DIR || '(keine PORTABLE_EXECUTABLE_DIR)',
        process.execPath || '(kein execPath)',
        __dirname,
      ].join('\n');
      dialog.showErrorBox(
        'Morgendrot Messenger',
        'Kein Morgendrot-Repo gefunden (src/start-with-secrets.ts).\n\n' +
          'Portable-EXE muss im Repo liegen, z. B.\n' +
          '…\\morgendrot\\exports\\messenger-desktop-exe\\\n\n' +
          'Gesucht ab:\n' +
          hint
      );
      app.quit();
      return;
    }

    const tsxCli = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const entry = path.join(REPO_ROOT, 'src', 'start-with-secrets.ts');
    if (!fs.existsSync(tsxCli) || !fs.existsSync(entry)) {
      dialog.showErrorBox(
        'Morgendrot Messenger',
        'Repo gefunden, aber Start-Dateien fehlen:\n' +
          REPO_ROOT +
          '\n\nAusführen: npm install im Repo.\n' +
          'Erwartet: node_modules/tsx und src/start-with-secrets.ts'
      );
      app.quit();
      return;
    }
    dlog('ready repo=' + REPO_ROOT + ' log=' + DEBUG_LOG);
    showLoadingWindow();
    try {
      startBackend();
    } catch (err) {
      dlog('startBackend throw ' + (err && err.message));
    }
    try {
      startNext();
    } catch (err) {
      dlog('startNext throw ' + (err && err.message));
    }
    // Poll immer — auch wenn Next schon von außen läuft oder spawn scheiterte.
    setTimeout(startReadyPoll, 1500);
  });

  app.on('window-all-closed', () => {
    killChildren();
    app.quit();
  });

  app.on('before-quit', () => {
    killChildren();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      showLoadingWindow();
      if (uiReady) loadNextUi();
    }
  });
}

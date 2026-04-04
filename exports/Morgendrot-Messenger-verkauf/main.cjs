'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');

/** Zuerst Standalone (main.cjs neben src/), sonst Repo ein Ordner darüber (morgendrot-messenger-desktop/). */
function getRepoRoot() {
  const here = path.resolve(__dirname);
  const parent = path.resolve(here, '..');
  if (fs.existsSync(path.join(here, 'src', 'start-with-secrets.ts'))) return here;
  if (fs.existsSync(path.join(parent, 'src', 'start-with-secrets.ts'))) return parent;
  return null;
}

/** Wird in app.whenReady gesetzt. */
let REPO_ROOT;

let backend = null;
let mainWindow = null;
let uiPort = null;
let pollTimer = null;

const LITE_UI_RE = /Lite-UI:\s*http:\/\/127\.0\.0\.1:(\d+)\//;

function extractPort(chunk) {
  const m = String(chunk).match(LITE_UI_RE);
  return m ? parseInt(m[1], 10) : null;
}

function showLoadingWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return;
  mainWindow = new BrowserWindow({
    width: 920,
    height: 780,
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
    '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#020617;color:#94a3b8;font-family:system-ui,sans-serif;font-size:15px;">' +
    'Backend startet …</body></html>';
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function loadMessengerUi(port) {
  if (!port || port < 1 || port > 65535) return;
  uiPort = port;
  const url = `http://127.0.0.1:${port}/#chat`;
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = new BrowserWindow({
      width: 920,
      height: 780,
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
  mainWindow.loadURL(url);
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

function startBackend() {
  const env = {
    ...process.env,
    UI_VARIANT: 'messenger',
    ENABLE_UI: 'true',
  };
  const tsxCli = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const entry = path.join(REPO_ROOT, 'src', 'start-with-secrets.ts');
  const nodeBin = nodeExecutable();
  backend = spawn(nodeBin, [tsxCli, entry], {
    cwd: REPO_ROOT,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let acc = '';
  function onData(d) {
    acc += d.toString();
    const lines = acc.split(/\r?\n/);
    acc = lines.pop() || '';
    for (const line of lines) {
      const p = extractPort(line);
      if (p) {
        loadMessengerUi(p);
        return;
      }
    }
    const tail = extractPort(acc);
    if (tail) loadMessengerUi(tail);
  }
  backend.stdout.on('data', onData);
  backend.stderr.on('data', onData);
  backend.on('error', (err) => {
    dialog.showErrorBox('Morgendrot Messenger', 'Backend konnte nicht gestartet werden:\n' + (err && err.message));
  });
  backend.on('exit', (code, signal) => {
    if (uiPort) return;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (code !== 0 && code !== null && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Morgendrot Messenger',
        message: 'Backend beendet (Code ' + code + (signal ? ', ' + signal : '') + ').\nPrüfe .env (z. B. ENABLE_UI=true) und ob Port API_PORT frei ist.',
      });
    }
  });
}

function killBackendTree() {
  if (!backend || backend.killed) {
    backend = null;
    return;
  }
  try {
    backend.kill('SIGTERM');
  } catch (_) {}
  backend = null;
}

/** Fallback, falls die Log-Zeile nicht erkannt wird (z. B. anderes Log-Format). */
function startPortPoll() {
  if (pollTimer || uiPort) return;
  let tries = 0;
  const maxTries = 120;
  pollTimer = setInterval(async () => {
    tries++;
    if (uiPort) {
      clearInterval(pollTimer);
      pollTimer = null;
      return;
    }
    for (let p = 3342; p <= 3348; p++) {
      try {
        const r = await fetch(`http://127.0.0.1:${p}/api/status`);
        if (!r.ok) continue;
        const j = await r.json();
        if (j && j.backendRunning && j.uiVariant === 'messenger') {
          loadMessengerUi(p);
          return;
        }
      } catch (_) {}
    }
    if (tries >= maxTries) {
      clearInterval(pollTimer);
      pollTimer = null;
      if (!uiPort && mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Morgendrot Messenger',
          message:
            'Kein Messenger-Backend erkannt (Port 3342–3348, uiVariant=messenger).\n' +
            'In diesem Ordner: npm install; .env mit ENABLE_UI=true; ggf. API_PORT prüfen.',
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
      if (uiPort) mainWindow.loadURL(`http://127.0.0.1:${uiPort}/#chat`);
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    REPO_ROOT = getRepoRoot();
    const tsxCli = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const entry = path.join(REPO_ROOT, 'src', 'start-with-secrets.ts');
    if (!REPO_ROOT || !fs.existsSync(tsxCli) || !fs.existsSync(entry)) {
      dialog.showErrorBox(
        'Morgendrot Messenger',
        'Kein gültiges Morgendrot-Paket: Erwartet wird main.cjs neben src/ (Standalone-Ordner) oder im Unterordner morgendrot-messenger-desktop mit Repo darüber.\n' +
          'Ausführen: npm install (im App-Ordner). Bundle bauen: npm run bundle:messenger im Hauptrepo.'
      );
      app.quit();
      return;
    }
    showLoadingWindow();
    startBackend();
    setTimeout(startPortPoll, 2000);
  });

  app.on('window-all-closed', () => {
    killBackendTree();
    app.quit();
  });

  app.on('before-quit', () => {
    killBackendTree();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      showLoadingWindow();
      if (uiPort) loadMessengerUi(uiPort);
    }
  });
}

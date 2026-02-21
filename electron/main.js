const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const APP_PORT = 3000;
const HEALTH_URL = `http://127.0.0.1:${APP_PORT}/health`;
const START_TIMEOUT_MS = 120000;
const POLL_INTERVAL_MS = 1000;

let mainWindow = null;
let backendProcess = null;
let isQuitting = false;

function resolveBackendExePath() {
  const candidates = [
    path.join(app.getAppPath(), 'release', 'ValorantTrackerBackend.exe'),
    path.join(process.resourcesPath, 'release', 'ValorantTrackerBackend.exe'),
    path.join(path.dirname(process.execPath), 'release', 'ValorantTrackerBackend.exe')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function pingHealth() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await pingHealth()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

function startBackend() {
  const backendExe = resolveBackendExePath();
  if (!backendExe) {
    throw new Error(
      'Missing ValorantTrackerBackend.exe. Run `npm run electron:build:backend` first.'
    );
  }

  backendProcess = spawn(backendExe, [], {
    windowsHide: true,
    stdio: 'ignore'
  });

  backendProcess.on('exit', (code) => {
    if (!isQuitting && code !== 0) {
      dialog.showErrorBox(
        'Backend stopped',
        `Valorant backend exited unexpectedly (code ${code}).`
      );
      app.quit();
    }
  });
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) {
    return;
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(backendProcess.pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore'
    });
    return;
  }

  backendProcess.kill('SIGTERM');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(`http://127.0.0.1:${APP_PORT}`);
}

async function bootstrap() {
  startBackend();

  const backendReady = await waitForServer(START_TIMEOUT_MS);
  if (!backendReady) {
    throw new Error(
      'Backend did not become ready in time. Try rebuilding with `npm run electron:build:backend`.'
    );
  }

  createWindow();
}

app.whenReady().then(async () => {
  try {
    await bootstrap();
  } catch (err) {
    dialog.showErrorBox('Startup error', err.message);
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow) {
    createWindow();
  }
});

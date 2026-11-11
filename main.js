const { app, BrowserWindow, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

const APP_URL = 'https://festivo.s-afamilyevent.workers.dev/';
const ALLOWED_HOSTS = new Set(['festivo.s-afamilyevent.workers.dev', 'music-loto.s-afamilyevent.workers.dev']);
let hostWindow = null;
const tvWindows = new Set();

function isAllowedAppUrl(raw) {
  try {
    return ALLOWED_HOSTS.has(new URL(raw).hostname);
  } catch {
    return false;
  }
}

function isTelegramAuthUrl(raw) {
  try {
    const url = new URL(raw);
    return url.hostname === 'oauth.telegram.org' ||
      url.hostname === 'telegram.org' ||
      url.hostname.endsWith('.telegram.org') ||
      url.hostname === 't.me';
  } catch {
    return false;
  }
}

function configureWindowOpen(win, title) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Keep Telegram authentication in an Electron popup so the login
    // widget can return its result to the original FESTIVO window.
    if (isTelegramAuthUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          minWidth: 420,
          minHeight: 500,
          autoHideMenuBar: true,
          title: 'FESTIVO — вход через Telegram',
          parent: win,
          modal: false,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          }
        }
      };
    }

    if (isAllowedAppUrl(url)) {
      createAppWindow(url, title);
    } else {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

function createAppWindow(url, title = 'FESTIVO — экран для гостей') {
  if (!isAllowedAppUrl(url)) {
    shell.openExternal(url);
    return null;
  }

  const target = new URL(url);
  const isMusicLoto = target.hostname === 'music-loto.s-afamilyevent.workers.dev';
  const isProjector = isMusicLoto && target.searchParams.get('projector') === '1';

  // Music Loto projector is always a real Electron BrowserWindow.
  // It must never be delegated to the user's default browser.
  const windowTitle = isProjector
    ? 'FESTIVO — Музыкальное лото · Проектор'
    : isMusicLoto
      ? 'FESTIVO — Музыкальное лото'
      : title;

  const win = new BrowserWindow({
    width: isProjector ? 1600 : 1440,
    height: isProjector ? 900 : 900,
    minWidth: isProjector ? 960 : 800,
    minHeight: isProjector ? 540 : 450,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0b24',
    title: windowTitle,
    resizable: true,
    fullscreen: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  tvWindows.add(win);
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => tvWindows.delete(win));
  configureWindowOpen(win, title);
  win.webContents.on('will-navigate', (event, target) => {
    if (!isAllowedAppUrl(target) && !isTelegramAuthUrl(target)) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });
  win.loadURL(url);
  return win;
}

function createHostWindow() {
  hostWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 980,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    title: 'FESTIVO — панель ведущего',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  configureWindowOpen(hostWindow, 'FESTIVO — экран для гостей');
  hostWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedAppUrl(url) && !isTelegramAuthUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  hostWindow.once('ready-to-show', () => hostWindow.show());
  hostWindow.on('closed', () => { hostWindow = null; });
  hostWindow.loadURL(APP_URL);
}


// Automatic in-app updates. The first updater-enabled build is installed once;
// all later versions download and install from inside FESTIVO.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;

function showUpdateDialog(options) {
  return hostWindow && !hostWindow.isDestroyed()
    ? dialog.showMessageBox(hostWindow, options)
    : dialog.showMessageBox(options);
}

autoUpdater.on('update-available', async (info) => {
  const result = await showUpdateDialog({
    type: 'info',
    title: 'Доступно обновление FESTIVO',
    message: `Доступна новая версия FESTIVO ${info.version}.`,
    detail: 'Скачать обновление сейчас? Программа продолжит работать во время загрузки.',
    buttons: ['Скачать обновление', 'Позже'],
    defaultId: 0,
    cancelId: 1
  });
  if (result.response === 0) autoUpdater.downloadUpdate().catch((error) => console.error('FESTIVO update download:', error));
});

autoUpdater.on('download-progress', (progress) => {
  if (hostWindow && !hostWindow.isDestroyed()) {
    hostWindow.setProgressBar(Math.max(0, Math.min(1, progress.percent / 100)));
  }
});

autoUpdater.on('update-downloaded', async (info) => {
  if (hostWindow && !hostWindow.isDestroyed()) hostWindow.setProgressBar(-1);
  const result = await showUpdateDialog({
    type: 'info',
    title: 'Обновление FESTIVO готово',
    message: `Версия ${info.version} уже загружена.`,
    detail: 'Перезапустить FESTIVO и установить обновление сейчас?',
    buttons: ['Перезапустить и обновить', 'Позже'],
    defaultId: 0,
    cancelId: 1
  });
  if (result.response === 0) autoUpdater.quitAndInstall(false, true);
});

autoUpdater.on('error', (error) => console.error('FESTIVO auto-update:', error));

function checkForAppUpdates() {
  if (app.isPackaged && process.platform === 'win32') {
    autoUpdater.checkForUpdates().catch((error) => console.error('FESTIVO update check:', error));
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.festivo.desktop');
  createHostWindow();
  setTimeout(checkForAppUpdates, 8000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createHostWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const { app, BrowserWindow, shell } = require('electron');

const APP_URL = 'https://festivo.s-afamilyevent.workers.dev/';
const ALLOWED_HOST = 'festivo.s-afamilyevent.workers.dev';
let hostWindow = null;
const tvWindows = new Set();

function isFestivoUrl(raw) {
  try {
    return new URL(raw).hostname === ALLOWED_HOST;
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

    if (isFestivoUrl(url)) {
      createAppWindow(url, title);
    } else {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

function createAppWindow(url, title = 'FESTIVO — экран для гостей') {
  if (!isFestivoUrl(url)) {
    shell.openExternal(url);
    return null;
  }

  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 800,
    minHeight: 450,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0b24',
    title,
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
    if (!isFestivoUrl(target) && !isTelegramAuthUrl(target)) {
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
    if (!isFestivoUrl(url) && !isTelegramAuthUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  hostWindow.once('ready-to-show', () => hostWindow.show());
  hostWindow.on('closed', () => { hostWindow = null; });
  hostWindow.loadURL(APP_URL);
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.festivo.desktop');
  createHostWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createHostWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

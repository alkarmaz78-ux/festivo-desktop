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
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isFestivoUrl(target)) {
      createAppWindow(target);
    } else {
      shell.openExternal(target);
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, target) => {
    if (!isFestivoUrl(target)) {
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

  hostWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isFestivoUrl(url)) {
      createAppWindow(url);
    } else {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  hostWindow.webContents.on('will-navigate', (event, url) => {
    if (!isFestivoUrl(url)) {
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

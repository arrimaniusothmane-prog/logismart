import { app, BrowserWindow, ipcMain, nativeTheme, session, Notification } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * LogiSmart Desktop — processus principal Electron.
 *
 * Fonctionnalités natives :
 *   - Persistance de l'URL de l'API dans le store local
 *   - Thème sombre/clair synchronisé avec le système
 *   - Notifications système pour les alertes de livraison
 *   - Détection de connectivité réseau
 */

interface WindowState {
  width: number;
  height: number;
  isMaximized: boolean;
}

const DEFAULT_STATE: WindowState = {
  width: 1280,
  height: 800,
  isMaximized: false,
};

const STATE_PATH = join(app.getPath('userData'), 'window-state.json');

function getStoredState(): WindowState {
  try {
    if (existsSync(STATE_PATH)) {
      const raw = readFileSync(STATE_PATH, 'utf-8');
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    }
  } catch {
    // Fichier de state absent ou corrompu — on utilise les valeurs par défaut.
  }
  return DEFAULT_STATE;
}

function storeState(win: BrowserWindow): void {
  const bounds = win.getBounds();
  const state: WindowState = {
    width: bounds.width,
    height: bounds.height,
    isMaximized: win.isMaximized(),
  };
  try {
    writeFileSync(STATE_PATH, JSON.stringify(state));
  } catch {
    // Écriture du state impossible (lecture seule, etc.) — non bloquant.
  }
}

function createWindow(): void {
  const state = getStoredState();

  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f172a' : '#ffffff',
  });

  if (state.isMaximized) win.maximize();

  const startUrl = process.env.LOGISMART_URL || `file://${join(import.meta.dirname, '../renderer/index.html')}`;
  win.loadURL(startUrl);

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.once('ready-to-show', () => win.show());
  win.on('resize', () => storeState(win));
  win.on('close', () => storeState(win));
}

ipcMain.handle('api-config', () => ({
  apiUrl: process.env.LOGISMART_API_URL || 'http://localhost:4000',
  appName: 'LogiSmart Desktop',
  isDevelopment: !app.isPackaged,
}));

ipcMain.handle('show-notification', (_event, title: string, body: string) => {
  new Notification({ title, body }).show();
});

ipcMain.handle('get-theme', () => ({
  shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
}));

app.whenReady().then(() => {
  session.defaultSession.setUserAgent('LogiSmart Desktop');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

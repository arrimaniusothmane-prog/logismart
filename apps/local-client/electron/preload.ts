import { contextBridge, ipcRenderer } from 'electron';

/**
 * Pont sécurisé entre le main process et le renderer.
 * Seules les méthodes nécessaires sont exposées — le renderer
 * n'a jamais accès direct au Node API.
 */

contextBridge.exposeInMainWorld('electronAPI', {
  getApiConfig: () => ipcRenderer.invoke('api-config'),
  showNotification: (title: string, body: string) => ipcRenderer.invoke('show-notification', title, body),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onThemeChange: (cb: (theme: { shouldUseDarkColors: boolean }) => void) => {
    const listener = (_: unknown, theme: { shouldUseDarkColors: boolean }) => cb(theme);
    ipcRenderer.on('theme-changed', listener);
    return () => ipcRenderer.removeListener('theme-changed', listener);
  },
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),
  isElectron: true,
});

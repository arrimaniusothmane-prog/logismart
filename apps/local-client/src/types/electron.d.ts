export interface ElectronAPI {
  getApiConfig: () => Promise<{ apiUrl: string; appName: string; isDevelopment: boolean }>;
  showNotification: (_title: string, _body: string) => Promise<void>;
  getTheme: () => Promise<{ shouldUseDarkColors: boolean; theme: string }>;
  onThemeChange: (cb: (theme: { shouldUseDarkColors: boolean; theme: string }) => void) => () => void;
  toggleDevTools: () => void;
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

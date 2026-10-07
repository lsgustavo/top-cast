import { app, contextBridge, ipcRenderer } from 'electron';
import { APP_NAME } from '../shared/constants/app.js';
import type { TopCastApi } from '../shared/types/desktop-api.js';

const api: TopCastApi = {
  getAppInfo: () => ({
    name: APP_NAME,
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  }),
  screenCapture: {
    listSources: () => ipcRenderer.invoke('screen-capture:list-sources'),
    selectSource: (sourceId: string | null) =>
      ipcRenderer.invoke('screen-capture:select-source', sourceId),
  },
};

contextBridge.exposeInMainWorld('topCast', api);

declare global {
  interface Window {
    topCast: TopCastApi;
  }
}

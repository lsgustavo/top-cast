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
    supportsSystemAudio: process.platform === 'win32',
    listSources: () => ipcRenderer.invoke('screen-capture:list-sources'),
    selectSource: (sourceId: string | null, includeSystemAudio: boolean) =>
      ipcRenderer.invoke('screen-capture:select-source', sourceId, includeSystemAudio),
  },
};

contextBridge.exposeInMainWorld('topCast', api);

declare global {
  interface Window {
    topCast: TopCastApi;
  }
}

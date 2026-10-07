import { app, contextBridge } from 'electron';
import { APP_NAME } from '../shared/constants/app.js';
import type { TopCastApi } from '../shared/types/desktop-api.js';

const api: TopCastApi = {
  getAppInfo: () => ({
    name: APP_NAME,
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  }),
};

contextBridge.exposeInMainWorld('topCast', api);

declare global {
  interface Window {
    topCast: TopCastApi;
  }
}

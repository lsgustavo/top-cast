import { app, contextBridge, ipcRenderer } from 'electron';
import { APP_NAME } from '../shared/constants/app.js';
import type { ProcessAudioChunk, TopCastApi } from '../shared/types/desktop-api.js';

const api: TopCastApi = {
    copyToClipboard: (text: string) =>
    ipcRenderer.invoke('app:copy-to-clipboard', text),
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
  notifyParticipantJoined: (displayName: string) =>
    ipcRenderer.invoke('app:notify-participant-joined', displayName),
  onLeaveRoomShortcut: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('app:leave-room-shortcut', listener);
    return () => ipcRenderer.removeListener('app:leave-room-shortcut', listener);
  },
  processAudio: {
    isSupported: () => ipcRenderer.invoke('app:is-process-audio-supported'),
    start: (sourceId: string) => ipcRenderer.invoke('app:start-process-audio', sourceId),
    stop: () => ipcRenderer.invoke('app:stop-process-audio'),
    onChunk: (callback: (chunk: ProcessAudioChunk) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: ProcessAudioChunk) => callback(data);
      ipcRenderer.on('app:process-audio-chunk', listener);
      return () => ipcRenderer.removeListener('app:process-audio-chunk', listener);
    },
  },
};

contextBridge.exposeInMainWorld('topCast', api);

declare global {
  interface Window {
    topCast: TopCastApi;
  }
}

import {
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  session,
  type DesktopCapturerSource,
} from 'electron';
import type {
  CaptureSource,
  CaptureSourceSelection,
} from '../../shared/types/desktop-api.js';

const LIST_SOURCES_CHANNEL = 'screen-capture:list-sources';
const SELECT_SOURCE_CHANNEL = 'screen-capture:select-source';
const SOURCE_REFRESH_INTERVAL_MS = 30_000;

let activeWindow: BrowserWindow | null = null;
let availableSources = new Map<string, DesktopCapturerSource>();
let selectedSourceId: string | null = null;
let sourcesUpdatedAt = 0;
let selectionRequestId = 0;
let handlersRegistered = false;

export function configureScreenCapture(window: BrowserWindow): void {
  activeWindow = window;
  selectedSourceId = null;

  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  ipcMain.handle(LIST_SOURCES_CHANNEL, async (event): Promise<CaptureSource[]> => {
    if (!event.senderFrame || !isAuthorizedSender(event.sender, event.senderFrame)) {
      throw new Error('Unauthorized renderer requested desktop capture sources');
    }

    return refreshSources();
  });

  ipcMain.handle(
    SELECT_SOURCE_CHANNEL,
    async (event, sourceId: unknown): Promise<CaptureSourceSelection> => {
      if (!event.senderFrame || !isAuthorizedSender(event.sender, event.senderFrame)) {
        return { ok: false, error: 'UNAUTHORIZED' };
      }
      const requestId = ++selectionRequestId;
      selectedSourceId = null;
      if (sourceId === null) {
        return { ok: true };
      }
      if (typeof sourceId !== 'string' || !availableSources.has(sourceId)) {
        return { ok: false, error: 'SOURCE_NOT_AVAILABLE' };
      }

      if (Date.now() - sourcesUpdatedAt > SOURCE_REFRESH_INTERVAL_MS) {
        await refreshSources();
        if (!availableSources.has(sourceId)) {
          return { ok: false, error: 'SOURCE_NOT_AVAILABLE' };
        }
      }

      if (requestId !== selectionRequestId) {
        return { ok: false, error: 'SOURCE_NOT_AVAILABLE' };
      }
      selectedSourceId = sourceId;
      return { ok: true };
    },
  );

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    const source = selectedSourceId ? availableSources.get(selectedSourceId) : undefined;
    const isAuthorizedFrame = request.frame !== null &&
      activeWindow !== null &&
      request.frame === activeWindow.webContents.mainFrame;

    selectedSourceId = null;
    if (!source || !request.videoRequested || !isAuthorizedFrame) {
      callback(null);
      return;
    }

    callback({ video: source });
  }, { useSystemPicker: false });

  window.on('closed', () => {
    if (activeWindow === window) {
      activeWindow = null;
      selectedSourceId = null;
    }
  });
}

function isAuthorizedSender(
  sender: Electron.WebContents,
  senderFrame: Electron.WebFrameMain,
): boolean {
  return activeWindow !== null &&
    !activeWindow.isDestroyed() &&
    sender.id === activeWindow.webContents.id &&
    senderFrame === activeWindow.webContents.mainFrame;
}

async function refreshSources(): Promise<CaptureSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });

  availableSources = new Map(sources.map((source) => [source.id, source]));
  sourcesUpdatedAt = Date.now();

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    kind: source.id.startsWith('screen:') ? 'screen' : 'window',
    displayId: source.display_id,
    thumbnailDataUrl: source.thumbnail.toDataURL(),
  }));
}

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
let selectedSourceIncludesAudio = false;
let sourcesUpdatedAt = 0;
let selectionRequestId = 0;
let handlersRegistered = false;

export function configureScreenCapture(window: BrowserWindow): void {
  activeWindow = window;
  selectedSourceId = null;
  selectedSourceIncludesAudio = false;

  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
  if (permission === 'display-capture' || permission === 'media') {
    return true;
  }
  return false;
});
session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
  if (
    activeWindow !== null &&
    !activeWindow.isDestroyed() &&
    webContents.id === activeWindow.webContents.id &&
    (permission === 'display-capture' || permission === 'media')
  ) {
    callback(true);
    return;
  }
  callback(false);
});

  ipcMain.handle(LIST_SOURCES_CHANNEL, async (event): Promise<CaptureSource[]> => {
    if (!event.senderFrame || !isAuthorizedSender(event.sender, event.senderFrame)) {
      throw new Error('Unauthorized renderer requested desktop capture sources');
    }

    return refreshSources();
  });

  ipcMain.handle(
    SELECT_SOURCE_CHANNEL,
    async (event, sourceId: unknown, includeSystemAudio: unknown): Promise<CaptureSourceSelection> => {
      if (!event.senderFrame || !isAuthorizedSender(event.sender, event.senderFrame)) {
        return { ok: false, error: 'UNAUTHORIZED' };
      }
      if (typeof includeSystemAudio !== 'boolean') {
        return { ok: false, error: 'SOURCE_NOT_AVAILABLE' };
      }
      const requestId = ++selectionRequestId;
      selectedSourceId = null;
      selectedSourceIncludesAudio = false;
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
      selectedSourceIncludesAudio = includeSystemAudio && process.platform === 'win32';
      return { ok: true };
    },
  );

 session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
  const isAuthorizedFrame =
    request.frame !== null &&
    activeWindow !== null &&
    !activeWindow.isDestroyed() &&
    request.frame.routingId === activeWindow.webContents.mainFrame.routingId;

  const source = selectedSourceId ? availableSources.get(selectedSourceId) : undefined;
  const includeSystemAudio = selectedSourceIncludesAudio;

  selectedSourceId = null;
  selectedSourceIncludesAudio = false;

  if (!source || !request.videoRequested || !isAuthorizedFrame) {
    callback(null);
    return;
  }

  const isWholeScreen = source.id.startsWith('screen:');

  const shouldAttachAudio = request.audioRequested && includeSystemAudio && isWholeScreen;

  callback({
    video: source,
    ...(shouldAttachAudio && process.platform === 'win32'
      ? { audio: 'loopback' as const }
      : {}),
  });
}, { useSystemPicker: false });

  window.on('closed', () => {
    if (activeWindow === window) {
      activeWindow = null;
      selectedSourceId = null;
      selectedSourceIncludesAudio = false;
    }
  });
}

function isAuthorizedSender(
  sender: Electron.WebContents,
  senderFrame: Electron.WebFrameMain,
): boolean {
  return (
    activeWindow !== null &&
    !activeWindow.isDestroyed() &&
    sender.id === activeWindow.webContents.id &&
    senderFrame.routingId === activeWindow.webContents.mainFrame.routingId
  );
}

async function refreshSources(): Promise<CaptureSource[]> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 500, height: 280 },
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
      appIconDataUrl: source.appIcon ? source.appIcon.toDataURL() : undefined,
    }));
  } catch (error) {
    console.error('[ScreenCapture] Erro ao listar fontes de tela:', error);
    return [];
  }
}

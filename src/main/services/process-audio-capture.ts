import { BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface NativeAudioLoopback {
  isProcessLoopbackSupported: () => boolean;
  getProcessIdFromWindowHandle: (hwnd: number | string) => number;
  startProcessLoopback: (
    pid: number,
    callback: (samples: Float32Array, sampleRate: number, channels: number) => void,
  ) => boolean;
  stopProcessLoopback: () => boolean;
  isProcessLoopbackRunning: () => boolean;
}

let nativeModule: NativeAudioLoopback | null = null;
try {
  // Em dev, carrega de build/Release/audio_loopback.node a partir da raiz do projeto
  const addonPath = path.resolve(__dirname, '../../../build/Release/audio_loopback.node');
  nativeModule = require(addonPath) as NativeAudioLoopback;
} catch (error) {
  console.warn('[ProcessAudioCapture] Modulo nativo audio_loopback.node nao pode ser carregado:', error);
}

let activeWindow: BrowserWindow | null = null;
let handlersRegistered = false;

export function configureProcessAudioCapture(window: BrowserWindow): void {
  activeWindow = window;
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  ipcMain.handle('app:is-process-audio-supported', (): boolean => {
    return nativeModule ? nativeModule.isProcessLoopbackSupported() : false;
  });

  ipcMain.handle(
    'app:start-process-audio',
    (event, rawSourceId: unknown): { ok: boolean; pid?: number; error?: string } => {
      if (!isAuthorizedSender(event.sender, event.senderFrame)) {
        return { ok: false, error: 'Origem de requisicao nao autorizada' };
      }

      if (!nativeModule || !nativeModule.isProcessLoopbackSupported()) {
        return { ok: false, error: 'Captura isolada por processo nao suportada neste sistema' };
      }

      if (typeof rawSourceId !== 'string' || !rawSourceId.startsWith('window:')) {
        return { ok: false, error: 'Apenas origens do tipo janela suportam isolamento de processo' };
      }

      // Exemplo de sourceId: "window:131248:0" ou "window:131248"
      const parts = rawSourceId.split(':');
      const hwndStr = parts[1];
      if (!hwndStr) {
        return { ok: false, error: 'Handle de janela invalido' };
      }

      const pid = nativeModule.getProcessIdFromWindowHandle(hwndStr);
      if (!pid) {
        return { ok: false, error: 'Nao foi possivel identificar o PID do processo da janela' };
      }

      try {
        const started = nativeModule.startProcessLoopback(
          pid,
          (samples: Float32Array, sampleRate: number, channels: number) => {
            if (activeWindow && !activeWindow.isDestroyed()) {
              activeWindow.webContents.send('app:process-audio-chunk', {
                samples,
                sampleRate,
                channels,
              });
            }
          },
        );

        if (!started) {
          return { ok: false, error: 'Falha ao iniciar captura WASAPI para o processo' };
        }

        return { ok: true, pid };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao iniciar captura do processo';
        return { ok: false, error: message };
      }
    },
  );

  ipcMain.handle('app:stop-process-audio', (event): boolean => {
    if (!isAuthorizedSender(event.sender, event.senderFrame)) {
      return false;
    }

    if (nativeModule) {
      return nativeModule.stopProcessLoopback();
    }
    return true;
  });

  window.on('closed', () => {
    if (activeWindow === window) {
      if (nativeModule && nativeModule.isProcessLoopbackRunning()) {
        nativeModule.stopProcessLoopback();
      }
      activeWindow = null;
    }
  });
}

export function unregisterProcessAudioCapture(): void {
  if (nativeModule && nativeModule.isProcessLoopbackRunning()) {
    nativeModule.stopProcessLoopback();
  }
}

function isAuthorizedSender(
  sender: Electron.WebContents,
  senderFrame: Electron.WebFrameMain | null,
): boolean {
  return (
    activeWindow !== null &&
    !activeWindow.isDestroyed() &&
    sender.id === activeWindow.webContents.id &&
    senderFrame?.routingId === activeWindow.webContents.mainFrame.routingId
  );
}


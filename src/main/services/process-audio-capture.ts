import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync } from 'node:fs';
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
  startScreenIsolatedLoopback?: (
    callback: (samples: Float32Array, sampleRate: number, channels: number) => void,
  ) => boolean;
  stopProcessLoopback: () => boolean;
  isProcessLoopbackRunning: () => boolean;
}

let nativeModule: NativeAudioLoopback | null = null;
let nativeLoadError: string | null = null;

function resolveAddonCandidates(): string[] {
  const relative = path.join('build', 'Release', 'audio_loopback.node');
  const candidates: string[] = [];
  if (app.isPackaged) {
    // Arquivos .node precisam ficar fora do asar (ver build.asarUnpack no package.json).
    candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', relative));
  }
  candidates.push(path.join(app.getAppPath(), relative));
  // Em dev, carrega de build/Release/audio_loopback.node a partir da raiz do projeto
  candidates.push(path.resolve(__dirname, '../../..', relative));
  return [...new Set(candidates)];
}

if (process.platform === 'win32') {
  const errors: string[] = [];
  for (const addonPath of resolveAddonCandidates()) {
    if (!existsSync(addonPath)) {
      errors.push(`${addonPath}: arquivo inexistente`);
      continue;
    }
    try {
      nativeModule = require(addonPath) as NativeAudioLoopback;
      console.log(`[ProcessAudioCapture] Modulo nativo carregado: ${addonPath}`);
      break;
    } catch (error) {
      errors.push(`${addonPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!nativeModule) {
    nativeLoadError = errors.join(' | ');
    console.warn('[ProcessAudioCapture] Modulo nativo audio_loopback.node nao pode ser carregado:', nativeLoadError);
  }
} else {
  nativeLoadError = 'Captura isolada por processo disponivel somente no Windows';
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

      if (!nativeModule) {
        return {
          ok: false,
          error: `Modulo de audio isolado nao foi carregado (${nativeLoadError ?? 'motivo desconhecido'})`,
        };
      }
      if (!nativeModule.isProcessLoopbackSupported()) {
        return { ok: false, error: 'Captura isolada por processo requer Windows 10 build 20348+ ou Windows 11' };
      }

      if (typeof rawSourceId !== 'string' || (!rawSourceId.startsWith('window:') && !rawSourceId.startsWith('screen:'))) {
        return { ok: false, error: 'Origem de captura invalida para isolamento de audio' };
      }

      const sendChunkToRenderer = (samples: Float32Array, sampleRate: number, channels: number) => {
        if (activeWindow && !activeWindow.isDestroyed()) {
          activeWindow.webContents.send('app:process-audio-chunk', {
            samples,
            sampleRate,
            channels,
          });
        }
      };

      // Tela inteira ("Entire Screen"): aplica isolamento WASAPI excluindo processos de comunicacao em segundo plano
      if (rawSourceId.startsWith('screen:')) {
        if (typeof nativeModule.startScreenIsolatedLoopback === 'function') {
          try {
            const started = nativeModule.startScreenIsolatedLoopback(sendChunkToRenderer);
            if (!started) {
              return { ok: false, error: 'Falha ao iniciar captura isolada WASAPI para a tela inteira' };
            }
            return { ok: true, pid: process.pid };
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao iniciar captura isolada de tela inteira';
            return { ok: false, error: message };
          }
        }
        return { ok: false, error: 'Isolamento de tela inteira indisponivel no modulo nativo atual' };
      }

      // Exemplo de sourceId: "window:131248:0" ou "window:131248"
      const parts = rawSourceId.split(':');
      const hwndStr = parts[1];
      if (!hwndStr) {
        return { ok: false, error: 'Handle de janela invalido' };
      }

      const pid = nativeModule.getProcessIdFromWindowHandle(hwndStr);
      if (!pid) {
        console.warn(`[ProcessAudioCapture] PID nao encontrado para hwnd: "${hwndStr}" (rawSourceId: "${rawSourceId}")`);
        return { ok: false, error: 'Nao foi possivel identificar o PID do processo da janela' };
      }

      console.log(`[ProcessAudioCapture] Iniciando captura de audio para PID ${pid} (janela: ${hwndStr})`);

      try {
        const started = nativeModule.startProcessLoopback(pid, sendChunkToRenderer);

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
  _senderFrame: Electron.WebFrameMain | null,
): boolean {
  return (
    activeWindow !== null &&
    !activeWindow.isDestroyed() &&
    sender.id === activeWindow.webContents.id
  );
}


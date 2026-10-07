import type {
  IceServerConfiguration,
  IceServersResult,
} from '../../shared/types/signaling';
import type { SignalingClient } from './signaling-client';

const ICE_SERVERS_REQUEST_TIMEOUT_MS = 8_000;

export function validateIceServers(value: unknown): IceServerConfiguration[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('O servidor não retornou uma configuração ICE válida.');
  }

  return value.map((server: unknown) => {
    if (typeof server !== 'object' || server === null) {
      throw new Error('O servidor retornou uma configuração ICE inválida.');
    }

    const candidate = server as Partial<IceServerConfiguration>;
    const validUrls = typeof candidate.urls === 'string'
      ? candidate.urls.length > 0
      : Array.isArray(candidate.urls) &&
        candidate.urls.length > 0 &&
        candidate.urls.every((url) => typeof url === 'string' && url.length > 0);
    const hasUsername = candidate.username !== undefined;
    const hasCredential = candidate.credential !== undefined;

    if (
      !validUrls ||
      (hasUsername && typeof candidate.username !== 'string') ||
      (hasCredential && typeof candidate.credential !== 'string') ||
      hasUsername !== hasCredential ||
      (candidate.credentialType !== undefined && candidate.credentialType !== 'password')
    ) {
      throw new Error('O servidor retornou uma configuração ICE inválida.');
    }

    return candidate as IceServerConfiguration;
  });
}

export function requestIceServers(
  socket: SignalingClient,
  timeoutMs = ICE_SERVERS_REQUEST_TIMEOUT_MS,
): Promise<IceServerConfiguration[]> {
  if (!socket.connected) {
    return Promise.reject(new Error('O signaling está desconectado; não foi possível carregar TURN.'));
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('O servidor não respondeu à solicitação de configuração ICE.'));
    }, timeoutMs);

    socket.emit('webrtc:ice-servers', (result: IceServersResult) => {
      clearTimeout(timeout);
      if (!result.ok) {
        const messages: Record<typeof result.error, string> = {
          NOT_IN_ROOM: 'Entre em uma sala antes de configurar a conexão WebRTC.',
          RATE_LIMITED: 'Muitas solicitações de conexão. Aguarde e tente novamente.',
          SERVER_ERROR: 'O servidor não conseguiu configurar a conexão WebRTC.',
        };
        reject(new Error(messages[result.error]));
        return;
      }

      try {
        resolve(validateIceServers(result.iceServers));
      } catch (error) {
        reject(error);
      }
    });
  });
}

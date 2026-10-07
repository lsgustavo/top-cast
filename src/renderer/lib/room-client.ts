import type { RoomOperationResult } from '../../shared/types/signaling';
import type { SignalingClient } from './signaling-client';

const CONNECTION_TIMEOUT_MS = 8_000;
const REQUEST_TIMEOUT_MS = 8_000;

function ensureConnected(socket: SignalingClient): Promise<void> {
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Não foi possível conectar ao servidor de salas.'));
    }, CONNECTION_TIMEOUT_MS);

    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onConnectError = (error: Error) => {
      cleanup();
      reject(new Error(`Falha ao conectar ao servidor: ${error.message}`));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
    };

    socket.once('connect', onConnect);
    socket.once('connect_error', onConnectError);
    socket.connect();
  });
}

function sendRoomRequest(
  socket: SignalingClient,
  emit: (acknowledge: (result: RoomOperationResult) => void) => void,
): Promise<RoomOperationResult> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve({ ok: false, error: 'SERVER_ERROR' });
    }, REQUEST_TIMEOUT_MS);

    emit((result) => {
      window.clearTimeout(timeout);
      resolve(result);
    });
  });
}

export async function createRoom(
  socket: SignalingClient,
  displayName: string,
): Promise<RoomOperationResult> {
  await ensureConnected(socket);
  return sendRoomRequest(socket, (acknowledge) => {
    socket.emit('room:create', { displayName }, acknowledge);
  });
}

export async function joinRoom(
  socket: SignalingClient,
  inviteCode: string,
  displayName: string,
): Promise<RoomOperationResult> {
  await ensureConnected(socket);
  return sendRoomRequest(socket, (acknowledge) => {
    socket.emit('room:join', { inviteCode, displayName }, acknowledge);
  });
}

import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/types/signaling';

export type SignalingClient = Socket<ServerToClientEvents, ClientToServerEvents>;

const signalingUrl = import.meta.env.VITE_SIGNALING_URL ?? 'http://127.0.0.1:3001';

export function createSignalingClient(): SignalingClient {
  return io(signalingUrl, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    timeout: 5000,
  }) as SignalingClient;
}

import Fastify from 'fastify';
import { Server } from 'socket.io';
import { RoomService } from './services/room-service.js';
import { isValidDescriptionPayload, isValidIceCandidatePayload } from './services/signaling-validation.js';
import { createIceServerConfiguration, loadTurnConfiguration } from './services/ice-credentials.js';
import {
  SIGNALING_PROTOCOL_VERSION,
  type ClientToServerEvents,
  type IceServersResult,
  type InterServerEvents,
  type MicrophoneStateResult,
  type ServerToClientEvents,
  type SignalingSocketData,
} from '../shared/types/signaling.js';

const host = process.env.SIGNALING_HOST ?? '127.0.0.1';
const port = Number(process.env.SIGNALING_PORT ?? 3001);
const allowedOrigins = new Set([
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'null',
  ...(process.env.SIGNALING_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid SIGNALING_PORT: ${process.env.SIGNALING_PORT}`);
}

const app = Fastify({ logger: true });
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SignalingSocketData
>(app.server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Signaling CORS origin is not allowed: ${origin}`), false);
    },
    methods: ['GET', 'POST'],
  },
});
const roomService = new RoomService();
const turnConfiguration = loadTurnConfiguration(process.env);
const JOIN_ATTEMPT_WINDOW_MS = 60_000;
const MAX_JOIN_ATTEMPTS_PER_WINDOW = 10;
const joinAttemptsByAddress = new Map<string, { windowStartedAt: number; attempts: number }>();
const ICE_REQUEST_WINDOW_MS = 60_000;
const MAX_ICE_REQUESTS_PER_WINDOW = 10;

app.get('/health', async () => ({
  status: 'ok',
  service: 'top-cast-signaling',
  protocolVersion: SIGNALING_PROTOCOL_VERSION,
}));

io.on('connection', (socket) => {
  app.log.info({ socketId: socket.id }, 'Signaling client connected');

  socket.emit('server:ready', { protocolVersion: SIGNALING_PROTOCOL_VERSION });

  let iceRequestWindowStartedAt = 0;
  let iceRequestsInWindow = 0;

  socket.on('server:ping', (acknowledge) => {
    acknowledge({ serverTime: Date.now() });
  });

  socket.on('webrtc:ice-servers', (acknowledge) => {
    if (typeof acknowledge !== 'function') {
      app.log.warn({ socketId: socket.id }, 'Rejected webrtc:ice-servers without acknowledgment callback');
      return;
    }

    if (!socket.data.roomId || socket.data.participantId !== socket.id) {
      acknowledge({ ok: false, error: 'NOT_IN_ROOM' });
      return;
    }

    const now = Date.now();
    if (now - iceRequestWindowStartedAt >= ICE_REQUEST_WINDOW_MS) {
      iceRequestWindowStartedAt = now;
      iceRequestsInWindow = 0;
    }
    if (iceRequestsInWindow >= MAX_ICE_REQUESTS_PER_WINDOW) {
      acknowledge({ ok: false, error: 'RATE_LIMITED' });
      return;
    }
    iceRequestsInWindow += 1;

    try {
      const result: IceServersResult = {
        ok: true,
        iceServers: createIceServerConfiguration(socket.id, turnConfiguration, now),
      };
      acknowledge(result);
    } catch (error) {
      app.log.error({ error, socketId: socket.id }, 'Failed to create ICE server configuration');
      acknowledge({ ok: false, error: 'SERVER_ERROR' });
    }
  });

  socket.on('room:create', async (payload, acknowledge) => {
    if (typeof acknowledge !== 'function') {
      app.log.warn({ socketId: socket.id }, 'Rejected room:create without acknowledgment callback');
      return;
    }

    try {
      const result = roomService.create(socket.id, payload?.displayName);
      if (!result.ok) {
        acknowledge(result);
        return;
      }

      socket.data.roomId = result.room.id;
      socket.data.participantId = socket.id;
      await socket.join(result.room.id);
      acknowledge(result);
      io.to(result.room.id).emit('room:updated', result.room);
    } catch (error) {
      app.log.error({ error, socketId: socket.id }, 'Failed to create room');
      acknowledge({ ok: false, error: 'SERVER_ERROR' });
    }
  });

  socket.on('room:join', async (payload, acknowledge) => {
    if (typeof acknowledge !== 'function') {
      app.log.warn({ socketId: socket.id }, 'Rejected room:join without acknowledgment callback');
      return;
    }

    if (!consumeJoinAttempt(socket.handshake.address)) {
      acknowledge({ ok: false, error: 'RATE_LIMITED' });
      return;
    }

    try {
      const result = roomService.join(socket.id, payload?.inviteCode, payload?.displayName);
      if (!result.ok) {
        acknowledge(result);
        return;
      }

      socket.data.roomId = result.room.id;
      socket.data.participantId = socket.id;
      await socket.join(result.room.id);
      acknowledge(result);
      io.to(result.room.id).emit('room:updated', result.room);
    } catch (error) {
      app.log.error({ error, socketId: socket.id }, 'Failed to join room');
      acknowledge({ ok: false, error: 'SERVER_ERROR' });
    }
  });

  socket.on('room:leave', (acknowledge) => {
    if (typeof acknowledge !== 'function') {
      app.log.warn({ socketId: socket.id }, 'Rejected room:leave without acknowledgment callback');
      return;
    }

    const result = roomService.leave(socket.id);
    if (!result) {
      socket.data.roomId = undefined;
      socket.data.participantId = undefined;
      acknowledge({ ok: true });
      return;
    }

    socket.data.roomId = undefined;
    socket.data.participantId = undefined;

    if (result.roomClosed) {
      closeRoomSockets(result.roomId);
      io.to(result.roomId).emit('room:closed', { reason: 'host-left' });
      io.in(result.roomId).socketsLeave(result.roomId);
    } else if (result.snapshot) {
      io.to(result.roomId).emit('room:updated', result.snapshot);
      void socket.leave(result.roomId);
    }

    acknowledge({ ok: true });
  });

  socket.on('room:microphone', (payload, acknowledge) => {
    if (typeof acknowledge !== 'function') {
      app.log.warn({ socketId: socket.id }, 'Rejected room:microphone without acknowledgment callback');
      return;
    }

    let result: MicrophoneStateResult;
    if (typeof payload?.enabled !== 'boolean') {
      result = { ok: false, error: 'INVALID_STATE' };
    } else {
      const snapshot = roomService.setMicrophoneEnabled(socket.id, payload.enabled);
      if (!snapshot) {
        result = { ok: false, error: 'NOT_IN_ROOM' };
      } else {
        io.to(snapshot.id).emit('room:updated', snapshot);
        result = { ok: true };
      }
    }

    acknowledge(result);
  });

  socket.on('webrtc:description', (payload, acknowledge) => {
    if (typeof acknowledge !== 'function') {
      app.log.warn({ socketId: socket.id }, 'Rejected webrtc:description without acknowledgment callback');
      return;
    }

    if (!isValidDescriptionPayload(payload)) {
      acknowledge({ ok: false, error: 'INVALID_SIGNAL' });
      return;
    }

    const error = roomService.authorizeSignal(
      socket.id,
      payload.toParticipantId,
      payload.description.type,
    );
    if (error) {
      acknowledge({ ok: false, error });
      return;
    }

    app.log.info(
      { fromParticipantId: socket.id, toParticipantId: payload.toParticipantId, type: payload.description.type },
      'Relaying WebRTC session description',
    );
    io.to(payload.toParticipantId).emit('webrtc:description', {
      fromParticipantId: socket.id,
      description: payload.description,
    });
    acknowledge({ ok: true });
  });

  socket.on('webrtc:ice-candidate', (payload, acknowledge) => {
    if (typeof acknowledge !== 'function') {
      app.log.warn({ socketId: socket.id }, 'Rejected webrtc:ice-candidate without acknowledgment callback');
      return;
    }

    if (!isValidIceCandidatePayload(payload)) {
      acknowledge({ ok: false, error: 'INVALID_SIGNAL' });
      return;
    }

    const error = roomService.authorizeSignal(
      socket.id,
      payload.toParticipantId,
      'ice-candidate',
    );
    if (error) {
      acknowledge({ ok: false, error });
      return;
    }

    app.log.info(
      { fromParticipantId: socket.id, toParticipantId: payload.toParticipantId },
      'Relaying WebRTC ICE candidate',
    );
    io.to(payload.toParticipantId).emit('webrtc:ice-candidate', {
      fromParticipantId: socket.id,
      candidate: payload.candidate,
    });
    acknowledge({ ok: true });
  });

  socket.on('disconnect', (reason) => {
    const result = roomService.leave(socket.id);
    if (result?.roomClosed) {
      closeRoomSockets(result.roomId);
      io.to(result.roomId).emit('room:closed', { reason: 'host-left' });
      io.in(result.roomId).socketsLeave(result.roomId);
    } else if (result?.snapshot) {
      io.to(result.roomId).emit('room:updated', result.snapshot);
    }

    app.log.info({ socketId: socket.id, reason }, 'Signaling client disconnected');
  });
});

function closeRoomSockets(roomId: string): void {
  for (const connectedSocket of io.sockets.sockets.values()) {
    if (connectedSocket.data.roomId === roomId) {
      connectedSocket.data.roomId = undefined;
      connectedSocket.data.participantId = undefined;
    }
  }
}

function consumeJoinAttempt(address: string, now = Date.now()): boolean {
  const current = joinAttemptsByAddress.get(address);
  if (!current || now - current.windowStartedAt >= JOIN_ATTEMPT_WINDOW_MS) {
    joinAttemptsByAddress.set(address, { windowStartedAt: now, attempts: 1 });
    return true;
  }

  if (current.attempts >= MAX_JOIN_ATTEMPTS_PER_WINDOW) {
    return false;
  }

  current.attempts += 1;
  return true;
}

const roomExpiryTimer = setInterval(() => {
  const now = Date.now();
  for (const [address, attempts] of joinAttemptsByAddress) {
    if (now - attempts.windowStartedAt >= JOIN_ATTEMPT_WINDOW_MS) {
      joinAttemptsByAddress.delete(address);
    }
  }

  for (const roomId of roomService.expireRooms(now)) {
    closeRoomSockets(roomId);
    io.to(roomId).emit('room:closed', { reason: 'expired' });
    io.in(roomId).socketsLeave(roomId);
  }
}, 60_000);
roomExpiryTimer.unref();

app.addHook('onClose', async () => {
  clearInterval(roomExpiryTimer);
  await io.close();
});

async function start(): Promise<void> {
  await app.listen({ host, port });
}

void start().catch((error: unknown) => {
  app.log.error(error, 'Failed to start signaling server');
  process.exitCode = 1;
});

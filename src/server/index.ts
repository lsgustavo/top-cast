import Fastify from 'fastify';
import { Server } from 'socket.io';
import { RoomService } from './services/room-service.js';
import {
  SIGNALING_PROTOCOL_VERSION,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SignalingSocketData,
  type WebRtcDescriptionPayload,
  type WebRtcIceCandidatePayload,
} from '../shared/types/signaling.js';

const host = process.env.SIGNALING_HOST ?? '127.0.0.1';
const port = Number(process.env.SIGNALING_PORT ?? 3001);

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
    origin: ['http://localhost:4173', 'http://127.0.0.1:4173'],
    methods: ['GET', 'POST'],
  },
});
const roomService = new RoomService();
const JOIN_ATTEMPT_WINDOW_MS = 60_000;
const MAX_JOIN_ATTEMPTS_PER_WINDOW = 10;
const joinAttemptsByAddress = new Map<string, { windowStartedAt: number; attempts: number }>();

app.get('/health', async () => ({
  status: 'ok',
  service: 'top-cast-signaling',
  protocolVersion: SIGNALING_PROTOCOL_VERSION,
}));

io.on('connection', (socket) => {
  app.log.info({ socketId: socket.id }, 'Signaling client connected');

  socket.emit('server:ready', { protocolVersion: SIGNALING_PROTOCOL_VERSION });

  socket.on('server:ping', (acknowledge) => {
    acknowledge({ serverTime: Date.now() });
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

function isValidDescriptionPayload(value: unknown): value is WebRtcDescriptionPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<WebRtcDescriptionPayload>;
  const description = payload.description;
  return (
    typeof payload.toParticipantId === 'string' &&
    payload.toParticipantId.length > 0 &&
    typeof description === 'object' &&
    description !== null &&
    (description.type === 'offer' || description.type === 'answer') &&
    typeof description.sdp === 'string' &&
    description.sdp.length > 0 &&
    description.sdp.length <= 256_000
  );
}

function isValidIceCandidatePayload(value: unknown): value is WebRtcIceCandidatePayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<WebRtcIceCandidatePayload>;
  const candidate = payload.candidate;
  return (
    typeof payload.toParticipantId === 'string' &&
    payload.toParticipantId.length > 0 &&
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.candidate === 'string' &&
    candidate.candidate.length <= 4_096 &&
    (typeof candidate.sdpMid === 'string' || candidate.sdpMid === null) &&
    (typeof candidate.sdpMLineIndex === 'number' || candidate.sdpMLineIndex === null)
  );
}

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

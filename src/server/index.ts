import Fastify from 'fastify';
import { Server } from 'socket.io';
import {
  SIGNALING_PROTOCOL_VERSION,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SignalingSocketData,
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

  socket.on('disconnect', (reason) => {
    app.log.info({ socketId: socket.id, reason }, 'Signaling client disconnected');
  });
});

app.addHook('onClose', async () => {
  await io.close();
});

async function start(): Promise<void> {
  await app.listen({ host, port });
}

void start().catch((error: unknown) => {
  app.log.error(error, 'Failed to start signaling server');
  process.exitCode = 1;
});

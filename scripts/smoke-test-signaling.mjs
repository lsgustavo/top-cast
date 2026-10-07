import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const signalingUrl = process.env.SIGNALING_URL ?? 'http://127.0.0.1:3001';
const ACK_TIMEOUT_MS = 5_000;
const sockets = [];

function connectClient(url) {
  const socket = io(url, {
    autoConnect: false,
    reconnection: false,
    timeout: ACK_TIMEOUT_MS,
  });
  sockets.push(socket);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Timed out connecting to signaling server at ${url}`));
    }, ACK_TIMEOUT_MS);

    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    socket.connect();
  });
}

function emitWithAck(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for acknowledgment from ${event}`));
    }, ACK_TIMEOUT_MS);

    socket.emit(event, ...args, (result) => {
      clearTimeout(timeout);
      resolve(result);
    });
  });
}

try {
  const [host, guest] = await Promise.all([
    connectClient(signalingUrl),
    connectClient(signalingUrl),
  ]);

  assert.deepEqual(await emitWithAck(guest, 'webrtc:ice-servers'), {
    ok: false,
    error: 'NOT_IN_ROOM',
  });

  const created = await emitWithAck(host, 'room:create', { displayName: 'Smoke host' });
  assert.equal(created.ok, true, `Room creation failed: ${created.error ?? 'unknown error'}`);

  const joined = await emitWithAck(guest, 'room:join', {
    inviteCode: created.room.inviteCode,
    displayName: 'Smoke guest',
  });
  assert.equal(joined.ok, true, `Room join failed: ${joined.error ?? 'unknown error'}`);
  assert.equal(joined.room.participants.length, 2);

  for (const socket of [host, guest]) {
    const iceResult = await emitWithAck(socket, 'webrtc:ice-servers');
    assert.equal(iceResult.ok, true, `ICE configuration failed: ${iceResult.error ?? 'unknown error'}`);
    assert.ok(iceResult.iceServers.some((server) => (
      typeof server.urls === 'string'
        ? server.urls.startsWith('stun:')
        : server.urls.some((url) => url.startsWith('stun:'))
    )), 'ICE configuration must include STUN');

    for (const server of iceResult.iceServers) {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      if (!urls.some((url) => url.startsWith('turn:') || url.startsWith('turns:'))) {
        continue;
      }
      assert.equal(typeof server.username, 'string');
      assert.equal(typeof server.credential, 'string');
      const expiry = Number(server.username.split(':', 1)[0]);
      const remainingSeconds = expiry - Math.floor(Date.now() / 1000);
      assert.ok(remainingSeconds > 0 && remainingSeconds <= 24 * 60 * 60);
    }
  }

  const forbiddenOffer = await emitWithAck(guest, 'webrtc:description', {
    toParticipantId: host.id,
    description: { type: 'offer', sdp: 'v=0' },
  });
  assert.deepEqual(forbiddenOffer, { ok: false, error: 'NOT_ALLOWED' });

  const roomClosed = new Promise((resolve) => {
    guest.once('room:closed', resolve);
  });
  const leaveResult = await emitWithAck(host, 'room:leave');
  assert.deepEqual(leaveResult, { ok: true });
  assert.deepEqual(await roomClosed, { reason: 'host-left' });

  console.log(`Signaling smoke test passed against ${signalingUrl}`);
} finally {
  for (const socket of sockets) {
    socket.disconnect();
  }
}

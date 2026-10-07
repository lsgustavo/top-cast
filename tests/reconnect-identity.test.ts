import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getReconnectIdentity } from '../src/renderer/lib/reconnect-identity.js';
import type { RoomSnapshot } from '../src/shared/types/signaling.js';

const room: RoomSnapshot = {
  id: 'room-1',
  inviteCode: 'ABCD-EFGH',
  expiresAt: 2_000_000,
  maxParticipants: 10,
  participants: [
    {
      id: 'host-1',
      displayName: 'Host name',
      role: 'host',
      joinedAt: 1_000,
    },
    {
      id: 'guest-1',
      displayName: 'Guest name',
      role: 'guest',
      joinedAt: 1_001,
    },
  ],
};

describe('reconnect identity', () => {
  it('preserves the correct participant identity from the room snapshot', () => {
    assert.deepEqual(getReconnectIdentity(room, 'host-1'), {
      inviteCode: 'ABCD-EFGH',
      participantId: 'host-1',
      displayName: 'Host name',
      role: 'host',
    });
    assert.deepEqual(getReconnectIdentity(room, 'guest-1'), {
      inviteCode: 'ABCD-EFGH',
      participantId: 'guest-1',
      displayName: 'Guest name',
      role: 'guest',
    });
  });

  it('returns no identity when the participant is not in the room', () => {
    assert.equal(getReconnectIdentity(room, 'unknown'), null);
    assert.equal(getReconnectIdentity(room, undefined), null);
  });
});

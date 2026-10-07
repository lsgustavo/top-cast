import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getParticipantChanges } from '../src/renderer/lib/participant-events.js';
import type { RoomSnapshot } from '../src/shared/types/signaling.js';

const host = {
  id: 'host',
  displayName: 'Host',
  role: 'host' as const,
  joinedAt: 1,
  presence: 'available' as const,
};
const guest = {
  id: 'guest',
  displayName: 'Guest',
  role: 'guest' as const,
  joinedAt: 2,
  presence: 'available' as const,
};
const room: RoomSnapshot = {
  id: 'room',
  inviteCode: 'ABC-123',
  expiresAt: 100,
  maxParticipants: 10,
  participants: [host],
};

describe('participant room changes', () => {
  it('does not treat first snapshots as join/leave notifications', () => {
    assert.deepEqual(getParticipantChanges(null, room), { joined: [], left: [] });
  });

  it('detects participants entering and leaving the same room', () => {
    const updatedRoom = { ...room, participants: [host, guest] };
    assert.deepEqual(getParticipantChanges(room, updatedRoom), { joined: [guest], left: [] });
    assert.deepEqual(getParticipantChanges(updatedRoom, room), { joined: [], left: [guest] });
  });
});

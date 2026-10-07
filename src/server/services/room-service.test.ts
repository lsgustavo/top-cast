import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RoomService } from './room-service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('RoomService', () => {
  it('creates an unpredictable-format invite and sets a 24-hour expiry', () => {
    const service = new RoomService();
    const now = 1_000_000;
    const result = service.create('host-socket', 'Host', now);

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.match(result.room.inviteCode, /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
    assert.equal(result.room.expiresAt, now + DAY_MS);
    assert.equal(result.room.maxParticipants, 10);
    assert.equal(result.room.participants.length, 1);
    assert.equal(result.room.participants[0]?.role, 'host');
    assert.equal(result.room.participants[0]?.presence, 'available');
  });

  it('accepts valid guests and enforces the ten-participant limit', () => {
    const service = new RoomService();
    const created = service.create('host', 'Host', 10);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    let latestSnapshot = created.room;
    for (let index = 1; index <= 9; index += 1) {
      const joined = service.join(`guest-${index}`, created.room.inviteCode, `Guest ${index}`, 20 + index);
      assert.equal(joined.ok, true);
      if (joined.ok) latestSnapshot = joined.room;
    }

    assert.equal(latestSnapshot.participants.length, 10);
    assert.deepEqual(
      service.join('guest-overflow', created.room.inviteCode, 'Overflow', 40),
      { ok: false, error: 'ROOM_FULL' },
    );
  });

  it('allows only one active room globally and reports availability', () => {
    const service = new RoomService();
    assert.deepEqual(service.getAvailability(), { active: false });
    const firstRoom = service.create('host-1', 'Host 1', 1);
    assert.equal(firstRoom.ok, true);
    assert.deepEqual(service.getAvailability(), { active: true });
    assert.deepEqual(service.create('host-2', 'Host 2', 2), { ok: false, error: 'ROOM_EXISTS' });

    if (!firstRoom.ok) return;
    service.leave('host-1', 3);
    assert.deepEqual(service.getAvailability(), { active: false });
    assert.equal(service.create('host-2', 'Host 2', 4).ok, true);
  });

  it('rejects missing, malformed, and expired invitation codes distinctly', () => {
    const service = new RoomService();
    assert.deepEqual(
      service.join('guest-a', 'not-a-code', 'Guest', 10),
      { ok: false, error: 'INVALID_CODE' },
    );

    const created = service.create('host', 'Host', 100);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    assert.deepEqual(
      service.join('guest-b', created.room.inviteCode, 'Guest', 100 + DAY_MS),
      { ok: false, error: 'ROOM_EXPIRED' },
    );
    assert.deepEqual(
      service.join('guest-c', created.room.inviteCode, 'Guest', 100 + DAY_MS + 1),
      { ok: false, error: 'ROOM_EXPIRED' },
    );
  });

  it('validates participant names and prevents a socket joining twice', () => {
    const service = new RoomService();
    assert.deepEqual(service.create('invalid-host', '   ', 1), { ok: false, error: 'INVALID_NAME' });
    assert.deepEqual(
      service.create('long-name-host', 'x'.repeat(33), 1),
      { ok: false, error: 'INVALID_NAME' },
    );
    const created = service.create('host', ' Host ', 10);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    assert.deepEqual(service.create('host', 'Host again', 11), { ok: false, error: 'ALREADY_IN_ROOM' });
    const joined = service.join('guest', created.room.inviteCode, ' Guest ', 12);
    assert.equal(joined.ok, true);
    if (!joined.ok) return;
    assert.equal(joined.room.participants[1]?.displayName, 'Guest');
    assert.deepEqual(
      service.join('guest', created.room.inviteCode, 'Guest again', 13),
      { ok: false, error: 'ALREADY_IN_ROOM' },
    );
  });

  it('removes guests on leave and closes the room when the host leaves', () => {
    const service = new RoomService();
    const created = service.create('host', 'Host', 100);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const joined = service.join('guest', created.room.inviteCode, 'Guest', 110);
    assert.equal(joined.ok, true);
    if (!joined.ok) return;

    const guestLeave = service.leave('guest', 120);
    assert.equal(guestLeave?.roomClosed, false);
    assert.equal(guestLeave?.snapshot?.participants.length, 1);

    const hostLeave = service.leave('host', 130);
    assert.equal(hostLeave?.roomClosed, true);
    assert.deepEqual(
      service.join('next-guest', created.room.inviteCode, 'Guest', 140),
      { ok: false, error: 'INVALID_CODE' },
    );
  });

  it('transfers host to the oldest remaining participant after an unexpected disconnect', () => {
    const service = new RoomService();
    const created = service.create('host', 'Host', 100);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const firstGuest = service.join('guest-1', created.room.inviteCode, 'Guest 1', 110);
    assert.equal(firstGuest.ok, true);
    const secondGuest = service.join('guest-2', created.room.inviteCode, 'Guest 2', 120);
    assert.equal(secondGuest.ok, true);

    const transfer = service.leave('host', 130, true);
    assert.equal(transfer?.roomClosed, false);
    assert.equal(transfer?.hostTransferred, true);
    assert.equal(transfer?.snapshot?.participants.find((person) => person.id === 'guest-1')?.role, 'host');
    assert.equal(transfer?.snapshot?.participants.find((person) => person.id === 'guest-2')?.role, 'guest');
    assert.equal(service.authorizeSignal('guest-1', 'guest-2', 'offer'), undefined);
    assert.deepEqual(service.getAvailability(), { active: true });
  });

  it('lets the host remove a participant and tracks valid presence states', () => {
    const service = new RoomService();
    const created = service.create('host', 'Host', 100);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const joined = service.join('guest', created.room.inviteCode, 'Guest', 110);
    assert.equal(joined.ok, true);
    if (!joined.ok) return;

    assert.equal(service.getParticipantRole('guest'), 'guest');
    assert.equal(service.setPresence('guest', 'busy')?.participants[1]?.presence, 'busy');
    assert.equal(service.setPresence('guest', 'unknown'), undefined);
    assert.equal(service.setPresence('outsider', 'away'), undefined);

    const removed = service.kick('host', 'guest');
    assert.equal(removed?.removedParticipantId, 'guest');
    assert.equal(removed?.snapshot?.participants.length, 1);
    assert.equal(service.getParticipantRole('guest'), undefined);
    assert.equal(service.kick('guest', 'host'), undefined);
  });

  it('closes rooms at expiry and keeps a temporary expired-code response', () => {
    const service = new RoomService();
    const created = service.create('host', 'Host', 500);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const expiryTime = 500 + DAY_MS;
    assert.deepEqual(service.expireRooms(expiryTime), [created.room.id]);
    assert.deepEqual(
      service.join('guest', created.room.inviteCode, 'Guest', expiryTime + 1),
      { ok: false, error: 'ROOM_EXPIRED' },
    );
    assert.deepEqual(service.expireRooms(expiryTime + DAY_MS + 1), []);
    assert.deepEqual(
      service.join('guest-after-retention', created.room.inviteCode, 'Guest', expiryTime + DAY_MS + 1),
      { ok: false, error: 'INVALID_CODE' },
    );
  });

  it('authorizes WebRTC signaling only between participants in one room', () => {
    const service = new RoomService();
    const created = service.create('host', 'Host', 100);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const joined = service.join('guest', created.room.inviteCode, 'Guest', 110);
    assert.equal(joined.ok, true);
    if (!joined.ok) return;
    const otherRoom = service.create('other-host', 'Other host', 120);
    assert.deepEqual(otherRoom, { ok: false, error: 'ROOM_EXISTS' });

    assert.equal(service.authorizeSignal('host', 'guest', 'offer'), undefined);
    assert.equal(service.authorizeSignal('guest', 'host', 'answer'), undefined);
    assert.equal(service.authorizeSignal('host', 'guest', 'ice-candidate'), undefined);
    assert.equal(service.authorizeSignal('guest', 'host', 'offer'), 'NOT_ALLOWED');
    assert.equal(service.authorizeSignal('host', 'other-host', 'offer'), 'PEER_NOT_IN_ROOM');
    assert.equal(service.authorizeSignal('not-a-member', 'guest', 'ice-candidate'), 'NOT_IN_ROOM');
  });

  it('tracks each participant microphone state and rejects non-members', () => {
    const service = new RoomService();
    const created = service.create('host', 'Host', 100);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const joined = service.join('guest', created.room.inviteCode, 'Guest', 110);
    assert.equal(joined.ok, true);
    if (!joined.ok) return;

    assert.equal(created.room.participants[0]?.microphoneEnabled, false);
    assert.equal(joined.room.participants[1]?.microphoneEnabled, false);

    const updated = service.setMicrophoneEnabled('guest', true);
    assert.equal(updated?.participants.find((participant) => participant.id === 'guest')?.microphoneEnabled, true);
    assert.equal(updated?.participants.find((participant) => participant.id === 'host')?.microphoneEnabled, false);
    assert.equal(service.setMicrophoneEnabled('outsider', true), undefined);
  });

  it('allows a disconnected guest to rejoin by invite with microphone off', () => {
    const service = new RoomService();
    const created = service.create('host', 'Host', 100);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const joined = service.join('first-guest-socket', created.room.inviteCode, 'Guest', 110);
    assert.equal(joined.ok, true);
    if (!joined.ok) return;

    service.setMicrophoneEnabled('first-guest-socket', true);
    service.leave('first-guest-socket', 120);
    const rejoined = service.join('reconnected-guest-socket', created.room.inviteCode, 'Guest', 130);
    assert.equal(rejoined.ok, true);
    if (!rejoined.ok) return;
    assert.equal(rejoined.room.participants.at(-1)?.id, 'reconnected-guest-socket');
    assert.equal(rejoined.room.participants.at(-1)?.microphoneEnabled, false);
  });
});

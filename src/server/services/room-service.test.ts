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

    assert.match(result.room.inviteCode, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(result.room.expiresAt, now + DAY_MS);
    assert.equal(result.room.maxParticipants, 10);
    assert.equal(result.room.participants.length, 1);
    assert.equal(result.room.participants[0]?.role, 'host');
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
    assert.equal(otherRoom.ok, true);

    assert.equal(service.authorizeSignal('host', 'guest', 'offer'), undefined);
    assert.equal(service.authorizeSignal('guest', 'host', 'answer'), undefined);
    assert.equal(service.authorizeSignal('host', 'guest', 'ice-candidate'), undefined);
    assert.equal(service.authorizeSignal('guest', 'host', 'offer'), 'NOT_ALLOWED');
    assert.equal(service.authorizeSignal('host', 'other-host', 'offer'), 'PEER_NOT_IN_ROOM');
    assert.equal(service.authorizeSignal('not-a-member', 'guest', 'ice-candidate'), 'NOT_IN_ROOM');
  });
});

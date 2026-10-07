import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatRoomTimeRemaining,
  getParticipantAvatarHue,
  getParticipantInitials,
} from '../src/renderer/lib/room-ui.js';

describe('room UI helpers', () => {
  it('formats a live expiration countdown and an expired room', () => {
    const now = 1_000_000;
    assert.equal(formatRoomTimeRemaining(now + 18 * 60 * 60_000 + 42 * 60_000, now), '18h 42m restantes');
    assert.equal(formatRoomTimeRemaining(now + 42 * 60_000, now), '42m restantes');
    assert.equal(formatRoomTimeRemaining(now - 1, now), 'Expirada');
  });

  it('creates local participant initials and stable avatar colors', () => {
    assert.equal(getParticipantInitials('Ada Lovelace'), 'AL');
    assert.equal(getParticipantInitials('TopCast'), 'TO');
    assert.equal(getParticipantInitials('  '), '?');
    assert.equal(getParticipantAvatarHue('Ada'), getParticipantAvatarHue('Ada'));
    assert.ok(getParticipantAvatarHue('Ada') >= 0 && getParticipantAvatarHue('Ada') < 360);
  });
});

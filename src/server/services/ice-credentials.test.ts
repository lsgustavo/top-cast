import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  createIceServerConfiguration,
  loadTurnConfiguration,
  TURN_CREDENTIAL_TTL_MS,
} from './ice-credentials.js';

const sharedSecret = 'test-only-shared-secret-with-at-least-32-chars';

describe('TURN REST credentials', () => {
  it('uses STUN only when TURN is not configured', () => {
    assert.equal(loadTurnConfiguration({}), null);
    assert.deepEqual(createIceServerConfiguration('participant-1', null, 1_000), [
      { urls: 'stun:stun.l.google.com:19302' },
    ]);
  });

  it('requires TURN URLs and a sufficiently long shared secret together', () => {
    assert.throws(
      () => loadTurnConfiguration({ TURN_URLS: 'turn:relay.example.com:3478' }),
      /configured together/,
    );
    assert.throws(
      () => loadTurnConfiguration({ TURN_SHARED_SECRET: sharedSecret }),
      /configured together/,
    );
    assert.throws(
      () => loadTurnConfiguration({
        TURN_URLS: 'turn:relay.example.com:3478',
        TURN_SHARED_SECRET: 'short',
      }),
      /at least 32 characters/,
    );
    assert.throws(
      () => loadTurnConfiguration({
        TURN_URLS: 'https://relay.example.com',
        TURN_SHARED_SECRET: sharedSecret,
      }),
      /turn: or turns: URLs/,
    );
  });

  it('creates Coturn-compatible credentials expiring within 24 hours', () => {
    const configuration = loadTurnConfiguration({
      TURN_URLS: 'turn:relay.example.com:3478, turns:relay.example.com:5349',
      TURN_SHARED_SECRET: sharedSecret,
    });
    assert.ok(configuration);

    const now = 1_700_000_000_000;
    const [stun, turn] = createIceServerConfiguration('participant-1', configuration, now);
    assert.deepEqual(stun, { urls: 'stun:stun.l.google.com:19302' });
    assert.ok(turn);

    const expiry = Math.floor(now / 1000) + TURN_CREDENTIAL_TTL_MS / 1000;
    const username = `${expiry}:participant-1`;
    const expectedCredential = createHmac('sha1', sharedSecret)
      .update(username)
      .digest('base64');
    assert.deepEqual(turn, {
      urls: ['turn:relay.example.com:3478', 'turns:relay.example.com:5349'],
      username,
      credential: expectedCredential,
      credentialType: 'password',
    });
  });
});

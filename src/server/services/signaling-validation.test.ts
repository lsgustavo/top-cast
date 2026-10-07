import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isValidDescriptionPayload,
  isValidIceCandidatePayload,
} from './signaling-validation.js';

describe('WebRTC signaling validation', () => {
  it('accepts bounded offer and answer descriptions', () => {
    assert.equal(
      isValidDescriptionPayload({
        toParticipantId: 'peer-1',
        description: { type: 'offer', sdp: 'v=0' },
      }),
      true,
    );
    assert.equal(
      isValidDescriptionPayload({
        toParticipantId: 'peer-2',
        description: { type: 'answer', sdp: 'v=0' },
      }),
      true,
    );
  });

  it('rejects malformed or oversized descriptions', () => {
    assert.equal(isValidDescriptionPayload(null), false);
    assert.equal(
      isValidDescriptionPayload({
        toParticipantId: '',
        description: { type: 'offer', sdp: 'v=0' },
      }),
      false,
    );
    assert.equal(
      isValidDescriptionPayload({
        toParticipantId: 'peer-1',
        description: { type: 'pranswer', sdp: 'v=0' },
      }),
      false,
    );
    assert.equal(
      isValidDescriptionPayload({
        toParticipantId: 'peer-1',
        description: { type: 'offer', sdp: 'x'.repeat(256_001) },
      }),
      false,
    );
  });

  it('accepts valid ICE candidates including end-of-candidates', () => {
    assert.equal(
      isValidIceCandidatePayload({
        toParticipantId: 'peer-1',
        candidate: {
          candidate: 'candidate:1 1 UDP 2122260223 192.0.2.1 5000 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0,
          usernameFragment: 'abc123',
        },
      }),
      true,
    );
    assert.equal(
      isValidIceCandidatePayload({
        toParticipantId: 'peer-1',
        candidate: { candidate: '', sdpMid: null, sdpMLineIndex: null },
      }),
      true,
    );
  });

  it('rejects malformed or out-of-range ICE candidate fields', () => {
    assert.equal(
      isValidIceCandidatePayload({
        toParticipantId: 'peer-1',
        candidate: { candidate: 'candidate', sdpMid: 1, sdpMLineIndex: 0 },
      }),
      false,
    );
    assert.equal(
      isValidIceCandidatePayload({
        toParticipantId: 'peer-1',
        candidate: { candidate: 'candidate', sdpMid: '0', sdpMLineIndex: 1.5 },
      }),
      false,
    );
    assert.equal(
      isValidIceCandidatePayload({
        toParticipantId: 'peer-1',
        candidate: { candidate: 'candidate', sdpMid: '0', sdpMLineIndex: -1 },
      }),
      false,
    );
    assert.equal(
      isValidIceCandidatePayload({
        toParticipantId: 'peer-1',
        candidate: {
          candidate: 'candidate',
          sdpMid: '0',
          sdpMLineIndex: 0,
          usernameFragment: 42,
        },
      }),
      false,
    );
  });
});

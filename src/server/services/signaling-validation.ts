import type {
  WebRtcDescriptionPayload,
  WebRtcIceCandidatePayload,
} from '../../shared/types/signaling.js';

export function isValidDescriptionPayload(value: unknown): value is WebRtcDescriptionPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<WebRtcDescriptionPayload>;
  const description = payload.description;
  return (
    typeof payload.toParticipantId === 'string' &&
    payload.toParticipantId.length > 0 &&
    payload.toParticipantId.length <= 128 &&
    typeof description === 'object' &&
    description !== null &&
    (description.type === 'offer' || description.type === 'answer') &&
    typeof description.sdp === 'string' &&
    description.sdp.length > 0 &&
    description.sdp.length <= 256_000
  );
}

export function isValidIceCandidatePayload(value: unknown): value is WebRtcIceCandidatePayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<WebRtcIceCandidatePayload>;
  const candidate = payload.candidate;
  return (
    typeof payload.toParticipantId === 'string' &&
    payload.toParticipantId.length > 0 &&
    payload.toParticipantId.length <= 128 &&
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.candidate === 'string' &&
    candidate.candidate.length <= 4_096 &&
    (typeof candidate.sdpMid === 'string' || candidate.sdpMid === null) &&
    (candidate.sdpMid === null || candidate.sdpMid.length <= 128) &&
    (typeof candidate.sdpMLineIndex === 'number' || candidate.sdpMLineIndex === null) &&
    (candidate.sdpMLineIndex === null ||
      (Number.isInteger(candidate.sdpMLineIndex) && candidate.sdpMLineIndex >= 0)) &&
    (candidate.usernameFragment === undefined ||
      candidate.usernameFragment === null ||
      (typeof candidate.usernameFragment === 'string' && candidate.usernameFragment.length <= 256))
  );
}

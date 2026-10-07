import { createHmac } from 'node:crypto';
import type { IceServerConfiguration } from '../../shared/types/signaling.js';

const TURN_CREDENTIAL_TTL_SECONDS = 24 * 60 * 60;
const MIN_SHARED_SECRET_LENGTH = 32;
const DEFAULT_STUN_URL = 'stun:stun.l.google.com:19302';

export interface TurnConfiguration {
  urls: string[];
  sharedSecret: string;
}

export function loadTurnConfiguration(
  environment: Record<string, string | undefined>,
): TurnConfiguration | null {
  const rawUrls = environment.TURN_URLS?.trim();
  const sharedSecret = environment.TURN_SHARED_SECRET?.trim();
  if (!rawUrls && !sharedSecret) {
    return null;
  }
  if (!rawUrls || !sharedSecret) {
    throw new Error('TURN_URLS and TURN_SHARED_SECRET must be configured together');
  }
  if (sharedSecret.length < MIN_SHARED_SECRET_LENGTH) {
    throw new Error(`TURN_SHARED_SECRET must contain at least ${MIN_SHARED_SECRET_LENGTH} characters`);
  }

  const urls = rawUrls.split(',').map((url) => url.trim()).filter(Boolean);
  if (urls.length === 0 || urls.some((url) => !/^turns?:[^\s,]+$/i.test(url))) {
    throw new Error('TURN_URLS must contain comma-separated turn: or turns: URLs');
  }

  return { urls, sharedSecret };
}

export function createIceServerConfiguration(
  participantId: string,
  turnConfiguration: TurnConfiguration | null,
  now = Date.now(),
): IceServerConfiguration[] {
  const iceServers: IceServerConfiguration[] = [{ urls: DEFAULT_STUN_URL }];
  if (!turnConfiguration) {
    return iceServers;
  }

  const expiresAt = Math.floor(now / 1000) + TURN_CREDENTIAL_TTL_SECONDS;
  const username = `${expiresAt}:${participantId}`;
  const credential = createHmac('sha1', turnConfiguration.sharedSecret)
    .update(username)
    .digest('base64');

  iceServers.push({
    urls: turnConfiguration.urls,
    username,
    credential,
    credentialType: 'password',
  });
  return iceServers;
}

export const TURN_CREDENTIAL_TTL_MS = TURN_CREDENTIAL_TTL_SECONDS * 1000;

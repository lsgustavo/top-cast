import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateIceServers } from '../src/renderer/lib/ice-configuration.js';

describe('ICE server configuration validation', () => {
  it('accepts STUN and credentialed TURN server configurations', () => {
    assert.deepEqual(validateIceServers([
      { urls: 'stun:stun.example.com:3478' },
      {
        urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'],
        username: 'expiry:participant',
        credential: 'temporary-credential',
        credentialType: 'password',
      },
    ]), [
      { urls: 'stun:stun.example.com:3478' },
      {
        urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'],
        username: 'expiry:participant',
        credential: 'temporary-credential',
        credentialType: 'password',
      },
    ]);
  });

  it('rejects missing, empty, and malformed ICE server lists', () => {
    assert.throws(() => validateIceServers(null), /não retornou uma configuração ICE válida/);
    assert.throws(() => validateIceServers([]), /não retornou uma configuração ICE válida/);
    assert.throws(() => validateIceServers([{ urls: [] }]), /configuração ICE inválida/);
    assert.throws(() => validateIceServers([{ urls: 'stun:example.com', username: 'user' }]), /configuração ICE inválida/);
    assert.throws(() => validateIceServers([{ urls: 'stun:example.com', credentialType: 'oauth' }]), /configuração ICE inválida/);
  });
});

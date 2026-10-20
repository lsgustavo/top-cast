import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { playMuteSound, playStreamStartSound } from '../src/renderer/lib/presence-sound.js';

describe('Sidebar Connection Ping & Audio Controls', () => {
  const roomPagePath = path.resolve('src/renderer/pages/RoomPage.tsx');
  const roomPageContent = fs.readFileSync(roomPagePath, 'utf8');
  const pingHookPath = path.resolve('src/renderer/lib/use-connection-ping.ts');
  const pingHookContent = fs.readFileSync(pingHookPath, 'utf8');

  it('provides a real-time connection ping hook with semantic color thresholds', () => {
    assert.ok(pingHookContent.includes('useConnectionPing'));
    // Thresholds: < 50ms (emerald), <= 150ms (amber), > 150ms (destructive)
    assert.ok(pingHookContent.includes('ping < 50'));
    assert.ok(pingHookContent.includes("'bg-emerald-500'"));
    assert.ok(pingHookContent.includes("'text-emerald-500'"));
    assert.ok(pingHookContent.includes('ping <= 150'));
    assert.ok(pingHookContent.includes("'bg-amber-500'"));
    assert.ok(pingHookContent.includes("'text-amber-500'"));
    assert.ok(pingHookContent.includes("'bg-destructive'"));
    assert.ok(pingHookContent.includes("'text-destructive'"));
    // Disconnected / loading fallback: Ping: --
    assert.ok(pingHookContent.includes("'Ping: --'"));
    assert.ok(pingHookContent.includes('`Ping: ${ping} ms`'));
  });

  it('renders connection ping latency indicator in RoomPage sidebar', () => {
    // Activity icon used for latency
    assert.ok(roomPageContent.includes('<Activity'));
    assert.ok(roomPageContent.includes('Latência da rede'));
    // Dynamic text and color bindings
    assert.ok(roomPageContent.includes('connectionPing.text'));
    assert.ok(roomPageContent.includes('connectionPing.dotColor'));
    assert.ok(roomPageContent.includes('connectionPing.textColor'));
    assert.ok(roomPageContent.includes('connectionPing.tooltipText'));
  });

  it('does not include AudioEffectsDialog in the sidebar', () => {
    assert.ok(!roomPageContent.includes('AudioEffectsDialog'));
    assert.ok(!roomPageContent.includes('audio-effects-dialog'));
    assert.ok(roomPageContent.includes('Áudio da tela'));
  });

  it('plays an audio cue when muting or unmuting audio', () => {
    assert.equal(typeof playMuteSound, 'function');
    assert.ok(roomPageContent.includes("import { playMuteSound, playStreamStartSound } from '../lib/presence-sound'"));
    assert.ok(roomPageContent.includes('playMuteSound(true)'));
    assert.ok(roomPageContent.includes('playMuteSound(false)'));
    assert.ok(roomPageContent.includes('playMuteSound(!nextEnabled)'));
    assert.ok(roomPageContent.includes('playMuteSound(nextDeafened)'));
  });

  it('plays a Discord-style Go Live audio cue when starting a transmission', () => {
    assert.equal(typeof playStreamStartSound, 'function');
    assert.ok(roomPageContent.includes("playStreamStartSound('start')"));
    assert.ok(roomPageContent.includes("playStreamStartSound('stop')"));
  });
});

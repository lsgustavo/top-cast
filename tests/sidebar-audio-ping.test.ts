import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_AUDIO_EFFECTS,
  getSavedAudioEffects,
  saveAudioEffects,
} from '../src/renderer/components/audio-effects-dialog.js';
import { playMuteSound, playStreamStartSound } from '../src/renderer/lib/presence-sound.js';

describe('Sidebar Connection Ping & Audio Effects (new.md)', () => {
  const roomPagePath = path.resolve('src/renderer/pages/RoomPage.tsx');
  const roomPageContent = fs.readFileSync(roomPagePath, 'utf8');
  const pingHookPath = path.resolve('src/renderer/lib/use-connection-ping.ts');
  const pingHookContent = fs.readFileSync(pingHookPath, 'utf8');
  const audioEffectsPath = path.resolve('src/renderer/components/audio-effects-dialog.tsx');
  const audioEffectsContent = fs.readFileSync(audioEffectsPath, 'utf8');

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

  it('provides AudioEffectsDialog component with master switch and individual audio filters', () => {
    assert.ok(audioEffectsContent.includes('export function AudioEffectsDialog'));
    // Audio filters: noise suppression, echo cancellation, auto gain control, high fidelity
    assert.ok(audioEffectsContent.includes('noiseSuppression'));
    assert.ok(audioEffectsContent.includes('echoCancellation'));
    assert.ok(audioEffectsContent.includes('autoGainControl'));
    assert.ok(audioEffectsContent.includes('highFidelity'));
    // Master processing switch
    assert.ok(audioEffectsContent.includes('Processamento de Áudio'));
    // Sparkles icon
    assert.ok(audioEffectsContent.includes('<Sparkles'));
  });

  it('saves and restores audio effects configuration from localStorage', () => {
    const memoryStorage = new Map<string, string>();
    const originalWindow = globalThis.window;
    // Mock minimal window with localStorage
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (key: string) => memoryStorage.get(key) ?? null,
        setItem: (key: string, val: string) => { memoryStorage.set(key, val); },
      },
      dispatchEvent: () => true,
    };

    try {
      const initial = getSavedAudioEffects();
      assert.deepEqual(initial, DEFAULT_AUDIO_EFFECTS);

      saveAudioEffects({
        enabled: false,
        noiseSuppression: false,
        echoCancellation: true,
        autoGainControl: false,
        highFidelity: true,
      });

      const updated = getSavedAudioEffects();
      assert.equal(updated.enabled, false);
      assert.equal(updated.noiseSuppression, false);
      assert.equal(updated.echoCancellation, true);
      assert.equal(updated.highFidelity, true);
    } finally {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
  });

  it('integrates AudioEffectsDialog trigger button in sidebar media controls row', () => {
    assert.ok(roomPageContent.includes('<AudioEffectsDialog />'));
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


import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  SOUNDBOARD_CLIPS,
  getSoundboardVolume,
  saveSoundboardVolume,
  DEFAULT_SOUNDBOARD_VOLUME,
  soundboardManager,
} from '../src/renderer/lib/soundboard.js';

describe('Soundboard & Top Sounds (Discord-style)', () => {
  const roomPagePath = path.resolve('src/renderer/pages/RoomPage.tsx');
  const roomPageContent = fs.readFileSync(roomPagePath, 'utf8');
  const topSoundsDropdownPath = path.resolve('src/renderer/components/top-sounds-dropdown.tsx');
  const topSoundsDropdownContent = fs.readFileSync(topSoundsDropdownPath, 'utf8');

  it('organizes audio files into public/sounds and src/renderer/assets/sounds directories', () => {
    const publicBark = path.resolve('public/sounds/bark-fart-made-with-Voicemod.mp3');
    const publicDry = path.resolve('public/sounds/dry-fart-made-with-Voicemod.mp3');
    const assetBark = path.resolve('src/renderer/assets/sounds/bark-fart-made-with-Voicemod.mp3');
    const assetDry = path.resolve('src/renderer/assets/sounds/dry-fart-made-with-Voicemod.mp3');

    assert.ok(fs.existsSync(publicBark), 'public/sounds/bark-fart-made-with-Voicemod.mp3 must exist');
    assert.ok(fs.existsSync(publicDry), 'public/sounds/dry-fart-made-with-Voicemod.mp3 must exist');
    assert.ok(fs.existsSync(assetBark), 'src/renderer/assets/sounds/bark-fart-made-with-Voicemod.mp3 must exist');
    assert.ok(fs.existsSync(assetDry), 'src/renderer/assets/sounds/dry-fart-made-with-Voicemod.mp3 must exist');

    assert.ok(fs.statSync(publicBark).size > 0, 'public bark fart must not be empty');
    assert.ok(fs.statSync(publicDry).size > 0, 'public dry fart must not be empty');
    assert.ok(fs.statSync(assetBark).size > 0, 'asset bark fart must not be empty');
    assert.ok(fs.statSync(assetDry).size > 0, 'asset dry fart must not be empty');

    // Loose root files must have been cleaned up
    const rootBark = path.resolve('bark-fart-made-with-Voicemod.mp3');
    const rootDry = path.resolve('dry-fart-made-with-Voicemod.mp3');
    assert.ok(!fs.existsSync(rootBark), 'root bark fart should be moved to correct folders');
    assert.ok(!fs.existsSync(rootDry), 'root dry fart should be moved to correct folders');
  });

  it('defines soundboard clips with Bark Fart and Dry Fart from Voicemod and emojis', () => {
    assert.equal(SOUNDBOARD_CLIPS.length, 2);

    const barkClip = SOUNDBOARD_CLIPS.find((c) => c.id === 'bark-fart');
    assert.ok(barkClip, 'bark-fart clip must exist');
    assert.equal(barkClip.name.toLowerCase(), 'bark fart');
    assert.equal(barkClip.emoji, '🐶');
    assert.equal(barkClip.fileName, 'bark-fart-made-with-Voicemod.mp3');
    assert.ok(barkClip.src.includes('bark-fart-made-with-Voicemod.mp3'));

    const dryClip = SOUNDBOARD_CLIPS.find((c) => c.id === 'dry-fart');
    assert.ok(dryClip, 'dry-fart clip must exist');
    assert.equal(dryClip.name.toLowerCase(), 'dry fart');
    assert.equal(dryClip.emoji, '💨');
    assert.equal(dryClip.fileName, 'dry-fart-made-with-Voicemod.mp3');
    assert.ok(dryClip.src.includes('dry-fart-made-with-Voicemod.mp3'));
  });

  it('manages soundboard volume with persistence and clamping', () => {
    const memoryStorage = new Map<string, string>();
    const originalWindow = globalThis.window;

    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (key: string) => memoryStorage.get(key) ?? null,
        setItem: (key: string, val: string) => { memoryStorage.set(key, val); },
      },
      dispatchEvent: () => true,
    };

    try {
      const defaultVol = getSoundboardVolume();
      assert.equal(defaultVol, DEFAULT_SOUNDBOARD_VOLUME);

      saveSoundboardVolume(0.5);
      assert.equal(getSoundboardVolume(), 0.5);

      // Clamping > 1
      saveSoundboardVolume(1.8);
      assert.equal(getSoundboardVolume(), 1);

      // Clamping < 0
      saveSoundboardVolume(-0.2);
      assert.equal(getSoundboardVolume(), 0);
    } finally {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
  });

  it('handles soundboard manager subscriber events and stops safely', () => {
    let notified: string[] = [];
    const unsubscribe = soundboardManager.subscribe((activeIds) => {
      notified = activeIds;
    });

    assert.ok(Array.isArray(notified));
    soundboardManager.stop('non-existent');
    soundboardManager.stopAll();
    unsubscribe();
  });

  it('integrates TopSoundsDropdown into StreamVideo controls bar and sidebar', () => {
    assert.ok(roomPageContent.includes("import { TopSoundsDropdown } from '../components/top-sounds-dropdown'"));
    // Na barra de controles da transmissão abre para CIMA e para a ESQUERDA
    assert.ok(roomPageContent.includes('<TopSoundsDropdown placement="top-left"'));
    // Na sidebar de áudio abre para CIMA e para a DIREITA
    assert.ok(roomPageContent.includes('<TopSoundsDropdown placement="top-right" />'));
  });

  it('routes Top-Sounds audio to the broadcast stream with equalized gain and real-time room sync', () => {
    const useScreenCapturePath = path.resolve('src/renderer/features/streaming/use-screen-capture.ts');
    const useScreenCaptureContent = fs.readFileSync(useScreenCapturePath, 'utf8');
    const processAudioStreamPath = path.resolve('src/renderer/lib/process-audio-stream.ts');
    const processAudioStreamContent = fs.readFileSync(processAudioStreamPath, 'utf8');
    const processAudioCapturePath = path.resolve('src/main/services/process-audio-capture.ts');
    const processAudioCaptureContent = fs.readFileSync(processAudioCapturePath, 'utf8');
    const nativeAudioCapturePath = path.resolve('src/native/audio_capture.cpp');
    const nativeAudioCaptureContent = fs.readFileSync(nativeAudioCapturePath, 'utf8');

    // 1. Broadcast de Áudio (Top-Sounds): track de transmissão com ganho equalizado + sincronização em tempo real
    assert.ok(typeof soundboardManager.getBroadcastAudioTrack === 'function');
    assert.ok(typeof soundboardManager.onClipPlay === 'function');
    assert.ok(typeof soundboardManager.onClipStop === 'function');
    assert.ok(useScreenCaptureContent.includes('createBroadcastAudioMix'));
    assert.ok(useScreenCaptureContent.includes('createDynamicsCompressor'));
    assert.ok(roomPageContent.includes("socket.emit('room:soundboard-play'"));
    assert.ok(roomPageContent.includes("socket.on('room:soundboard-play'"));

    // 2. Controle de Mudo (Sidebar): atualiza estado reativo da UI, track.enabled e ganho no AudioContext
    assert.ok(useScreenCaptureContent.includes('processAudioRef.current?.setEnabled(enabled)'));
    assert.ok(useScreenCaptureContent.includes('broadcastMixRef.current?.setSystemAudioMuted(!enabled)'));
    assert.ok(processAudioStreamContent.includes('track.enabled = enabled'));
    assert.ok(processAudioStreamContent.includes('masterGain.gain.setTargetAtTime'));
    assert.ok(roomPageContent.includes('handleToggleSidebarMute'));

    // 3. Isolamento de Áudio em Compartilhamento de Tela Inteira ("Entire Screen")
    assert.ok(useScreenCaptureContent.includes("const isScreen = state.preparedSourceId.startsWith('screen:')"));
    assert.ok(processAudioCaptureContent.includes("rawSourceId.startsWith('screen:')"));
    assert.ok(processAudioCaptureContent.includes('startScreenIsolatedLoopback'));
    assert.ok(nativeAudioCaptureContent.includes('PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE'));
    assert.ok(nativeAudioCaptureContent.includes('FindFilteredCommunicationPids'));
    assert.ok(nativeAudioCaptureContent.includes('discord.exe'));

    // 4. Modo Tela Cheia & Layout Imersivo (Estilo Discord): strip lateral de participantes e overlay flutuante
    assert.ok(roomPageContent.includes('data-immersive-participant-tile'));
    assert.ok(roomPageContent.includes('aria-label="Participantes na transmissão"'));
  });

  it('renders Discord-style Top Sounds dropdown with clean header, sound buttons grid, and pointer isolation', () => {
    assert.ok(topSoundsDropdownContent.includes('export function TopSoundsDropdown'));
    // Header "Top Sounds"
    assert.ok(topSoundsDropdownContent.includes('Top Sounds'));
    // Caret e botão Parar removidos conforme solicitado
    assert.ok(!topSoundsDropdownContent.includes('ChevronDown'), 'caret should be removed');
    assert.ok(!topSoundsDropdownContent.includes('>Parar<'), 'Parar button should be removed');
    // Grid de sons com emoji e nome
    assert.ok(topSoundsDropdownContent.includes('clip.emoji'));
    assert.ok(topSoundsDropdownContent.includes('clip.name'));
    assert.ok(topSoundsDropdownContent.includes('grid grid-cols-2'));
    // Z-index z-[100] para ficar acima de outros dropdowns e do resize handle
    assert.ok(topSoundsDropdownContent.includes('z-[100]'));
    // Permanece aberto e isola pointer events para não acionar redimensionamento através do drop
    assert.ok(topSoundsDropdownContent.includes('onPointerDown'));
    assert.ok(topSoundsDropdownContent.includes('e?.stopPropagation()'));
  });

  it('isolates visual feedbacks to the local user and prevents soundboard retransmission in screen capture', () => {
    // 1. Mock de window.Audio para testar play local vs remoto
    const originalWindow = globalThis.window;
    class MockAudio {
      src: string;
      volume = 1;
      constructor(src: string) {
        this.src = src;
      }
      play() { return Promise.resolve(); }
      pause() {}
      addEventListener() {}
      removeEventListener() {}
    }

    (globalThis as unknown as { window: unknown }).window = {
      Audio: MockAudio,
      AudioContext: class {
        state = 'running';
        createMediaStreamDestination() { return { stream: { getAudioTracks: () => [{}] } }; }
        createGain() { return { gain: { value: 0 }, connect: () => {} }; }
        createOscillator() { return { connect: () => {}, start: () => {} }; }
        resume() { return Promise.resolve(); }
      },
    };

    try {
      const activeStates: string[][] = [];
      const unsub = soundboardManager.subscribe((ids) => {
        activeStates.push([...ids]);
      });

      let playListenerCalls = 0;
      const unsubPlay = soundboardManager.onClipPlay(() => {
        playListenerCalls++;
      });

      const clip = SOUNDBOARD_CLIPS[0];

      // Cenário A: Reprodução Remota (outros participantes recebendo via socket)
      // Não deve gerar feedback visual local (activeClipIds vazio) e não deve re-emitir onClipPlay
      soundboardManager.play(clip, 0.8, { remote: true });
      assert.equal(playListenerCalls, 0, 'remote play must NOT trigger onClipPlay (avoids socket echo loop)');
      assert.equal(soundboardManager.getActiveClipIds().length, 0, 'remote play must NOT register as active local clip');
      assert.equal(soundboardManager.isPlaying(clip.id), false, 'remote play isPlaying must be false for local UI');

      // Cenário B: Reprodução Local (usuário que acionou o Top-Sound)
      // Deve registrar nos activeClipIds locais para exibir animações/feedback na interface dele
      soundboardManager.play(clip, 0.8);
      assert.equal(playListenerCalls, 1, 'local play must trigger onClipPlay for room broadcast');
      assert.deepEqual(soundboardManager.getActiveClipIds(), [clip.id], 'local play must be registered in activeClipIds');
      assert.equal(soundboardManager.isPlaying(clip.id), true, 'local play isPlaying must be true');

      // Ao parar, remove dos clipes ativos
      soundboardManager.stop(clip.id);
      assert.equal(soundboardManager.getActiveClipIds().length, 0);

      unsub();
      unsubPlay();
    } finally {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }

    // 2. Isolamento de áudio da transmissão de tela em use-screen-capture.ts
    const useScreenCapturePath = path.resolve('src/renderer/features/streaming/use-screen-capture.ts');
    const useScreenCaptureContent = fs.readFileSync(useScreenCapturePath, 'utf8');
    assert.ok(
      useScreenCaptureContent.includes('const soundboardTrack: MediaStreamTrack | null = null'),
      'soundboard track must be isolated from the screen broadcast mix to prevent audio echo and retransmission',
    );
  });
});

import type { ProcessAudioChunk } from '../../shared/types/desktop-api';

export interface ProcessAudioStreamController {
  track: MediaStreamTrack;
  setEnabled: (enabled: boolean) => void;
  stop: () => void;
}

export function createProcessAudioTrack(sourceId: string): Promise<ProcessAudioStreamController> {
  const processAudio = window.topCast?.processAudio;
  if (!processAudio) {
    return Promise.reject(new Error('Captura de áudio isolada indisponível fora do aplicativo desktop.'));
  }

  return processAudio.start(sourceId).then((result) => {
    if (!result.ok) {
      throw new Error(result.error ?? 'Falha ao iniciar captura isolada da janela.');
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioContextClass({ sampleRate: 48000 });
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    const destination = audioCtx.createMediaStreamDestination();
    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(destination);

    // Mantem o stream de áudio ativo para o WebRTC transmitir imediatamente
    const silentGain = audioCtx.createGain();
    silentGain.gain.value = 0;
    const silentOsc = audioCtx.createOscillator();
    silentOsc.connect(silentGain);
    silentGain.connect(destination);
    silentOsc.start();

    let nextPlayTime = audioCtx.currentTime;
    const activeSources = new Set<AudioBufferSourceNode>();

    const removeListener = processAudio.onChunk((chunk: ProcessAudioChunk) => {
      if (audioCtx.state === 'suspended') {
        void audioCtx.resume();
      }

      const { samples, sampleRate, channels } = chunk;
      if (!samples || samples.length === 0 || channels === 0) {
        return;
      }

      const numFrames = Math.floor(samples.length / channels);
      if (numFrames === 0) {
        return;
      }

      const audioBuffer = audioCtx.createBuffer(channels, numFrames, sampleRate);
      for (let c = 0; c < channels; c++) {
        const channelData = audioBuffer.getChannelData(c);
        for (let i = 0; i < numFrames; i++) {
          channelData[i] = samples[i * channels + c];
        }
      }

      const sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(masterGain);

      // Sincronizacao de buffer continuo com baixa latencia
      const currentTime = audioCtx.currentTime;
      if (nextPlayTime < currentTime || nextPlayTime > currentTime + 0.15) {
        nextPlayTime = currentTime + 0.02; // Pequeno buffer de 20ms para jitter
      }

      sourceNode.start(nextPlayTime);
      nextPlayTime += audioBuffer.duration;

      activeSources.add(sourceNode);
      sourceNode.onended = () => {
        activeSources.delete(sourceNode);
        sourceNode.disconnect();
      };
    });

    const [track] = destination.stream.getAudioTracks();
    if (!track) {
      removeListener();
      void processAudio.stop();
      void audioCtx.close();
      throw new Error('Não foi possível criar a faixa de áudio da janela.');
    }

    const setEnabled = (enabled: boolean) => {
      track.enabled = enabled;
      masterGain.gain.setTargetAtTime(enabled ? 1 : 0, audioCtx.currentTime, 0.015);
    };

    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      removeListener();
      void processAudio.stop();
      try {
        silentOsc.stop();
        silentOsc.disconnect();
        silentGain.disconnect();
        masterGain.disconnect();
      } catch {
        // Ignora se ja finalizado
      }
      for (const node of activeSources) {
        try {
          node.stop();
          node.disconnect();
        } catch {
          // Ja finalizado
        }
      }
      activeSources.clear();
      track.stop();
      void audioCtx.close();
    };

    track.addEventListener('ended', stop, { once: true });

    return { track, setEnabled, stop };
  }).catch((error: unknown) => {
    console.error('[ProcessAudio] Erro ao configurar stream de audio isolado:', error);
    throw error instanceof Error ? error : new Error(String(error));
  });
}


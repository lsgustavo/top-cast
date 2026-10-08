import type { ProcessAudioChunk } from '../../shared/types/desktop-api';

export interface ProcessAudioStreamController {
  track: MediaStreamTrack;
  stop: () => void;
}

export function createProcessAudioTrack(sourceId: string): Promise<ProcessAudioStreamController | null> {
  const processAudio = window.topCast?.processAudio;
  if (!processAudio) {
    return Promise.resolve(null);
  }

  return processAudio.start(sourceId).then((result) => {
    if (!result.ok) {
      console.warn('[ProcessAudio] Falha ao iniciar captura isolada da janela:', result.error);
      return null;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioContextClass({ sampleRate: 48000 });
    const destination = audioCtx.createMediaStreamDestination();

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
      sourceNode.connect(destination);

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
      return null;
    }

    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      removeListener();
      void processAudio.stop();
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

    return { track, stop };
  }).catch((error) => {
    console.error('[ProcessAudio] Erro ao configurar stream de audio isolado:', error);
    return null;
  });
}


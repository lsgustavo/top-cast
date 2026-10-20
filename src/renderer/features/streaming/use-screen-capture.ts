import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureSource } from '../../../shared/types/desktop-api';
import { createProcessAudioTrack, type ProcessAudioStreamController } from '../../lib/process-audio-stream';
import { soundboardManager } from '../../lib/soundboard';

interface BroadcastAudioMixController {
  outputTrack: MediaStreamTrack;
  setSystemAudioMuted: (muted: boolean) => void;
  stop: () => void;
}

function createBroadcastAudioMix(
  systemTrack: MediaStreamTrack | null,
  soundboardTrack: MediaStreamTrack | null,
): BroadcastAudioMixController | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  try {
    const ctx = new AudioCtx({ sampleRate: 48000 });
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }

    const destination = ctx.createMediaStreamDestination();

    // Compressor suave para manter os níveis de ganho equalizados entre tela e Top-Sounds
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.15;
    compressor.connect(destination);

    // Oscilador silencioso mantém o clock WebRTC contínuo
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.connect(silentGain);
    silentGain.connect(destination);
    osc.start();

    let sysSource: MediaStreamAudioSourceNode | null = null;
    const sysGain = ctx.createGain();
    sysGain.gain.value = 1;
    sysGain.connect(compressor);

    if (systemTrack) {
      try {
        sysSource = ctx.createMediaStreamSource(new MediaStream([systemTrack]));
        sysSource.connect(sysGain);
      } catch {
        // ignore
      }
    }

    let sbSource: MediaStreamAudioSourceNode | null = null;
    const sbGain = ctx.createGain();
    // Ganho equalizado para efeitos do Top-Sounds na faixa de transmissão
    sbGain.gain.value = 0.9;
    sbGain.connect(compressor);

    if (soundboardTrack) {
      try {
        sbSource = ctx.createMediaStreamSource(new MediaStream([soundboardTrack]));
        sbSource.connect(sbGain);
      } catch {
        // ignore
      }
    }

    const [outputTrack] = destination.stream.getAudioTracks();
    if (!outputTrack) {
      void ctx.close();
      return null;
    }

    let stopped = false;
    return {
      outputTrack,
      setSystemAudioMuted: (muted: boolean) => {
        const target = muted ? 0 : 1;
        sysGain.gain.setTargetAtTime(target, ctx.currentTime, 0.015);
        if (systemTrack) {
          systemTrack.enabled = !muted;
        }
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        try {
          osc.stop();
          osc.disconnect();
          silentGain.disconnect();
          sysSource?.disconnect();
          sysGain.disconnect();
          sbSource?.disconnect();
          sbGain.disconnect();
          compressor.disconnect();
        } catch {
          // ignore
        }
        outputTrack.stop();
        void ctx.close();
      },
    };
  } catch {
    return null;
  }
}

interface ScreenCaptureState {
  sources: CaptureSource[];
  stream: MediaStream | null;
  isLoadingSources: boolean;
  isPreparingSource: boolean;
  isStartingCapture: boolean;
  preparedSourceId: string | null;
  includeSystemAudio: boolean;
  hasSystemAudio: boolean;
  systemAudioEnabled: boolean;
  error: string | null;
}

function getScreenCaptureApi() {
  const captureApi = window.topCast?.screenCapture;
  if (!captureApi) {
    throw new Error('A captura de tela está disponível somente no aplicativo desktop.');
  }
  return captureApi;
}

export function useScreenCapture() {
  const [state, setState] = useState<ScreenCaptureState>({
    sources: [],
    stream: null,
    isLoadingSources: false,
    isPreparingSource: false,
    isStartingCapture: false,
    preparedSourceId: null,
    includeSystemAudio: true,
    hasSystemAudio: false,
    systemAudioEnabled: false,
    error: null,
  });
  const streamRef = useRef<MediaStream | null>(null);
  const processAudioRef = useRef<ProcessAudioStreamController | null>(null);
  const broadcastMixRef = useRef<BroadcastAudioMixController | null>(null);
  const rawSystemTrackRef = useRef<MediaStreamTrack | null>(null);
  const captureApi = window.topCast?.screenCapture;
  const supportsSystemAudio = captureApi?.supportsSystemAudio ?? false;

  const stopCapture = useCallback(() => {
    broadcastMixRef.current?.stop();
    broadcastMixRef.current = null;
    processAudioRef.current?.stop();
    processAudioRef.current = null;
    rawSystemTrackRef.current?.stop();
    rawSystemTrackRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    setState((current) => ({
      ...current,
      stream: null,
      isStartingCapture: false,
      hasSystemAudio: false,
      systemAudioEnabled: false,
    }));
  }, []);

  const loadSources = useCallback(async () => {
    setState((current) => ({ ...current, isLoadingSources: true, error: null }));
    try {
      const sources = await getScreenCaptureApi().listSources();
      setState((current) => ({ ...current, sources, isLoadingSources: false }));
      return sources;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível listar as telas e janelas.';
      setState((current) => ({ ...current, isLoadingSources: false, error: message }));
      return [];
    }
  }, []);

  const setIncludeSystemAudio = useCallback((include: boolean) => {
    const shouldInclude = include && supportsSystemAudio;
    setState((current) => ({
      ...current,
      includeSystemAudio: shouldInclude,
    }));
    if (state.preparedSourceId) {
      void getScreenCaptureApi()
        .selectSource(state.preparedSourceId, shouldInclude)
        .catch((error: unknown) => {
          console.warn('[ScreenCapture] Falha ao atualizar inclusão de áudio da fonte:', error);
        });
    }
  }, [supportsSystemAudio, state.preparedSourceId]);

  const prepareSource = useCallback(async (
    sourceId: string | null,
    includeSystemAudio?: boolean,
  ): Promise<boolean> => {
    if (sourceId === null) {
      void getScreenCaptureApi().selectSource(null, false).catch(() => undefined);
      setState((current) => ({
        ...current,
        preparedSourceId: null,
        isPreparingSource: false,
        error: null,
      }));
      return true;
    }

    const audioToInclude = supportsSystemAudio;
    setState((current) => ({ ...current, isPreparingSource: true, error: null }));
    try {
      const selection = await getScreenCaptureApi().selectSource(
        sourceId,
        audioToInclude,
      );
      if (!selection.ok) {
        throw new Error(
          selection.error === 'SOURCE_NOT_AVAILABLE'
            ? 'A tela ou janela selecionada não está mais disponível. Atualize a lista e tente novamente.'
            : 'A solicitação de captura não foi autorizada.',
        );
      }

      setState((current) => ({
        ...current,
        preparedSourceId: sourceId,
        includeSystemAudio: audioToInclude,
        isPreparingSource: false,
        error: null,
      }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível selecionar esta fonte.';
      setState((current) => ({
        ...current,
        isPreparingSource: false,
        preparedSourceId: null,
        error: message,
      }));
      return false;
    }
  }, [supportsSystemAudio, state.includeSystemAudio]);

  const startCapture = useCallback(async (): Promise<boolean> => {
    if (!state.preparedSourceId) {
      setState((current) => ({
        ...current,
        error: 'Selecione um monitor ou uma janela antes de iniciar o compartilhamento.',
      }));
      return false;
    }

    setState((current) => ({ ...current, isStartingCapture: true, error: null }));
    try {
      await getScreenCaptureApi().selectSource(
        state.preparedSourceId,
        supportsSystemAudio,
      );

      const isWindow = state.preparedSourceId.startsWith('window:');
      const isScreen = state.preparedSourceId.startsWith('screen:');

      // Tenta primeiro o isolamento de áudio via WASAPI tanto para janelas quanto para tela inteira ("Entire Screen"),
      // filtrando e impedindo a captura de aplicativos de comunicação em segundo plano (Discord, VoIP, etc.).
      let newProcessAudioController: ProcessAudioStreamController | null = null;
      let audioWarning: string | null = null;

      if (supportsSystemAudio && (isWindow || isScreen)) {
        try {
          newProcessAudioController = await createProcessAudioTrack(state.preparedSourceId);
        } catch (err) {
          console.warn('[ScreenCapture] Falha ao capturar áudio isolado via WASAPI:', err);
          if (isWindow) {
            const reason = err instanceof Error ? err.message : String(err);
            audioWarning = `A janela está sendo transmitida sem áudio: ${reason}`;
          }
        }
      }

      // Se for tela inteira e o módulo WASAPI isolado já estiver ativo, não pede loopback bruto ao getDisplayMedia
      // para evitar vazamento ou duplicação de chamadas VoIP/Discord.
      const requestDisplayLoopback = !isWindow && supportsSystemAudio && !newProcessAudioController;

      // Captura em Full HD (1920x1080) a 60 FPS:
      // Para janelas (window:), utiliza max (sem forçar ideal 16:9) para preservar a proporção original da janela sem esticar;
      // Para monitores/telas inteiras (screen:), solicita resolução Full HD 1920x1080 nativa a 60 FPS.
      const videoConstraints: MediaTrackConstraints = isWindow
        ? {
            frameRate: { ideal: 60, max: 60 },
            width: { max: 1920 },
            height: { max: 1080 },
          }
        : {
            frameRate: { ideal: 60, max: 60 },
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
          };

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: videoConstraints,
        audio: requestDisplayLoopback,
      });
      const [videoTrack] = stream.getVideoTracks();
      if (!videoTrack) {
        newProcessAudioController?.stop();
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('O Electron não retornou uma faixa de vídeo para a captura.');
      }

      if (typeof videoTrack.applyConstraints === 'function') {
        void videoTrack.applyConstraints(videoConstraints).catch(() => undefined);
      }

      let rawSystemTrack: MediaStreamTrack | null = stream.getAudioTracks()[0] ?? null;
      if (newProcessAudioController) {
        // Remove eventual track nativo se veio por engano e usa o track isolado
        for (const existingAudio of stream.getAudioTracks()) {
          stream.removeTrack(existingAudio);
          existingAudio.stop();
        }
        rawSystemTrack = newProcessAudioController.track;
      }

      // Roteia e mixa a faixa de áudio do sistema com o bus de áudio do Top-Sounds (ganho equalizado)
      const soundboardTrack = soundboardManager.getBroadcastAudioTrack();
      let newBroadcastMix: BroadcastAudioMixController | null = null;
      let finalBroadcastAudioTrack: MediaStreamTrack | null = rawSystemTrack;

      if (rawSystemTrack || soundboardTrack) {
        newBroadcastMix = createBroadcastAudioMix(rawSystemTrack, soundboardTrack);
        if (newBroadcastMix) {
          for (const existingAudio of stream.getAudioTracks()) {
            stream.removeTrack(existingAudio);
          }
          stream.addTrack(newBroadcastMix.outputTrack);
          finalBroadcastAudioTrack = newBroadcastMix.outputTrack;
        } else if (rawSystemTrack && !stream.getAudioTracks().includes(rawSystemTrack)) {
          stream.addTrack(rawSystemTrack);
          finalBroadcastAudioTrack = rawSystemTrack;
        }
      }

      // Interrompe controlador de áudio e faixas anteriores após sucesso do novo stream
      broadcastMixRef.current?.stop();
      broadcastMixRef.current = newBroadcastMix;
      processAudioRef.current?.stop();
      processAudioRef.current = newProcessAudioController;
      rawSystemTrackRef.current?.stop();
      rawSystemTrackRef.current = rawSystemTrack;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;

      const hasAudioAvailable = Boolean(rawSystemTrack || finalBroadcastAudioTrack);

      videoTrack.addEventListener('ended', () => {
        if (streamRef.current === stream) {
          broadcastMixRef.current?.stop();
          broadcastMixRef.current = null;
          processAudioRef.current?.stop();
          processAudioRef.current = null;
          rawSystemTrackRef.current?.stop();
          rawSystemTrackRef.current = null;
          streamRef.current = null;
          setState((current) => ({
            ...current,
            stream: null,
            isStartingCapture: false,
            hasSystemAudio: false,
            systemAudioEnabled: false,
          }));
        }
      }, { once: true });
      rawSystemTrack?.addEventListener('ended', () => {
        setState((current) => ({
          ...current,
          hasSystemAudio: false,
          systemAudioEnabled: false,
        }));
      }, { once: true });
      setState((current) => ({
        ...current,
        stream,
        isStartingCapture: false,
        hasSystemAudio: hasAudioAvailable,
        systemAudioEnabled: hasAudioAvailable,
        error: audioWarning,
      }));
      return true;
    } catch (error) {
      if (!streamRef.current) {
        broadcastMixRef.current?.stop();
        broadcastMixRef.current = null;
        processAudioRef.current?.stop();
        processAudioRef.current = null;
        rawSystemTrackRef.current?.stop();
        rawSystemTrackRef.current = null;
      }
      const message = error instanceof Error ? error.message : 'Não foi possível iniciar o compartilhamento de tela.';
      setState((current) => ({
        ...current,
        isStartingCapture: false,
        preparedSourceId: null,
        includeSystemAudio: current.includeSystemAudio,
        error: message,
      }));
      return false;
    }
  }, [state.includeSystemAudio, state.preparedSourceId, supportsSystemAudio]);

  const setSystemAudioEnabled = useCallback((enabled: boolean) => {
    // Atualiza controlador de áudio isolado (ganho no AudioContext + track.enabled)
    processAudioRef.current?.setEnabled(enabled);
    // Atualiza mixador de transmissão (silencia áudio do sistema mas mantém ou silencia conforme necessário)
    broadcastMixRef.current?.setSystemAudioMuted(!enabled);

    if (rawSystemTrackRef.current) {
      rawSystemTrackRef.current.enabled = enabled;
    }

    const activeTracks = streamRef.current?.getAudioTracks() ?? [];
    for (const track of activeTracks) {
      // Se não houver mixador dedicado para separar Top-Sounds, desativa diretamente a track
      if (!broadcastMixRef.current) {
        track.enabled = enabled;
      }
    }

    if (activeTracks.length === 0 && !rawSystemTrackRef.current) {
      setState((current) => ({
        ...current,
        hasSystemAudio: false,
        systemAudioEnabled: false,
      }));
      return;
    }

    setState((current) => ({ ...current, systemAudioEnabled: enabled }));
  }, []);

  useEffect(() => () => {
    broadcastMixRef.current?.stop();
    broadcastMixRef.current = null;
    processAudioRef.current?.stop();
    processAudioRef.current = null;
    rawSystemTrackRef.current?.stop();
    rawSystemTrackRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  return {
    ...state,
    supportsSystemAudio,
    isSharing: state.stream !== null,
    loadSources,
    prepareSource,
    startCapture,
    stopCapture,
    setIncludeSystemAudio,
    setSystemAudioEnabled,
  };
}

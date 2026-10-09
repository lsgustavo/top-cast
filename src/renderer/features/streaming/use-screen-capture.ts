import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureSource } from '../../../shared/types/desktop-api';
import { createProcessAudioTrack, type ProcessAudioStreamController } from '../../lib/process-audio-stream';

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
    includeSystemAudio: false,
    hasSystemAudio: false,
    systemAudioEnabled: false,
    error: null,
  });
  const streamRef = useRef<MediaStream | null>(null);
  const processAudioRef = useRef<ProcessAudioStreamController | null>(null);
  const captureApi = window.topCast?.screenCapture;
  const supportsSystemAudio = captureApi?.supportsSystemAudio ?? false;

  const stopCapture = useCallback(() => {
    processAudioRef.current?.stop();
    processAudioRef.current = null;
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

    const audioToInclude = (includeSystemAudio !== undefined ? includeSystemAudio : state.includeSystemAudio) && supportsSystemAudio;
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
        state.includeSystemAudio && supportsSystemAudio,
      );

      const isWindow = state.preparedSourceId.startsWith('window:');

      // Chamada a getDisplayMedia: para tela cheia captura loopback padrão; para janela, o áudio isolado virá via WASAPI
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
        },
        audio: !isWindow && state.includeSystemAudio,
      });
      const [videoTrack] = stream.getVideoTracks();
      if (!videoTrack) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('O Electron não retornou uma faixa de vídeo para a captura.');
      }

      let systemAudioTrack = stream.getAudioTracks()[0] ?? null;

      // Se for janela e o áudio estiver marcado, iniciar captura de áudio isolada pelo processo
      if (isWindow && state.includeSystemAudio) {
        try {
          const controller = await createProcessAudioTrack(state.preparedSourceId);
          if (controller) {
            processAudioRef.current = controller;
            stream.addTrack(controller.track);
            systemAudioTrack = controller.track;
          }
        } catch (err) {
          console.warn('[ScreenCapture] Falha ao capturar áudio isolado do processo:', err);
        }
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      videoTrack.addEventListener('ended', () => {
        processAudioRef.current?.stop();
        processAudioRef.current = null;
        if (streamRef.current === stream) {
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
      systemAudioTrack?.addEventListener('ended', () => {
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
        hasSystemAudio: systemAudioTrack !== null,
        systemAudioEnabled: systemAudioTrack !== null,
        error: null,
      }));
      return true;
    } catch (error) {
      processAudioRef.current?.stop();
      processAudioRef.current = null;
      const message = error instanceof Error ? error.message : 'Não foi possível iniciar o compartilhamento de tela.';
      setState((current) => ({
        ...current,
        isStartingCapture: false,
        preparedSourceId: null,
        includeSystemAudio: false,
        error: message,
      }));
      return false;
    }
  }, [state.includeSystemAudio, state.preparedSourceId, supportsSystemAudio]);

  const setSystemAudioEnabled = useCallback((enabled: boolean) => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track || track.readyState !== 'live') {
      setState((current) => ({
        ...current,
        hasSystemAudio: false,
        systemAudioEnabled: false,
      }));
      return;
    }
    track.enabled = enabled;
    setState((current) => ({ ...current, systemAudioEnabled: enabled }));
  }, []);

  useEffect(() => () => {
    processAudioRef.current?.stop();
    processAudioRef.current = null;
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

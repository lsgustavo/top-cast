import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureSource } from '../../../shared/types/desktop-api';

interface ScreenCaptureState {
  sources: CaptureSource[];
  stream: MediaStream | null;
  isLoadingSources: boolean;
  isPreparingSource: boolean;
  isStartingCapture: boolean;
  preparedSourceId: string | null;
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
    error: null,
  });
  const streamRef = useRef<MediaStream | null>(null);

  const stopCapture = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    setState((current) => ({ ...current, stream: null, isStartingCapture: false }));
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

  const prepareSource = useCallback(async (sourceId: string | null): Promise<boolean> => {
    setState((current) => ({ ...current, isPreparingSource: true, error: null }));
    try {
      const selection = await getScreenCaptureApi().selectSource(sourceId);
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
  }, []);

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
      // Call getDisplayMedia before awaiting anything so the click gesture remains active.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
        },
        audio: false,
      });
      const [videoTrack] = stream.getVideoTracks();
      if (!videoTrack) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('O Electron não retornou uma faixa de vídeo para a captura.');
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      videoTrack.addEventListener('ended', () => {
        if (streamRef.current === stream) {
          streamRef.current = null;
          setState((current) => ({ ...current, stream: null, isStartingCapture: false }));
        }
      }, { once: true });
      setState((current) => ({ ...current, stream, isStartingCapture: false, error: null }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível iniciar o compartilhamento de tela.';
      setState((current) => ({
        ...current,
        isStartingCapture: false,
        preparedSourceId: null,
        error: message,
      }));
      return false;
    }
  }, [state.preparedSourceId]);

  useEffect(() => () => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  return {
    ...state,
    isSharing: state.stream !== null,
    loadSources,
    prepareSource,
    startCapture,
    stopCapture,
  };
}

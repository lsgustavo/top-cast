import { useCallback, useEffect, useRef, useState } from 'react';

export function useMicrophone() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const disable = useCallback(() => {
    const currentStream = streamRef.current;
    streamRef.current = null;
    currentStream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setIsStarting(false);
    setError(null);
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    setIsStarting(true);
    setError(null);
    try {
      const microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      const [audioTrack] = microphoneStream.getAudioTracks();
      if (!audioTrack) {
        microphoneStream.getTracks().forEach((track) => track.stop());
        throw new Error('O dispositivo não retornou uma faixa de microfone.');
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = microphoneStream;
      audioTrack.addEventListener('ended', () => {
        if (streamRef.current === microphoneStream) {
          streamRef.current = null;
          setStream(null);
          setIsStarting(false);
        }
      }, { once: true });
      setStream(microphoneStream);
      setIsStarting(false);
      return true;
    } catch (captureError) {
      const message = captureError instanceof Error
        ? captureError.message
        : 'Não foi possível ativar o microfone.';
      setIsStarting(false);
      setError(message);
      return false;
    }
  }, []);

  const toggle = useCallback(async () => {
    if (streamRef.current) {
      disable();
      return false;
    }
    return enable();
  }, [disable, enable]);

  useEffect(() => () => {
    const currentStream = streamRef.current;
    streamRef.current = null;
    currentStream?.getTracks().forEach((track) => track.stop());
  }, []);

  return {
    stream,
    isEnabled: stream !== null,
    isStarting,
    error,
    toggle,
    disable,
  };
}

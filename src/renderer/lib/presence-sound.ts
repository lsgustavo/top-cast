export function playPresenceSound(kind: 'joined' | 'left'): void {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return;
  }

  const context = new window.AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.type = 'sine';
  oscillator.frequency.value = kind === 'joined' ? 740 : 440;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.onended = () => {
    void context.close();
  };

  const start = () => {
    oscillator.start(now);
    oscillator.stop(now + 0.17);
  };
  if (context.state === 'suspended') {
    void context.resume().then(start).catch((error: unknown) => {
      console.warn('Could not play participant presence sound', error);
      void context.close();
    });
  } else {
    start();
  }
}

export function playMuteSound(muted = true): void {
  if (typeof window === 'undefined') {
    return;
  }
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  try {
    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    // Som estilo Discord: duas notas descendentes ao mutar (520Hz -> 340Hz) e ascendentes ao ativar (360Hz -> 540Hz)
    oscillator.type = 'sine';
    if (muted) {
      oscillator.frequency.setValueAtTime(520, now);
      oscillator.frequency.setValueAtTime(340, now + 0.065);
    } else {
      oscillator.frequency.setValueAtTime(360, now);
      oscillator.frequency.setValueAtTime(540, now + 0.065);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.025, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.065, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      void context.close();
    };

    const start = () => {
      oscillator.start(now);
      oscillator.stop(now + 0.16);
    };

    if (context.state === 'suspended') {
      void context.resume().then(start).catch((error: unknown) => {
        console.warn('Could not play mute sound', error);
        void context.close();
      });
    } else {
      start();
    }
  } catch (error) {
    console.warn('Could not initialize mute sound', error);
  }
}

/**
 * Toca o efeito sonoro estilo Discord "Go Live" ao iniciar (ou encerrar) uma transmissão.
 */
export function playStreamStartSound(kind: 'start' | 'stop' = 'start'): void {
  if (typeof window === 'undefined') {
    return;
  }
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  try {
    const context = new AudioCtx();
    const masterGain = context.createGain();
    masterGain.gain.value = 0.85;
    masterGain.connect(context.destination);

    const now = context.currentTime;

    // Arpejo ascendente vibrante estilo Discord Go Live (D5 -> F#5 -> A5 -> D6) ao iniciar,
    // ou acorde descendente suave (A5 -> F#5 -> D5) ao encerrar
    const notes =
      kind === 'start'
        ? [
            { freq: 587.33, offset: 0.0, duration: 0.14, peak: 0.055 }, // D5
            { freq: 739.99, offset: 0.065, duration: 0.15, peak: 0.06 }, // F#5
            { freq: 880.0, offset: 0.13, duration: 0.18, peak: 0.065 }, // A5
            { freq: 1174.66, offset: 0.195, duration: 0.32, peak: 0.075 }, // D6 (brilho final)
          ]
        : [
            { freq: 880.0, offset: 0.0, duration: 0.12, peak: 0.05 }, // A5
            { freq: 659.25, offset: 0.065, duration: 0.14, peak: 0.05 }, // E5
            { freq: 440.0, offset: 0.13, duration: 0.22, peak: 0.055 }, // A4
          ];

    const startPlayback = () => {
      let lastOscillator: OscillatorNode | null = null;

      for (const note of notes) {
        const oscMain = context.createOscillator();
        const oscWarm = context.createOscillator();
        const noteGain = context.createGain();

        const startTime = now + note.offset;
        const stopTime = startTime + note.duration;

        oscMain.type = 'sine';
        oscMain.frequency.setValueAtTime(note.freq, startTime);

        oscWarm.type = 'triangle';
        oscWarm.frequency.setValueAtTime(note.freq * 0.5, startTime);

        const warmGain = context.createGain();
        warmGain.gain.value = 0.25;

        noteGain.gain.setValueAtTime(0.0001, startTime);
        noteGain.gain.exponentialRampToValueAtTime(note.peak, startTime + 0.018);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

        oscMain.connect(noteGain);
        oscWarm.connect(warmGain);
        warmGain.connect(noteGain);
        noteGain.connect(masterGain);

        oscMain.start(startTime);
        oscMain.stop(stopTime + 0.01);
        oscWarm.start(startTime);
        oscWarm.stop(stopTime + 0.01);

        lastOscillator = oscMain;
      }

      if (lastOscillator) {
        lastOscillator.onended = () => {
          void context.close();
        };
      }
    };

    if (context.state === 'suspended') {
      void context.resume().then(startPlayback).catch((error: unknown) => {
        console.warn('Could not play stream start sound', error);
        void context.close();
      });
    } else {
      startPlayback();
    }
  } catch (error) {
    console.warn('Could not initialize stream start sound', error);
  }
}

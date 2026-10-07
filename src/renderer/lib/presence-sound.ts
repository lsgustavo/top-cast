export function playPresenceSound(kind: 'joined' | 'left'): void {
  if (typeof window.AudioContext === 'undefined') {
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

  const start = () => oscillator.start();
  if (context.state === 'suspended') {
    void context.resume().then(start).catch((error: unknown) => {
      console.warn('Could not play participant presence sound', error);
      void context.close();
    });
  } else {
    start();
  }
}

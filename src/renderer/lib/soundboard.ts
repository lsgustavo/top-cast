export interface SoundboardClip {
  id: string;
  name: string;
  emoji: string;
  fileName: string;
  src: string;
  category: string;
  description: string;
  tags?: string[];
}

export const SOUNDBOARD_STORAGE_KEY = 'topcast:soundboard-volume';
export const DEFAULT_SOUNDBOARD_VOLUME = 0.8;

export const SOUNDBOARD_CLIPS: SoundboardClip[] = [
  {
    id: 'bark-fart',
    name: 'bark fart',
    emoji: '🐶',
    fileName: 'bark-fart-made-with-Voicemod.mp3',
    src: './sounds/bark-fart-made-with-Voicemod.mp3',
    category: 'Voicemod',
    description: 'Efeito cômico de latido canino seguido de peido clássico.',
    tags: ['fart', 'bark', 'voicemod', 'humor', 'meme'],
  },
  {
    id: 'dry-fart',
    name: 'dry fart',
    emoji: '💨',
    fileName: 'dry-fart-made-with-Voicemod.mp3',
    src: './sounds/dry-fart-made-with-Voicemod.mp3',
    category: 'Voicemod',
    description: 'Efeito sonoro de peido seco e rápido com impacto acústico.',
    tags: ['fart', 'dry', 'voicemod', 'humor', 'meme'],
  },
];

export function getSoundboardVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_SOUNDBOARD_VOLUME;
  try {
    const raw = window.localStorage.getItem(SOUNDBOARD_STORAGE_KEY);
    if (raw !== null) {
      const val = parseFloat(raw);
      if (!Number.isNaN(val) && val >= 0 && val <= 1) {
        return val;
      }
    }
  } catch {
    // fallback se localStorage indisponível
  }
  return DEFAULT_SOUNDBOARD_VOLUME;
}

export function saveSoundboardVolume(volume: number): void {
  if (typeof window === 'undefined') return;
  try {
    const clamped = Math.max(0, Math.min(1, volume));
    window.localStorage.setItem(SOUNDBOARD_STORAGE_KEY, clamped.toString());
    window.dispatchEvent(new CustomEvent('topcast:soundboard-volume-changed', { detail: clamped }));
  } catch {
    // ignorar erro
  }
}

// Gerenciador de reprodução de áudio do soundboard
class SoundboardManager {
  private activeAudios = new Map<string, HTMLAudioElement>();
  private localActiveClipIds = new Set<string>();
  private activeListeners = new Set<(activeIds: string[]) => void>();
  private playListeners = new Set<(clip: SoundboardClip, volume: number) => void>();
  private stopListeners = new Set<(clipId: string) => void>();
  private audioContext: AudioContext | null = null;
  private broadcastDestination: MediaStreamAudioDestinationNode | null = null;
  private broadcastMasterGain: GainNode | null = null;
  private activeWebAudioNodes = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();
  private decodedBufferCache = new Map<string, AudioBuffer>();

  public subscribe(listener: (activeIds: string[]) => void): () => void {
    this.activeListeners.add(listener);
    listener(this.getActiveClipIds());
    return () => {
      this.activeListeners.delete(listener);
    };
  }

  public onClipPlay(listener: (clip: SoundboardClip, volume: number) => void): () => void {
    this.playListeners.add(listener);
    return () => {
      this.playListeners.delete(listener);
    };
  }

  public onClipStop(listener: (clipId: string) => void): () => void {
    this.stopListeners.add(listener);
    return () => {
      this.stopListeners.delete(listener);
    };
  }

  /**
   * Mantido para compatibilidade de API.
   * Retorna um MediaStreamTrack de áudio silencioso se solicitado.
   */
  public getBroadcastAudioTrack(): MediaStreamTrack | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioCtx({ sampleRate: 48000 });
      this.broadcastDestination = this.audioContext.createMediaStreamDestination();
      this.broadcastMasterGain = this.audioContext.createGain();
      this.broadcastMasterGain.gain.value = 0;
      this.broadcastMasterGain.connect(this.broadcastDestination);

      // Oscilador silencioso
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0;
      const osc = this.audioContext.createOscillator();
      osc.connect(silentGain);
      silentGain.connect(this.broadcastDestination);
      osc.start();
    }

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume().catch(() => undefined);
    }

    return this.broadcastDestination?.stream.getAudioTracks()[0] ?? null;
  }

  /**
   * Mantido para compatibilidade.
   * Isolamento rigoroso: efeitos do Top-Sounds NUNCA são injetados na transmissão de tela,
   * garantindo que trafeguem exclusivamente pelo canal de sinalização e nunca gerem eco ou duplicação.
   */
  public async routeClipToBroadcastBus(_clip: SoundboardClip, _volume: number): Promise<void> {
    return Promise.resolve();
  }

  private notify(): void {
    const active = this.getActiveClipIds();
    for (const listener of this.activeListeners) {
      listener(active);
    }
  }

  /**
   * Retorna estritamente os clipes ativos acionados localmente pelo usuário atual.
   * Feedbacks visuais (ícone pulsante, ping, equalizador no menu) ficam restritos a quem acionou o efeito.
   */
  public getActiveClipIds(): string[] {
    return Array.from(this.localActiveClipIds);
  }

  public isPlaying(clipId: string): boolean {
    return this.localActiveClipIds.has(clipId);
  }

  /**
   * Retorna todos os clipes atualmente com áudio em reprodução (local ou remoto).
   */
  public getAllActiveClipIds(): string[] {
    return Array.from(this.activeAudios.keys());
  }

  public play(clip: SoundboardClip, volume = getSoundboardVolume(), options?: { remote?: boolean }): void {
    if (typeof window === 'undefined' || typeof window.Audio === 'undefined') {
      return;
    }

    const clampedVolume = Math.max(0, Math.min(1, volume));
    const isRemote = Boolean(options?.remote);

    // Se já estiver tocando esse som, para e reinicia
    this.stop(clip.id, { remote: true });

    // Apenas quem acionou localmente o efeito recebe feedbacks visuais e dispara para a sala
    if (!isRemote) {
      this.localActiveClipIds.add(clip.id);
      for (const listener of this.playListeners) {
        listener(clip, clampedVolume);
      }
    }

    try {
      const audio = new window.Audio(clip.src);
      audio.volume = clampedVolume;

      const onEnd = () => {
        this.activeAudios.delete(clip.id);
        this.localActiveClipIds.delete(clip.id);
        this.notify();
      };

      audio.addEventListener('ended', onEnd);
      audio.addEventListener('error', onEnd);

      this.activeAudios.set(clip.id, audio);
      this.notify();

      void audio.play().catch((err: unknown) => {
        console.warn(`[Soundboard] Falha ao reproduzir ${clip.name}:`, err);
        this.activeAudios.delete(clip.id);
        this.localActiveClipIds.delete(clip.id);
        this.notify();
      });
    } catch (err) {
      console.warn(`[Soundboard] Erro ao instanciar áudio para ${clip.name}:`, err);
      this.localActiveClipIds.delete(clip.id);
      this.notify();
    }
  }

  public stop(clipId: string, options?: { remote?: boolean }): void {
    const webNode = this.activeWebAudioNodes.get(clipId);
    if (webNode) {
      try {
        webNode.source.stop();
        webNode.source.disconnect();
        webNode.gain.disconnect();
      } catch {
        // ignore
      }
      this.activeWebAudioNodes.delete(clipId);
    }

    this.localActiveClipIds.delete(clipId);

    const audio = this.activeAudios.get(clipId);
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignorar
      }
      this.activeAudios.delete(clipId);
    }
    this.notify();

    if (!options?.remote) {
      for (const listener of this.stopListeners) {
        listener(clipId);
      }
    }
  }

  public stopAll(options?: { remote?: boolean }): void {
    for (const [clipId, webNode] of this.activeWebAudioNodes) {
      try {
        webNode.source.stop();
        webNode.source.disconnect();
        webNode.gain.disconnect();
      } catch {
        // ignore
      }
      if (!options?.remote) {
        for (const listener of this.stopListeners) {
          listener(clipId);
        }
      }
    }
    this.activeWebAudioNodes.clear();

    this.localActiveClipIds.clear();

    for (const [, audio] of this.activeAudios) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignorar
      }
    }
    this.activeAudios.clear();
    this.notify();
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    for (const [, audio] of this.activeAudios) {
      try {
        audio.volume = clamped;
      } catch {
        // ignorar
      }
    }
    for (const [, webNode] of this.activeWebAudioNodes) {
      try {
        webNode.gain.gain.value = clamped;
      } catch {
        // ignore
      }
    }
  }
}

export const soundboardManager = new SoundboardManager();


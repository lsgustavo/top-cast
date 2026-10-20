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
   * Retorna um MediaStreamTrack de áudio contínuo (com ganho equalizado) onde todos
   * os efeitos do Top-Sounds são roteados em tempo real para mixagem na transmissão WebRTC.
   */
  public getBroadcastAudioTrack(): MediaStreamTrack | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioCtx({ sampleRate: 48000 });
      this.broadcastDestination = this.audioContext.createMediaStreamDestination();
      this.broadcastMasterGain = this.audioContext.createGain();
      // Ganho equalizado (headroom balanceado para não clipar junto ao áudio do sistema)
      this.broadcastMasterGain.gain.value = 0.85;
      this.broadcastMasterGain.connect(this.broadcastDestination);

      // Oscilador silencioso mantém a track ativa para mixagem WebRTC contínua
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

  private async routeClipToBroadcastBus(clip: SoundboardClip, volume: number): Promise<void> {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    try {
      this.getBroadcastAudioTrack();
      const ctx = this.audioContext;
      const masterGain = this.broadcastMasterGain;
      if (!ctx || !masterGain) return;

      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => undefined);
      }

      let audioBuffer = this.decodedBufferCache.get(clip.id);
      if (!audioBuffer) {
        const response = await window.fetch(clip.src);
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.decodedBufferCache.set(clip.id, audioBuffer);
      }

      // Para nó anterior do mesmo clip se houver
      const prevNode = this.activeWebAudioNodes.get(clip.id);
      if (prevNode) {
        try {
          prevNode.source.stop();
          prevNode.source.disconnect();
          prevNode.gain.disconnect();
        } catch {
          // ignore
        }
        this.activeWebAudioNodes.delete(clip.id);
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      const clipGain = ctx.createGain();
      // Equalização suave de ganho (0.0 a 1.0)
      clipGain.gain.value = Math.max(0, Math.min(1, volume));
      source.connect(clipGain);
      clipGain.connect(masterGain);

      this.activeWebAudioNodes.set(clip.id, { source, gain: clipGain });
      source.onended = () => {
        const current = this.activeWebAudioNodes.get(clip.id);
        if (current?.source === source) {
          this.activeWebAudioNodes.delete(clip.id);
        }
        try {
          source.disconnect();
          clipGain.disconnect();
        } catch {
          // ignore
        }
      };
      source.start(0);
    } catch {
      // Ignora em ambientes de teste ou se fetch falhar
    }
  }

  private notify(): void {
    const active = this.getActiveClipIds();
    for (const listener of this.activeListeners) {
      listener(active);
    }
  }

  public getActiveClipIds(): string[] {
    return Array.from(this.activeAudios.keys());
  }

  public isPlaying(clipId: string): boolean {
    return this.activeAudios.has(clipId);
  }

  public play(clip: SoundboardClip, volume = getSoundboardVolume(), options?: { remote?: boolean }): void {
    if (typeof window === 'undefined' || typeof window.Audio === 'undefined') {
      return;
    }

    const clampedVolume = Math.max(0, Math.min(1, volume));

    // Se já estiver tocando esse som, para e reinicia
    this.stop(clip.id, { remote: true });

    if (!options?.remote) {
      for (const listener of this.playListeners) {
        listener(clip, clampedVolume);
      }
    }

    // Roteia também para o bus WebAudio da stream de transmissão com ganho equalizado
    void this.routeClipToBroadcastBus(clip, clampedVolume);

    try {
      const audio = new window.Audio(clip.src);
      audio.volume = clampedVolume;

      const onEnd = () => {
        this.activeAudios.delete(clip.id);
        this.notify();
      };

      audio.addEventListener('ended', onEnd);
      audio.addEventListener('error', onEnd);

      this.activeAudios.set(clip.id, audio);
      this.notify();

      void audio.play().catch((err: unknown) => {
        console.warn(`[Soundboard] Falha ao reproduzir ${clip.name}:`, err);
        this.activeAudios.delete(clip.id);
        this.notify();
      });
    } catch (err) {
      console.warn(`[Soundboard] Erro ao instanciar áudio para ${clip.name}:`, err);
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

    const audio = this.activeAudios.get(clipId);
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignorar
      }
      this.activeAudios.delete(clipId);
      this.notify();
    }

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


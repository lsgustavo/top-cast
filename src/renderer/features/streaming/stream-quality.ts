export type StreamQualityPresetId = '720p30' | '1080p60' | '1440p60';

export interface StreamQualityPreset {
  id: StreamQualityPresetId;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
}

export const STREAM_QUALITY_STORAGE_KEY = 'topcast:stream-quality-preset';
export const DEFAULT_STREAM_QUALITY_PRESET: StreamQualityPresetId = '1080p60';

export const STREAM_QUALITY_PRESETS: Record<StreamQualityPresetId, StreamQualityPreset> = {
  '720p30': {
    id: '720p30',
    label: '720p 30 FPS',
    shortLabel: '720p · 30 FPS',
    badge: 'HD',
    description: 'Menor consumo de rede e CPU',
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrate: 3_500_000,
  },
  '1080p60': {
    id: '1080p60',
    label: '1080p 60 FPS',
    shortLabel: '1080p · 60 FPS',
    badge: 'Full HD',
    description: 'Equilíbrio ideal entre nitidez e fluidez',
    width: 1920,
    height: 1080,
    frameRate: 60,
    maxBitrate: 8_000_000,
  },
  '1440p60': {
    id: '1440p60',
    label: '1440p 60 FPS',
    shortLabel: '1440p · 60 FPS',
    badge: 'QHD Ultra',
    description: 'Nitidez máxima para textos, código e telas 2K/4K',
    width: 2560,
    height: 1440,
    frameRate: 60,
    maxBitrate: 15_000_000,
  },
};

export const STREAM_QUALITY_PRESET_LIST: StreamQualityPreset[] = [
  STREAM_QUALITY_PRESETS['720p30'],
  STREAM_QUALITY_PRESETS['1080p60'],
  STREAM_QUALITY_PRESETS['1440p60'],
];

export function isStreamQualityPresetId(value: unknown): value is StreamQualityPresetId {
  return value === '720p30' || value === '1080p60' || value === '1440p60';
}

export function getSavedStreamQualityPreset(): StreamQualityPresetId {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STREAM_QUALITY_STORAGE_KEY);
      if (isStreamQualityPresetId(saved)) {
        return saved;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_STREAM_QUALITY_PRESET;
}

export function saveStreamQualityPreset(presetId: StreamQualityPresetId): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STREAM_QUALITY_STORAGE_KEY, presetId);
    }
  } catch {
    // ignore
  }
}


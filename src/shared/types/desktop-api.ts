export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
}

export interface CaptureSource {
  id: string;
  name: string;
  kind: 'screen' | 'window';
  displayId: string;
  thumbnailDataUrl: string;
  appIconDataUrl?: string;
}

export type CaptureSourceSelection =
  | { ok: true }
  | { ok: false; error: 'SOURCE_NOT_AVAILABLE' | 'UNAUTHORIZED' };

export interface ScreenCaptureApi {
  supportsSystemAudio: boolean;
  listSources: () => Promise<CaptureSource[]>;
  selectSource: (sourceId: string | null, includeSystemAudio: boolean) => Promise<CaptureSourceSelection>;
}

export interface ProcessAudioChunk {
  samples: Float32Array;
  sampleRate: number;
  channels: number;
}

export interface ProcessAudioApi {
  isSupported: () => Promise<boolean>;
  start: (sourceId: string) => Promise<{ ok: boolean; pid?: number; error?: string }>;
  stop: () => Promise<boolean>;
  onChunk: (callback: (chunk: ProcessAudioChunk) => void) => () => void;
}

export interface TopCastApi {
  copyToClipboard: (text: string) => Promise<boolean>;
  getAppInfo: () => AppInfo;
  notifyParticipantJoined: (displayName: string) => Promise<boolean>;
  onLeaveRoomShortcut: (callback: () => void) => () => void;
  screenCapture: ScreenCaptureApi;
  processAudio: ProcessAudioApi;
}